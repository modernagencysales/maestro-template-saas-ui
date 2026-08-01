import { describe, expect, it } from "vitest";

import { validateFunnelEvent } from "./funnelEvents";

describe("privacy-safe funnel analytics", () => {
  it.each([
    "idea",
    "answer",
    "roast",
    "prompt",
    "modelOutput",
    "email",
    "payment",
  ])("rejects %s content in funnel events", (field) => {
    expect(() =>
      validateFunnelEvent({
        name: "evaluation_completed",
        evaluationId: "idea_1",
        verdict: "worth-testing",
        durationMs: 1_000,
        modelCalls: 1,
        estimatedCostCents: 0.03,
        [field]: "private",
      }),
    ).toThrow("analytics property");
  });

  it("accepts the allowlisted completion metrics", () => {
    expect(
      validateFunnelEvent({
        name: "evaluation_completed",
        evaluationId: "idea_1",
        verdict: "worth-testing",
        durationMs: 1_000,
        modelCalls: 1,
        estimatedCostCents: 0.03,
      }),
    ).toMatchObject({ name: "evaluation_completed" });
  });
});
