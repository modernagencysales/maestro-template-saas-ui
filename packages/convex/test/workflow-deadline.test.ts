import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  MAX_WORKFLOW_DEADLINE_HORIZON_MS,
  deriveWorkflowDeadlineScheduleIdentity,
  observeWorkflowDeadlineStart,
  planWorkflowDeadlineCallback,
  planWorkflowDeadlineRestart,
  planWorkflowDeadlineSchedule,
  type WorkflowDeadlineGeneration,
  type WorkflowDeadlineRunSnapshot,
  type WorkflowDeadlineSchedule,
} from "../confect/workflows/_kit/workflowDeadline";

const generation = (value = 0): WorkflowDeadlineGeneration => ({
  workspaceId: "workspace-a",
  workflowRunId: "run-a",
  workflowId: "workflow.invoice",
  workflowVersion: 3,
  generation: value,
});

const scheduleFor = (
  currentGeneration = generation(),
  requestedAt = 1_000,
  horizonMs = 500,
): WorkflowDeadlineSchedule => {
  const decision = Result.getOrThrow(
    planWorkflowDeadlineSchedule({
      generation: currentGeneration,
      execution: "active",
      requestedAt,
      horizonMs,
    }),
  );
  if (decision.kind !== "schedule") {
    throw new Error("expected a schedule decision");
  }
  return decision.schedule;
};

const runSnapshot = (
  schedule: WorkflowDeadlineSchedule,
  overrides: Partial<WorkflowDeadlineRunSnapshot> = {},
): WorkflowDeadlineRunSnapshot => ({
  ...generation(schedule.identity.generation),
  execution: "active",
  deadlineSchedule: schedule,
  ...overrides,
});

