import * as Data from "effect/Data";
import * as Result from "effect/Result";

import {
  transitionWorkflowLifecycle,
  type WorkflowLifecycleState,
} from "./lifecycleState";

export type WorkflowLifecycleOperation =
  "cancel" | "restart" | "list" | "listByName" | "listSteps" | "cleanup";

export type WorkflowLifecyclePrincipal = {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly authority: "operator" | "system";
};

export type WorkflowLifecycleReasonCode =
  "operator-request" | "recovery" | "policy-change" | "retention-sweep";

export type WorkflowLifecycleOwnedRun = {
  readonly workflowRunId: string;
  readonly componentWorkflowId: string;
  readonly workflowName: string;
  readonly state: WorkflowLifecycleState;
};

export type WorkflowLifecycleAuditEvent = {
  readonly type:
    | "workflow.cancel.requested"
    | "workflow.restart.requested"
    | "workflow.cleanup.requested";
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly generation: number;
  readonly actorId: string;
  readonly authority: WorkflowLifecyclePrincipal["authority"];
  readonly reasonCode: WorkflowLifecycleReasonCode;
  readonly occurredAt: number;
  readonly discardedStepCount: number;
  readonly redacted: true;
};

export type PaginationInput = {
  readonly cursor: string | null;
  readonly limit: number;
};

export type Page<Row> = {
  readonly page: readonly Row[];
  readonly isDone: boolean;
  readonly continueCursor: string;
};

export type WorkflowRunProjectionSource = Readonly<
  Record<string, unknown> & {
    workflowRunId: string;
    workflowName: string;
    workflowId: string;
    workflowVersion: number;
    status: string;
    generation: number;
    startedAt: number;
    completedAt: number | null;
  }
>;

export type WorkflowStepProjectionSource = Readonly<
  Record<string, unknown> & {
    stepName: string;
    status: string;
    attempt: number;
    startedAt: number | null;
    finishedAt: number | null;
    errorCode: string | null;
  }
>;

export type WorkflowRestartInspection = {
  readonly discardedSteps: readonly string[];
  readonly externalEffects: readonly {
    readonly stepName: string;
    readonly restartSafe: boolean;
    readonly restartSafeUntil: number;
    readonly dedupeExpiresAt: number;
  }[];
};

export type WorkflowQuiescenceInspection = {
  readonly inProgressSteps: readonly string[];
  readonly inProgressChildren: readonly string[];
};

export type WorkflowRetentionInspection = {
  readonly parentUntil: number | null;
  readonly childUntil: number | null;
  readonly evidenceUntil: number | null;
  readonly activeChildCount: number;
  readonly retentionUnverifiable: boolean;
};

export type WorkflowLifecycleControlPorts = {
  readonly authorize: (
    principal: WorkflowLifecyclePrincipal,
    operation: WorkflowLifecycleOperation,
  ) => Promise<boolean>;
  readonly loadOwnedRun: (
    workspaceId: string,
    workflowRunId: string,
  ) => Promise<WorkflowLifecycleOwnedRun | null>;
  readonly saveLifecycleState: (
    workflowRunId: string,
    state: WorkflowLifecycleState,
  ) => Promise<void>;
  readonly appendAudit: (event: WorkflowLifecycleAuditEvent) => Promise<void>;
  readonly listOwnedRuns: (
    workspaceId: string,
    pagination: PaginationInput,
  ) => Promise<Page<WorkflowRunProjectionSource>>;
  readonly listOwnedRunsByName: (
    workspaceId: string,
    workflowName: string,
    pagination: PaginationInput,
  ) => Promise<Page<WorkflowRunProjectionSource>>;
  readonly listOwnedSteps: (
    workspaceId: string,
    workflowRunId: string,
    generation: number,
    pagination: PaginationInput,
  ) => Promise<Page<WorkflowStepProjectionSource>>;
  readonly inspectRestart: (input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly generation: number;
    readonly restartAnchor: string;
  }) => Promise<WorkflowRestartInspection>;
  readonly inspectQuiescence: (input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
  }) => Promise<WorkflowQuiescenceInspection>;
  readonly inspectRetention: (input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
  }) => Promise<WorkflowRetentionInspection>;
  readonly component: {
    readonly status: (componentWorkflowId: string) => Promise<{
      readonly type: "inProgress" | "completed" | "failed" | "canceled";
    }>;
    readonly cancel: (componentWorkflowId: string) => Promise<void>;
    readonly restart: (
      componentWorkflowId: string,
      options: { readonly from: 0 | string; readonly startAsync: true },
    ) => Promise<void>;
    readonly cleanup: (componentWorkflowId: string) => Promise<boolean>;
  };
};

