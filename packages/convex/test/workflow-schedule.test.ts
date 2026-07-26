import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";
import {
  MAX_WORKFLOW_SCHEDULE_HORIZON_MS,
  compileWorkflowSchedule,
} from "../confect/workflows/_kit/workflowSchedule";

describe("workflow schedule compiler", () => {
  it("compiles exact runAfter and runAt options without ambient time", () => {
    expect(
      compileWorkflowSchedule({ kind: "runAfter", delayMs: 250 }, 1_000),
    ).toEqual(Either.right({ runAfter: 250 }));
    expect(
      compileWorkflowSchedule({ kind: "runAt", timestamp: 1_250 }, 1_000),
    ).toEqual(Either.right({ runAt: 1_250 }));
  });

  it.each([
    [
      "fractional delay",
      { kind: "runAfter", delayMs: 1.5 },
      1_000,
      "INVALID_SCHEDULE_TIME",
    ],
    [
      "NaN delay",
      { kind: "runAfter", delayMs: Number.NaN },
      1_000,
      "INVALID_SCHEDULE_TIME",
    ],
    [
      "infinite timestamp",
      { kind: "runAt", timestamp: Number.POSITIVE_INFINITY },
      1_000,
      "INVALID_SCHEDULE_TIME",
    ],
    [
      "past timestamp",
      { kind: "runAt", timestamp: 999 },
      1_000,
      "SCHEDULE_IN_PAST",
    ],
    [
      "distant delay",
      { kind: "runAfter", delayMs: MAX_WORKFLOW_SCHEDULE_HORIZON_MS + 1 },
      1_000,
      "UNSUPPORTED_SCHEDULE_HORIZON",
    ],
    [
      "distant timestamp",
      {
        kind: "runAt",
        timestamp: 1_000 + MAX_WORKFLOW_SCHEDULE_HORIZON_MS + 1,
      },
      1_000,
      "UNSUPPORTED_SCHEDULE_HORIZON",
    ],
    [
      "overflow",
      { kind: "runAfter", delayMs: 1 },
      Number.MAX_SAFE_INTEGER,
      "SCHEDULE_OVERFLOW",
    ],
  ] as const)("rejects %s without clamping", (_name, schedule, nowMs, code) => {
    const result = compileWorkflowSchedule(schedule, nowMs);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) throw new Error("expected schedule rejection");
    expect(result.left.code).toBe(code);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])(
    "rejects invalid workflow clock %s",
    (nowMs) => {
      const result = compileWorkflowSchedule(
        { kind: "runAfter", delayMs: 1 },
        nowMs,
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left.code).toBe("INVALID_SCHEDULE_CLOCK");
      }
    },
  );
});
