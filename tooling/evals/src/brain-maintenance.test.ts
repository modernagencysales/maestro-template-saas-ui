import { describe, expect, it } from "vitest";
import { evaluateBrainMaintenance } from "./brain-maintenance";
import { assertRecord, loadFrozenBrainEvalFixture } from "./brain-eval-report";

const fixture = () =>
  assertRecord(loadFrozenBrainEvalFixture(), "fixture").maintenance;

describe("Brain maintenance eval", () => {
  it("approves the frozen maintenance fixture", () => {
    const result = evaluateBrainMaintenance(fixture());
    expect(result.receipt.passed).toBe(true);
    expect(result.receipt.totals.testCases).toBe(200);
  });

  it("fails uncited maintenance and stale revoked publishing", () => {
    const result = evaluateBrainMaintenance({
      suiteVersion: "bad",
      modelId: "fake",
      promptVersion: "bad",
      toolSchemaVersion: "bad",
      cases: [
        {
          id: "bad-maintenance",
          split: "test",
          labels: {
            reviewerA: "accepted",
            reviewerB: "accepted",
            adjudicated: "accepted",
          },
          output: {
            factualChangeCited: false,
            acceptedWithoutFactualCorrection: false,
            staleOrRevokedPublish: true,
          },
        },
      ],
    });
    expect(result.receipt.passed).toBe(false);
    expect(result.receipt.failures.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        "Maintenance factual changes must be cited.",
        "Maintenance proposal must be accepted without factual correction.",
        "Maintenance must not publish stale or revoked content.",
      ]),
    );
  });
});