export type ControlInput = {
  readonly workflowRunId: string;
  readonly reasonCode: WorkflowLifecycleReasonCode;
  readonly occurredAt: number;
};

export class WorkflowLifecycleControlError extends Data.TaggedError(
  "WorkflowLifecycleControlError",
)<{
  readonly code:
    | "UNAVAILABLE"
    | "VALIDATION_FAILED"
    | "INVALID_STATE"
    | "RESTART_UNSAFE"
    | "COMPONENT_REJECTED";
  readonly message: string;
}> {}

export const cancelWorkflowLifecycle = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  input: ControlInput,
) => {
  const run = await ownedRun(ports, principal, "cancel", input.workflowRunId);
  validControlInput(input);
  const next = transition(run.state, {
    kind: "mark-canceled",
    ...guard(run),
  });
  await componentCall(() => ports.component.cancel(run.componentWorkflowId));
  await ports.saveLifecycleState(run.workflowRunId, next);
  await ports.appendAudit(audit(principal, run, next, input, "cancel", 0));
  return { status: "canceled" as const, actionMayFinish: true as const };
};

export const authorized = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  operation: WorkflowLifecycleOperation,
) => {
  if (!(await ports.authorize(principal, operation))) throw unavailable();
};

export const ownedRun = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  operation: WorkflowLifecycleOperation,
  workflowRunId: string,
) => {
  await authorized(ports, principal, operation);
  const run = await ports.loadOwnedRun(principal.workspaceId, workflowRunId);
  if (!run || run.state.workspaceId !== principal.workspaceId)
    throw unavailable();
  return run;
};

export const guard = (run: WorkflowLifecycleOwnedRun) => ({
  workspaceId: run.state.workspaceId,
  workflowRunId: run.workflowRunId,
  generation: run.state.generation,
});

export const transition = (
  state: WorkflowLifecycleState,
  command: Parameters<typeof transitionWorkflowLifecycle>[1],
) => {
  const result = transitionWorkflowLifecycle(state, command);
  if (Result.isFailure(result)) {
    throw controlError("INVALID_STATE", result.failure.reason);
  }
  return result.success;
};

export const validControlInput = (input: ControlInput): void => {
  if (!Number.isFinite(input.occurredAt) || input.occurredAt < 0) {
    throw controlError(
      "VALIDATION_FAILED",
      "Lifecycle occurrence time is invalid.",
    );
  }
  if (!REASON_CODES.has(input.reasonCode)) {
    throw controlError(
      "VALIDATION_FAILED",
      "Lifecycle reason code is invalid.",
    );
  }
};

const REASON_CODES: ReadonlySet<string> = new Set([
  "operator-request",
  "recovery",
  "policy-change",
  "retention-sweep",
]);

export const audit = (
  principal: WorkflowLifecyclePrincipal,
  run: WorkflowLifecycleOwnedRun,
  state: WorkflowLifecycleState,
  input: ControlInput,
  operation: "cancel" | "restart" | "cleanup",
  discardedStepCount: number,
): WorkflowLifecycleAuditEvent => ({
  type: `workflow.${operation}.requested`,
  workspaceId: principal.workspaceId,
  workflowRunId: run.workflowRunId,
  workflowId: state.workflowId,
  workflowVersion: state.workflowVersion,
  generation: state.generation,
  actorId: principal.actorId,
  authority: principal.authority,
  reasonCode: input.reasonCode,
  occurredAt: input.occurredAt,
  discardedStepCount,
  redacted: true,
});

const unavailable = () =>
  controlError("UNAVAILABLE", "Workflow lifecycle resource is unavailable.");

export const controlError = (
  code: WorkflowLifecycleControlError["code"],
  message: string,
) => new WorkflowLifecycleControlError({ code, message });

export const componentCall = async <Result>(run: () => Promise<Result>) => {
  try {
    return await run();
  } catch {
    throw controlError(
      "COMPONENT_REJECTED",
      "Workflow component lifecycle operation failed.",
    );
  }
};
