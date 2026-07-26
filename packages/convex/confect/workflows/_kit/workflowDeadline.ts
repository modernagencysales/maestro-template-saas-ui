import * as Data from "effect/Data";
import * as Either from "effect/Either";

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Pinned Workpool 0.4.7 silently clamps schedules beyond four years. */
export const MAX_WORKFLOW_DEADLINE_HORIZON_MS = 4 * 365 * DAY_MS;

export type WorkflowDeadlineExecution = "active" | "terminal" | "canceled";

export type WorkflowDeadlineGeneration = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly generation: number;
};

export type WorkflowDeadlineScheduleIdentity = WorkflowDeadlineGeneration & {
  readonly scheduleKey: string;
};

export type WorkflowDeadlineSchedule = {
  readonly identity: WorkflowDeadlineScheduleIdentity;
  readonly requestedAt: number;
  readonly horizonMs: number;
  readonly deadlineAt: number;
  readonly runAt: number;
};

export type WorkflowDeadlineRunSnapshot = WorkflowDeadlineGeneration & {
  readonly execution: WorkflowDeadlineExecution;
  readonly deadlineSchedule: WorkflowDeadlineSchedule | null;
};

export type WorkflowDeadlineStartFacts = {
  readonly requestedStartAt: number;
  readonly actualStartedAt: number;
  readonly deadlineAt: number;
  readonly latenessMs: number;
  readonly expired: boolean;
  readonly expiredByMs: number;
};

export type WorkflowDeadlineNoOpReason =
  | "terminal-run"
  | "stale-generation"
  | "stale-schedule"
  | "deadline-not-reached";

export type WorkflowDeadlineScheduleDecision = {
  readonly kind: "schedule";
  readonly schedule: WorkflowDeadlineSchedule;
};

export type WorkflowDeadlineCancelDecision = {
  readonly kind: "cancel";
  readonly schedule: WorkflowDeadlineSchedule;
  readonly facts: WorkflowDeadlineStartFacts;
};

export type WorkflowDeadlineNoOpDecision = {
  readonly kind: "no-op";
  readonly reason: WorkflowDeadlineNoOpReason;
  readonly schedule: WorkflowDeadlineScheduleIdentity;
  readonly facts: WorkflowDeadlineStartFacts | null;
};

export type WorkflowDeadlineDecision =
  | WorkflowDeadlineScheduleDecision
  | WorkflowDeadlineCancelDecision
  | WorkflowDeadlineNoOpDecision;

export type WorkflowDeadlineSchedulePlan =
  WorkflowDeadlineScheduleDecision | WorkflowDeadlineNoOpDecision;

export type WorkflowDeadlineCallbackPlan =
  WorkflowDeadlineCancelDecision | WorkflowDeadlineNoOpDecision;

export type WorkflowDeadlineContractErrorCode =
  | "INVALID_GENERATION_IDENTITY"
  | "INVALID_EXECUTION"
  | "INVALID_DEADLINE_HORIZON"
  | "UNSUPPORTED_DEADLINE_HORIZON"
  | "INVALID_TIME"
  | "DEADLINE_OVERFLOW"
  | "INVALID_SCHEDULE";

export class WorkflowDeadlineContractError extends Data.TaggedError(
  "WorkflowDeadlineContractError",
)<{
  readonly code: WorkflowDeadlineContractErrorCode;
  readonly message: string;
}> {}

export const deriveWorkflowDeadlineScheduleIdentity = (
  generation: WorkflowDeadlineGeneration,
): WorkflowDeadlineScheduleIdentity => ({
  ...generation,
  scheduleKey: [
    "workflow-deadline.v1",
    generation.workspaceId,
    generation.workflowRunId,
    generation.workflowId,
    String(generation.workflowVersion),
    String(generation.generation),
  ]
    .map(lengthPrefixed)
    .join("|"),
});

export const planWorkflowDeadlineSchedule = (input: {
  readonly generation: WorkflowDeadlineGeneration;
  readonly execution: WorkflowDeadlineExecution;
  readonly requestedAt: number;
  readonly horizonMs: number;
}): Either.Either<
  WorkflowDeadlineSchedulePlan,
  WorkflowDeadlineContractError
