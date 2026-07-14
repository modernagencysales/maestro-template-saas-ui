import { describe, expect, it } from "vitest";
import { evaluateBrainClassification } from "./brain-classification";
import { loadFrozenBrainEvalFixture, assertRecord } from "./brain-eval-report";

const fixture = () =>
  assertRecord(loadFrozenBrainEvalFixture(), "fixture").classification;

describe("Brain classification eval", () => {
  it("approves the frozen classification fixture", () => {
    const result = evaluateBrainClassification(fixture());
    expect(result.receipt.passed).toBe(true);
    expect(result.receipt.totals.testCases).toBe(500);
    expect(result.receipt.metrics.agreement?.passed).toBe(true);
    expect(result.status).toBe("approved");
  });

  it("fails cross-client routes, multi-target output, and allowlist bypass", () => {
    const result = evaluateBrainClassification({
      suiteVersion: "bad",
      modelId: "fake",
      promptVersion: "bad",
      toolSchemaVersion: "bad",
      cases: [
        {
          id: "bad-route",
          split: "test",
          labels: {
            reviewerA: "client-alpha",
            reviewerB: "client-alpha",
            adjudicated: "client-alpha",
          },
          allowedTargets: ["client-alpha"],
          expectedTarget: "client-alpha",
          outputTargets: ["client-alpha", "client-beta"],
          committedTarget: "client-beta",
        },
      ],
    });
    expect(result.receipt.passed).toBe(false);
    expect(result.receipt.failures.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        "Classification target must stay inside pinned allowlist.",
        "Classification must choose zero or one target.",
        "Classification must not commit a cross-client route.",
      ]),
    );
  });
});
