import * as Data from "effect/Data";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import {
  transitionWorkflowLifecycle,
  type WorkflowLifecycleState,
} from "./lifecycleState";
import { WorkflowStepName } from "./workflowReferences";

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

type PaginationInput = {
  readonly cursor: string | null;
  readonly limit: number;
};

type Page<Row> = {
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
  readonly component: {
    readonly cancel: (componentWorkflowId: string) => Promise<void>;
    readonly restart: (
      componentWorkflowId: string,
      options: { readonly from: 0 | string; readonly startAsync: true },
    ) => Promise<void>;
    readonly cleanup: (componentWorkflowId: string) => Promise<boolean>;
  };
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

export const createWorkflowLifecycleControls = (
  ports: WorkflowLifecycleControlPorts,
) => ({
  cancel: async (
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
  },

  restart: async (
    principal: WorkflowLifecyclePrincipal,
    input: ControlInput & { readonly restartAnchor: string },
  ) => {
    const run = await ownedRun(
      ports,
      principal,
      "restart",
      input.workflowRunId,
    );
    validControlInput(input);
    const restartAnchor = decodeRestartAnchor(input.restartAnchor);
    const next = transition(run.state, {
      kind: "advance-generation",
      ...guard(run),
      nextGeneration: run.state.generation + 1,
      restartAnchor,
    });
    const inspection = await ports.inspectRestart({
      workspaceId: principal.workspaceId,
      workflowRunId: run.workflowRunId,
      generation: run.state.generation,
      restartAnchor,
    });
    const discardedSteps = inspection.discardedSteps.map(decodeStepName);
    for (const effect of inspection.externalEffects)
      decodeStepName(effect.stepName);
    if (
      inspection.externalEffects.some(
        (effect) => !restartSafe(effect, input.occurredAt),
      )
    ) {
      throw controlError(
        "RESTART_UNSAFE",
        "Workflow restart contains an external effect without a sufficient restart-safe dedupe horizon.",
      );
    }
    await componentCall(() =>
      ports.component.restart(run.componentWorkflowId, {
        from: restartAnchor === "beginning" ? 0 : restartAnchor,
        startAsync: true,
      }),
    );
    await ports.saveLifecycleState(run.workflowRunId, next);
    await ports.appendAudit(
      audit(principal, run, next, input, "restart", discardedSteps.length),
    );
    return {
      generation: next.generation,
      discardedSteps,
    };
  },

  list: async (
    principal: WorkflowLifecyclePrincipal,
    pagination: PaginationInput,
  ) => {
    await authorized(ports, principal, "list");
    const page = await ports.listOwnedRuns(
      principal.workspaceId,
      validPagination(pagination),
    );
    return mapPage(page, pagination.limit, projectRun);
  },

  listByName: async (
    principal: WorkflowLifecyclePrincipal,
    input: PaginationInput & { readonly workflowName: string },
  ) => {
    await authorized(ports, principal, "listByName");
    if (!input.workflowName || input.workflowName.length > 128) {
      throw controlError("VALIDATION_FAILED", "Workflow name is invalid.");
    }
    const page = await ports.listOwnedRunsByName(
      principal.workspaceId,
      input.workflowName,
      validPagination(input),
    );
    return mapPage(page, input.limit, projectRun);
  },

  listSteps: async (
    principal: WorkflowLifecyclePrincipal,
    input: PaginationInput & { readonly workflowRunId: string },
  ) => {
    const run = await ownedRun(
      ports,
      principal,
      "listSteps",
      input.workflowRunId,
    );
    const page = await ports.listOwnedSteps(
      principal.workspaceId,
      run.workflowRunId,
      run.state.generation,
      validPagination(input),
    );
    return mapPage(page, input.limit, projectStep);
  },

  cleanup: async (
    principal: WorkflowLifecyclePrincipal,
    input: ControlInput,
  ) => {
    const run = await ownedRun(
      ports,
      principal,
      "cleanup",
      input.workflowRunId,
    );
    validControlInput(input);
    let next = transition(run.state, {
      kind: "request-cleanup",
      ...guard(run),
      now: input.occurredAt,
    });
    next = transition(next, { kind: "begin-product-cleanup", ...guard(run) });
    next = transition(next, {
      kind: "request-component-cleanup",
      ...guard(run),
    });
    const accepted = await componentCall(() =>
      ports.component.cleanup(run.componentWorkflowId),
    );
    if (!accepted) {
      throw controlError(
        "COMPONENT_REJECTED",
        "Workflow component did not accept the cleanup request.",
      );
    }
    await ports.saveLifecycleState(run.workflowRunId, next);
    await ports.appendAudit(audit(principal, run, next, input, "cleanup", 0));
    return {
      status: "component-cleanup-requested" as const,
      fullDeletionProven: false as const,
    };
  },
});

type ControlInput = {
  readonly workflowRunId: string;
  readonly reasonCode: WorkflowLifecycleReasonCode;
  readonly occurredAt: number;
};

const authorized = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  operation: WorkflowLifecycleOperation,
) => {
  if (!(await ports.authorize(principal, operation))) throw unavailable();
};