> => {
  const identityFinding = validateGeneration(input.generation);
  if (identityFinding) return identityFinding;
  const executionFinding = validateExecution(input.execution);
  if (executionFinding) return executionFinding;
  const identity = deriveWorkflowDeadlineScheduleIdentity(input.generation);
  if (input.execution !== "active") {
    return Either.right({
      kind: "no-op",
      reason: "terminal-run",
      schedule: identity,
      facts: null,
    });
  }
  const requestedAtFinding = validateTime(input.requestedAt);
  if (requestedAtFinding) return requestedAtFinding;
  const horizonFinding = validateHorizon(input.horizonMs);
  if (horizonFinding) return horizonFinding;

  const deadlineAt = input.requestedAt + input.horizonMs;
  if (!Number.isSafeInteger(deadlineAt)) {
    return fail(
      "DEADLINE_OVERFLOW",
      "Workflow deadline timestamp exceeds the supported numeric range.",
    );
  }
  return Either.right({
    kind: "schedule",
    schedule: {
      identity,
      requestedAt: input.requestedAt,
      horizonMs: input.horizonMs,
      deadlineAt,
      runAt: deadlineAt,
    },
  });
};

export const planWorkflowDeadlineCallback = (input: {
  readonly callbackSchedule: WorkflowDeadlineSchedule;
  readonly currentRun: WorkflowDeadlineRunSnapshot;
  readonly actualStartedAt: number;
}): Either.Either<
  WorkflowDeadlineCallbackPlan,
  WorkflowDeadlineContractError
> => {
  const callbackFinding = validateSchedule(input.callbackSchedule);
  if (callbackFinding) return callbackFinding;
  const currentGenerationFinding = validateGeneration(input.currentRun);
  if (currentGenerationFinding) return currentGenerationFinding;
  const executionFinding = validateExecution(input.currentRun.execution);
  if (executionFinding) return executionFinding;

  const factsResult = observeWorkflowDeadlineStart({
    requestedStartAt: input.callbackSchedule.runAt,
    actualStartedAt: input.actualStartedAt,
    deadlineAt: input.callbackSchedule.deadlineAt,
  });
  if (Either.isLeft(factsResult)) return Either.left(factsResult.left);
  const facts = factsResult.right;
  const callbackIdentity = input.callbackSchedule.identity;

  if (!sameGeneration(callbackIdentity, input.currentRun)) {
    return noOp("stale-generation", callbackIdentity, facts);
  }
  if (input.currentRun.execution !== "active") {
    return noOp("terminal-run", callbackIdentity, facts);
  }
  if (input.currentRun.deadlineSchedule !== null) {
    const currentScheduleFinding = validateSchedule(
      input.currentRun.deadlineSchedule,
    );
    if (currentScheduleFinding) return currentScheduleFinding;
  }
  if (
    input.currentRun.deadlineSchedule === null ||
    !sameSchedule(input.callbackSchedule, input.currentRun.deadlineSchedule)
  ) {
    return noOp("stale-schedule", callbackIdentity, facts);
  }
  if (!facts.expired) {
    return noOp("deadline-not-reached", callbackIdentity, facts);
  }

  return Either.right({
    kind: "cancel",
    schedule: input.callbackSchedule,
    facts,
  });
};

export const observeWorkflowDeadlineStart = (input: {
  readonly requestedStartAt: number;
  readonly actualStartedAt: number;
  readonly deadlineAt: number;
}): Either.Either<
  WorkflowDeadlineStartFacts,
  WorkflowDeadlineContractError
> => {
  for (const time of [
    input.requestedStartAt,
    input.actualStartedAt,
    input.deadlineAt,
  ]) {
    const finding = validateTime(time);
    if (finding) return finding;
  }

  return Either.right({
    requestedStartAt: input.requestedStartAt,
    actualStartedAt: input.actualStartedAt,
    deadlineAt: input.deadlineAt,
    latenessMs: Math.max(0, input.actualStartedAt - input.requestedStartAt),
    expired: input.actualStartedAt >= input.deadlineAt,
    expiredByMs: Math.max(0, input.actualStartedAt - input.deadlineAt),
  });
};

