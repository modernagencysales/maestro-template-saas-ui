import { describe, expect, it, vi } from "vitest";

import { captureFunnelEvent } from "./funnel-analytics";

const event = {
  name: "evaluation_completed" as const,
  evaluationId: "idea_1",
  verdict: "worth-testing" as const,
  durationMs: 1200,
  modelCalls: 1,
  estimatedCostCents: 0.02,
};

describe("public funnel analytics", () => {
  it("captures only after analytics consent", () => {
    const capture = vi.fn();
    captureFunnelEvent("pending", event, capture);
    expect(capture).not.toHaveBeenCalled();
    captureFunnelEvent("accepted", event, capture);
    expect(capture).toHaveBeenCalledWith("evaluation_completed", {
      evaluationId: "idea_1",
      verdict: "worth-testing",
      durationMs: 1200,
      modelCalls: 1,
      estimatedCostCents: 0.02,
    });
  });

  it("rejects content before it reaches the analytics client", () => {
    const capture = vi.fn();
    expect(() =>
      captureFunnelEvent(
        "accepted",
        { ...event, idea: "secret" } as typeof event,
        capture,
      ),
    ).toThrow(/not an allowed analytics property/i);
    expect(capture).not.toHaveBeenCalled();
  });
});