const ownedRun = async (
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

const guard = (run: WorkflowLifecycleOwnedRun) => ({
  workspaceId: run.state.workspaceId,
  workflowRunId: run.workflowRunId,
  generation: run.state.generation,
});

const transition = (
  state: WorkflowLifecycleState,
  command: Parameters<typeof transitionWorkflowLifecycle>[1],
) => {
  const result = transitionWorkflowLifecycle(state, command);
  if (Either.isLeft(result)) {
    throw controlError("INVALID_STATE", result.left.reason);
  }
  return result.right;
};

const restartSafe = (
  effect: WorkflowRestartInspection["externalEffects"][number],
  occurredAt: number,
) =>
  effect.restartSafe &&
  Number.isFinite(effect.restartSafeUntil) &&
  Number.isFinite(effect.dedupeExpiresAt) &&
  effect.restartSafeUntil >= occurredAt &&
  effect.dedupeExpiresAt >= effect.restartSafeUntil;

const decodeRestartAnchor = (input: string) => {
  if (input === "beginning") return input;
  try {
    return Schema.decodeSync(WorkflowStepName)(input);
  } catch {
    throw controlError(
      "VALIDATION_FAILED",
      "Restart anchor must be beginning or a stable versioned step name.",
    );
  }
};

const decodeStepName = (input: string) => {
  try {
    return Schema.decodeSync(WorkflowStepName)(input);
  } catch {
    throw controlError(
      "VALIDATION_FAILED",
      "Lifecycle preflight returned an unstable step name.",
    );
  }
};

const validControlInput = (input: ControlInput): void => {
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

const validPagination = (input: PaginationInput): PaginationInput => {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw controlError(
      "VALIDATION_FAILED",
      "Pagination limit must be 1 through 100.",
    );
  }
  return { cursor: input.cursor, limit: input.limit };
};

const mapPage = <Input, Output>(
  page: Page<Input>,
  limit: number,
  map: (row: Input) => Output,
) => {
  if (page.page.length > limit) {
    throw controlError(
      "VALIDATION_FAILED",
      "Lifecycle page exceeds its requested bound.",
    );
  }
  return {
    page: page.page.map(map),
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  };
};

const projectRun = (row: WorkflowRunProjectionSource) => ({
  workflowRunId: row.workflowRunId,
  workflowName: row.workflowName,
  workflowId: row.workflowId,
  workflowVersion: row.workflowVersion,
  status: row.status,
  generation: row.generation,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
});

const projectStep = (row: WorkflowStepProjectionSource) => ({
  stepName: row.stepName,
  status: row.status,
  attempt: row.attempt,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  errorCode: row.errorCode,
});

const audit = (
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

const controlError = (
  code: WorkflowLifecycleControlError["code"],
  message: string,
) => new WorkflowLifecycleControlError({ code, message });

const componentCall = async <Result>(run: () => Promise<Result>) => {
  try {
    return await run();
  } catch {
    throw controlError(
      "COMPONENT_REJECTED",
      "Workflow component lifecycle operation failed.",
    );
  }
};