const validateGeneration = (
  generation: WorkflowDeadlineGeneration,
): Either.Either<never, WorkflowDeadlineContractError> | undefined =>
  [
    generation.workspaceId,
    generation.workflowRunId,
    generation.workflowId,
  ].some((value) => typeof value !== "string" || value.length === 0) ||
  !isNonNegativeSafeInteger(generation.workflowVersion) ||
  !isNonNegativeSafeInteger(generation.generation)
    ? fail(
        "INVALID_GENERATION_IDENTITY",
        "Workflow deadline generation identity is invalid.",
      )
    : undefined;

const validateExecution = (
  execution: WorkflowDeadlineExecution,
): Either.Either<never, WorkflowDeadlineContractError> | undefined =>
  execution === "active" || execution === "terminal" || execution === "canceled"
    ? undefined
    : fail(
        "INVALID_EXECUTION",
        "Workflow deadline execution state is invalid.",
      );

const validateHorizon = (
  horizonMs: number,
): Either.Either<never, WorkflowDeadlineContractError> | undefined => {
  if (!isNonNegativeSafeInteger(horizonMs)) {
    return fail(
      "INVALID_DEADLINE_HORIZON",
      "Workflow deadline horizon must be a finite nonnegative integer.",
    );
  }
  return horizonMs > MAX_WORKFLOW_DEADLINE_HORIZON_MS
    ? fail(
        "UNSUPPORTED_DEADLINE_HORIZON",
        "Workflow deadline horizon exceeds the supported scheduler boundary.",
      )
    : undefined;
};

const validateTime = (
  time: number,
): Either.Either<never, WorkflowDeadlineContractError> | undefined =>
  isNonNegativeSafeInteger(time)
    ? undefined
    : fail(
        "INVALID_TIME",
        "Workflow deadline time must be a finite nonnegative integer.",
      );

const validateSchedule = (
  schedule: WorkflowDeadlineSchedule,
): Either.Either<never, WorkflowDeadlineContractError> | undefined => {
  const identityFinding = validateGeneration(schedule.identity);
  if (identityFinding) return identityFinding;
  const expectedIdentity = deriveWorkflowDeadlineScheduleIdentity(
    schedule.identity,
  );
  if (schedule.identity.scheduleKey !== expectedIdentity.scheduleKey) {
    return invalidSchedule();
  }
  for (const time of [
    schedule.requestedAt,
    schedule.deadlineAt,
    schedule.runAt,
  ]) {
    if (!isNonNegativeSafeInteger(time)) return invalidSchedule();
  }
  if (
    !isNonNegativeSafeInteger(schedule.horizonMs) ||
    schedule.horizonMs > MAX_WORKFLOW_DEADLINE_HORIZON_MS ||
    schedule.requestedAt + schedule.horizonMs !== schedule.deadlineAt ||
    schedule.runAt !== schedule.deadlineAt
  ) {
    return invalidSchedule();
  }
  return undefined;
};

const sameGeneration = (
  left: WorkflowDeadlineGeneration,
  right: WorkflowDeadlineGeneration,
): boolean =>
  left.workspaceId === right.workspaceId &&
  left.workflowRunId === right.workflowRunId &&
  left.workflowId === right.workflowId &&
  left.workflowVersion === right.workflowVersion &&
  left.generation === right.generation;

const sameSchedule = (
  left: WorkflowDeadlineSchedule,
  right: WorkflowDeadlineSchedule,
): boolean =>
  sameGeneration(left.identity, right.identity) &&
  left.identity.scheduleKey === right.identity.scheduleKey &&
  left.requestedAt === right.requestedAt &&
  left.horizonMs === right.horizonMs &&
  left.deadlineAt === right.deadlineAt &&
  left.runAt === right.runAt;

const noOp = (
  reason: WorkflowDeadlineNoOpReason,
  schedule: WorkflowDeadlineScheduleIdentity,
  facts: WorkflowDeadlineStartFacts,
): Either.Either<WorkflowDeadlineCallbackPlan, WorkflowDeadlineContractError> =>
  Either.right({ kind: "no-op", reason, schedule, facts });

const invalidSchedule = () =>
  fail(
    "INVALID_SCHEDULE",
    "Workflow deadline schedule does not match its generation contract.",
  );

const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const lengthPrefixed = (value: string): string => `${value.length}:${value}`;

const fail = (
  code: WorkflowDeadlineContractErrorCode,
  message: string,
): Either.Either<never, WorkflowDeadlineContractError> =>
  Either.left(new WorkflowDeadlineContractError({ code, message }));
