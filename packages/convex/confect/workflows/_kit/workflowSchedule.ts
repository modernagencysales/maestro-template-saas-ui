import * as Data from "effect/Data";
import * as Result from "effect/Result";

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Pinned Workpool 0.4.7 clamps schedules beyond this future horizon. */
export const MAX_WORKFLOW_SCHEDULE_HORIZON_MS = 4 * 365 * DAY_MS;

export type WorkflowScheduleInput =
  | { readonly kind: "runAfter"; readonly delayMs: number }
  | { readonly kind: "runAt"; readonly timestamp: number };

export type WorkflowScheduleOptions =
  | { readonly runAfter: number; readonly runAt?: never }
  | { readonly runAt: number; readonly runAfter?: never };

export type WorkflowScheduleErrorCode =
  | "INVALID_SCHEDULE_CLOCK"
  | "INVALID_SCHEDULE_TIME"
  | "SCHEDULE_IN_PAST"
  | "UNSUPPORTED_SCHEDULE_HORIZON"
  | "SCHEDULE_OVERFLOW";

export class WorkflowScheduleError extends Data.TaggedError(
  "WorkflowScheduleError",
)<{
  readonly code: WorkflowScheduleErrorCode;
  readonly message: string;
}> {}

/** Compile one not-before request without ambient time reads or clamping. */
export const compileWorkflowSchedule = (
  schedule: WorkflowScheduleInput,
  nowMs: number,
): Result.Result<WorkflowScheduleOptions, WorkflowScheduleError> => {
  if (!isNonNegativeSafeInteger(nowMs)) {
    return fail(
      "INVALID_SCHEDULE_CLOCK",
      "Workflow schedule clock must be a finite nonnegative safe integer.",
    );
  }
  if (schedule.kind === "runAfter") {
    if (!isPositiveSafeInteger(schedule.delayMs)) {
      return fail(
        "INVALID_SCHEDULE_TIME",
        "runAfter delay must be a finite positive safe integer.",
      );
    }
    if (schedule.delayMs > MAX_WORKFLOW_SCHEDULE_HORIZON_MS) {
      return unsupportedHorizon();
    }
    if (!Number.isSafeInteger(nowMs + schedule.delayMs)) {
      return fail(
        "SCHEDULE_OVERFLOW",
        "Workflow schedule timestamp exceeds the supported numeric range.",
      );
    }
    return Result.succeed({ runAfter: schedule.delayMs });
  }
  if (!isNonNegativeSafeInteger(schedule.timestamp)) {
    return fail(
      "INVALID_SCHEDULE_TIME",
      "runAt timestamp must be a finite nonnegative safe integer.",
    );
  }
  if (schedule.timestamp < nowMs) {
    return fail(
      "SCHEDULE_IN_PAST",
      "runAt timestamp is earlier than the workflow dispatch clock.",
    );
  }
  if (schedule.timestamp - nowMs > MAX_WORKFLOW_SCHEDULE_HORIZON_MS) {
    return unsupportedHorizon();
  }
  return Result.succeed({ runAt: schedule.timestamp });
};

export const assertWorkflowSchedule = (
  schedule: WorkflowScheduleInput,
  nowMs: number,
): WorkflowScheduleOptions => {
  const result = compileWorkflowSchedule(schedule, nowMs);
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

export const unsupportedScheduledNodeFinding = (node: {
  readonly id: string;
  readonly kind: string;
  readonly schedule?: WorkflowScheduleInput | undefined;
  readonly functionKind?: string | undefined;
  readonly transaction?: { readonly kind: string } | undefined;
}): string | undefined => {
  if (node.schedule === undefined) return undefined;
  if (
    node.kind === "capability" &&
    (node.functionKind === "action" ||
      ((node.functionKind === "query" || node.functionKind === "mutation") &&
        node.transaction?.kind === "independent"))
  ) {
    return undefined;
  }
  if (node.kind === "subworkflow") return undefined;
  return `node ${node.id} cannot use ${node.schedule.kind}; scheduling is supported only for action and independent query/mutation capability nodes`;
};

const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const unsupportedHorizon = () =>
  fail(
    "UNSUPPORTED_SCHEDULE_HORIZON",
    "Workflow schedule exceeds the supported Workpool horizon.",
  );

const fail = (code: WorkflowScheduleErrorCode, message: string) =>
  Result.fail(new WorkflowScheduleError({ code, message }));
