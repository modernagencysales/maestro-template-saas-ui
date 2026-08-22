import type { WorkflowStatus } from "@convex-dev/workflow";
import * as S from "effect/Schema";

import { WorkflowRunStatus } from "../../tables/workflowRuns";
import {
  WorkflowComponentCleanupState,
  WorkflowComponentResidualState,
  WorkflowGenerationQuiescence,
  WorkflowLifecycleExecution,
  WorkflowProductCleanupState,
} from "./lifecycleState";

export const WorkflowLifecycleStatus = S.Struct({
  execution: WorkflowLifecycleExecution,
  generation: S.Number.pipe(
    S.check(S.isInt()),
    S.check(S.isGreaterThanOrEqualTo(0)),
  ),
  priorGenerationQuiescence: WorkflowGenerationQuiescence,
  cleanup: WorkflowProductCleanupState,
  componentCleanup: WorkflowComponentCleanupState,
  componentResiduals: WorkflowComponentResidualState,
});

export const WorkflowStatusResult = S.Struct({
  status: WorkflowRunStatus,
  componentStatus: S.optional(
    S.Literals(["inProgress", "completed", "failed", "canceled"]),
  ),
  result: S.optional(S.Unknown),
  error: S.optional(S.String),
  running: S.optional(S.Array(S.Unknown)),
  lifecycle: S.optional(WorkflowLifecycleStatus),
  timeout: S.optional(
    S.Struct({
      deadlineAt: S.optional(S.NullOr(S.Number)),
      timedOutAt: S.optional(S.NullOr(S.Number)),
      errorCode: S.optional(S.NullOr(S.String)),
      summary: S.optional(S.NullOr(S.String)),
    }),
  ),
});

export type WorkflowStatusResult = S.Schema.Type<typeof WorkflowStatusResult>;

export type WorkflowStatusRunProjection = {
  readonly status?: S.Schema.Type<typeof WorkflowRunStatus>;
  readonly deadlineAt?: number | null;
  readonly timedOutAt?: number | null;
  readonly timeoutErrorCode?: string | null;
  readonly timeoutSummary?: string | null;
  readonly lifecycleExecution?: S.Schema.Type<
    typeof WorkflowLifecycleExecution
  > | null;
  readonly lifecycleGeneration?: number | null;
  readonly priorGenerationQuiescence?: S.Schema.Type<
    typeof WorkflowGenerationQuiescence
  > | null;
  readonly cleanupState?: S.Schema.Type<
    typeof WorkflowProductCleanupState
  > | null;
  readonly componentCleanupState?: S.Schema.Type<
    typeof WorkflowComponentCleanupState
  > | null;
  readonly componentResidualState?: S.Schema.Type<
    typeof WorkflowComponentResidualState
  > | null;
};

type ComponentWorkflowStatusBlob = {
  readonly type?: unknown;
  readonly result?: unknown;
  readonly error?: unknown;
  readonly running?: unknown[];
};

const isKnownComponentStatus = (
  status: unknown,
): status is NonNullable<WorkflowStatusResult["componentStatus"]> =>
  status === "inProgress" ||
  status === "completed" ||
  status === "failed" ||
  status === "canceled";

export const projectWorkflowStatus = (
  value: WorkflowStatus | null | undefined,
  run?: WorkflowStatusRunProjection | null,
): WorkflowStatusResult =>
  isTimedOutRun(run)
    ? projectTimedOutWorkflowStatus(value, run)
    : projectLiveWorkflowStatus(value, run);

const isTimedOutRun = (
  run: WorkflowStatusRunProjection | null | undefined,
): run is WorkflowStatusRunProjection =>
  run?.status === "timedOut" || run?.timedOutAt != null;

const projectTimedOutWorkflowStatus = (
  value: WorkflowStatus | null | undefined,
  run: WorkflowStatusRunProjection,
): WorkflowStatusResult => ({
  status: "timedOut",
  ...componentStatusFields(value as ComponentWorkflowStatusBlob | null),
  ...lifecycleStatusFields(run),
  timeout: {
    deadlineAt: run.deadlineAt,
    timedOutAt: run.timedOutAt,
    errorCode: run.timeoutErrorCode,
    summary: run.timeoutSummary,
  },
});

const projectLiveWorkflowStatus = (
  value: WorkflowStatus | null | undefined,
  run?: WorkflowStatusRunProjection | null,
): WorkflowStatusResult => {
  if (!value) {
    return { status: run?.status ?? "queued", ...lifecycleStatusFields(run) };
  }
  return projectComponentWorkflowStatus(
    value as ComponentWorkflowStatusBlob,
    run,
  );
};

const projectComponentWorkflowStatus = (
  component: ComponentWorkflowStatusBlob,
  run?: WorkflowStatusRunProjection | null,
): WorkflowStatusResult => {
  const projections: Readonly<Record<string, () => WorkflowStatusResult>> = {
    inProgress: () => ({
      status: run?.status === "queued" ? "queued" : "running",
      componentStatus: "inProgress",
      running: Array.isArray(component.running) ? component.running : [],
      ...lifecycleStatusFields(run),
    }),
    completed: () => ({
      status: "completed",
      componentStatus: "completed",
      result: component.result,
      ...lifecycleStatusFields(run),
    }),
    failed: () => ({
      status: "failed",
      componentStatus: "failed",
      error: typeof component.error === "string" ? component.error : "",
      ...lifecycleStatusFields(run),
    }),
    canceled: () => ({
      status: "canceled",
      componentStatus: "canceled",
      ...lifecycleStatusFields(run),
    }),
  };

  return (
    projections[String(component.type)]?.() ?? {
      status: run?.status ?? "queued",
      ...lifecycleStatusFields(run),
    }
  );
};

const lifecycleStatusFields = (
  run: WorkflowStatusRunProjection | null | undefined,
): Pick<WorkflowStatusResult, "lifecycle"> | Record<never, never> =>
  run?.lifecycleExecution != null &&
  run.lifecycleGeneration != null &&
  run.priorGenerationQuiescence != null &&
  run.cleanupState != null &&
  run.componentCleanupState != null
    ? {
        lifecycle: {
          execution: run.lifecycleExecution,
          generation: run.lifecycleGeneration,
          priorGenerationQuiescence: run.priorGenerationQuiescence,
          cleanup: run.cleanupState,
          componentCleanup: run.componentCleanupState,
          componentResiduals: run.componentResidualState ?? "not-assessed",
        },
      }
    : {};

const componentStatusFields = (
  component: ComponentWorkflowStatusBlob | null | undefined,
): Partial<WorkflowStatusResult> => {
  const status = component?.type;
  return {
    ...(isKnownComponentStatus(status) ? { componentStatus: status } : {}),
    ...(status === "completed" ? { result: component?.result } : {}),
    ...(status === "failed" && typeof component?.error === "string"
      ? { error: component.error }
      : {}),
    ...(status === "inProgress" && Array.isArray(component?.running)
      ? { running: component.running }
      : {}),
  };
};