describe("generation-safe workflow deadlines", () => {
  it("derives deterministic generation-keyed schedule identity", () => {
    const first = deriveWorkflowDeadlineScheduleIdentity(generation());
    const replay = deriveWorkflowDeadlineScheduleIdentity(generation());
    const restarted = deriveWorkflowDeadlineScheduleIdentity(generation(1));

    expect(first).toEqual(replay);
    expect(first.scheduleKey).not.toBe(restarted.scheduleKey);
    expect(first).toMatchObject({
      workflowRunId: "run-a",
      workflowVersion: 3,
      generation: 0,
    });
  });

  it("accepts the exact finite horizon boundary without clamping", () => {
    const requestedAt = 1_000;
    const decision = Result.getOrThrow(
      planWorkflowDeadlineSchedule({
        generation: generation(),
        execution: "active",
        requestedAt,
        horizonMs: MAX_WORKFLOW_DEADLINE_HORIZON_MS,
      }),
    );

    expect(decision).toMatchObject({
      kind: "schedule",
      schedule: {
        requestedAt,
        horizonMs: MAX_WORKFLOW_DEADLINE_HORIZON_MS,
        deadlineAt: requestedAt + MAX_WORKFLOW_DEADLINE_HORIZON_MS,
        runAt: requestedAt + MAX_WORKFLOW_DEADLINE_HORIZON_MS,
      },
    });
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    1.5,
    MAX_WORKFLOW_DEADLINE_HORIZON_MS + 1,
  ])("rejects unsupported horizon %s instead of clamping it", (horizonMs) => {
    const result = planWorkflowDeadlineSchedule({
      generation: generation(),
      execution: "active",
      requestedAt: 1_000,
      horizonMs,
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("returns a typed no-op instead of scheduling a terminal run", () => {
    const decision = Result.getOrThrow(
      planWorkflowDeadlineSchedule({
        generation: generation(),
        execution: "terminal",
        requestedAt: 1_000,
        horizonMs: 500,
      }),
    );

    expect(decision).toEqual({
      kind: "no-op",
      reason: "terminal-run",
      schedule: deriveWorkflowDeadlineScheduleIdentity(generation()),
      facts: null,
    });
  });

  it("cancels only the exact active generation schedule after expiry", () => {
    const schedule = scheduleFor();
    const decision = Result.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule: schedule,
        currentRun: runSnapshot(schedule),
        actualStartedAt: 1_525,
      }),
    );

    expect(decision).toEqual({
      kind: "cancel",
      schedule,
      facts: {
        requestedStartAt: 1_500,
        actualStartedAt: 1_525,
        deadlineAt: 1_500,
        latenessMs: 25,
        expired: true,
        expiredByMs: 25,
      },
    });
  });

  it("makes a prior-generation callback a no-op after restart", () => {
    const priorSchedule = scheduleFor(generation(0));
    const restartedSchedule = scheduleFor(generation(1));
    const decision = Result.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule: priorSchedule,
        currentRun: runSnapshot(restartedSchedule),
        actualStartedAt: 2_000,
      }),
    );

    expect(decision).toMatchObject({
      kind: "no-op",
      reason: "stale-generation",
      schedule: priorSchedule.identity,
    });
    expect(decision).not.toHaveProperty("completion");
  });

  it("makes callbacks for terminal runs and replaced schedules no-ops", () => {
    const schedule = scheduleFor();
    const terminal = Result.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule: schedule,
        currentRun: runSnapshot(schedule, { execution: "terminal" }),
        actualStartedAt: 1_600,
      }),
    );
    const replacement = scheduleFor(generation(), 1_100, 500);
    const staleSchedule = Result.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule: schedule,
        currentRun: runSnapshot(replacement),
        actualStartedAt: 1_600,
      }),
    );

    expect(terminal).toMatchObject({
      kind: "no-op",
      reason: "terminal-run",
    });
    expect(staleSchedule).toMatchObject({
      kind: "no-op",
      reason: "stale-schedule",
    });
  });

  it("does not cancel when a callback starts before the deadline", () => {
    const schedule = scheduleFor();
    const decision = Result.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule: schedule,
        currentRun: runSnapshot(schedule),
        actualStartedAt: 1_499,
      }),
    );

    expect(decision).toMatchObject({
      kind: "no-op",
      reason: "deadline-not-reached",
      facts: { latenessMs: 0, expired: false, expiredByMs: 0 },
    });
  });

  it("records explicit serializable actual-start, lateness, and expiry facts", () => {
    const facts = Result.getOrThrow(
      observeWorkflowDeadlineStart({
        requestedStartAt: 100,
        actualStartedAt: 175,
        deadlineAt: 150,
      }),
    );

    expect(facts).toEqual({
      requestedStartAt: 100,
      actualStartedAt: 175,
      deadlineAt: 150,
      latenessMs: 75,
      expired: true,
      expiredByMs: 25,
    });
    expect(JSON.parse(JSON.stringify(facts))).toEqual(facts);
  });

  it("preserves the original absolute deadline across restart generations", () => {
    expect(
      Result.getOrThrow(
        planWorkflowDeadlineRestart({
          deadlineAt: 1_500,
          timeoutMs: 500,
          occurredAt: 1_250,
        }),
      ),
    ).toEqual({
      kind: "schedule",
      policy: "preserve-original-absolute-deadline",
      requestedAt: 1_000,
      horizonMs: 500,
      deadlineAt: 1_500,
    });
  });

  it("rejects restart once the preserved absolute deadline has expired", () => {
    const decision = planWorkflowDeadlineRestart({
      deadlineAt: 1_500,
      timeoutMs: 500,
      occurredAt: 1_500,
    });

    expect(Result.isFailure(decision)).toBe(true);
    if (Result.isFailure(decision)) {
      expect(decision.failure).toMatchObject({ code: "DEADLINE_EXPIRED" });
    }
  });

  it("returns stable redacted errors without echoing run identifiers", () => {
    const sensitiveRunReference = "customer-secret-run-reference";
    const result = planWorkflowDeadlineSchedule({
      generation: {
        ...generation(),
        workflowRunId: sensitiveRunReference,
        generation: -1,
      },
      execution: "active",
      requestedAt: 1_000,
      horizonMs: 500,
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toMatchObject({
        _tag: "WorkflowDeadlineContractError",
        code: "INVALID_GENERATION_IDENTITY",
      });
      expect(JSON.stringify(result.failure)).not.toContain(
        sensitiveRunReference,
      );
      expect(result.failure.message).not.toContain(sensitiveRunReference);
    }
  });
});
