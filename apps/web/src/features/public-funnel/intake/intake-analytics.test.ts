import { describe, expect, it } from "vitest";

import { evaluationCompletedEventForRemote } from "./intake-view";

describe("evaluation completion analytics", () => {
  it("emits receipt metrics only for a fresh model completion", () => {
    expect(
      evaluationCompletedEventForRemote(
        {
          evaluationId: "evaluation_1",
          reportId: "report_1",
          freshCompletion: true,
          durationMs: 1200,
          modelCalls: 2,
          estimatedCostCents: 0.04,
        },
        "worth-testing",
      ),
    ).toEqual({
      name: "evaluation_completed",
      evaluationId: "evaluation_1",
      verdict: "worth-testing",
      durationMs: 1200,
      modelCalls: 2,
      estimatedCostCents: 0.04,
    });
  });

  it("does not emit a misleading completion for an idempotent replay", () => {
    expect(
      evaluationCompletedEventForRemote(
        {
          evaluationId: "evaluation_1",
          reportId: "report_1",
          freshCompletion: false,
        },
        "worth-testing",
      ),
    ).toBeNull();
  });
});
