import { describe, expect, it } from "vitest";
import { evaluateBrainAnswers } from "./brain-answers";
import { assertRecord, loadFrozenBrainEvalFixture } from "./brain-eval-report";

const fixture = () =>
  assertRecord(loadFrozenBrainEvalFixture(), "fixture").answers;

describe("Brain answers eval", () => {
  it("approves the frozen answer fixture", () => {
    const result = evaluateBrainAnswers(fixture());
    expect(result.receipt.passed).toBe(true);
    expect(result.receipt.totals.testCases).toBe(400);
    expect(result.receipt.metrics.entailment?.passed).toBe(true);
  });

  it("fails unsupported claims, bad citations, and no-evidence invention", () => {
    const result = evaluateBrainAnswers({
      suiteVersion: "bad",
      modelId: "fake",
      promptVersion: "bad",
      toolSchemaVersion: "bad",
      cases: [
        {
          id: "bad-claim",
          split: "test",
          labels: {
            reviewerA: "entailed",
            reviewerB: "entailed",
            adjudicated: "entailed",
          },
          kind: "claim",
          output: {
            claimEntailed: false,
            citationLocatorResolved: false,
            redactionMarker: false,
            abstained: false,
            inventedSource: false,
          },
        },
        {
          id: "bad-no-evidence",
          split: "test",
          labels: {
            reviewerA: "abstain",
            reviewerB: "abstain",
            adjudicated: "abstain",
          },
          kind: "no-evidence",
          output: {
            claimEntailed: false,
            citationLocatorResolved: false,
            redactionMarker: true,
            abstained: false,
            inventedSource: true,
          },
        },
      ],
    });
    expect(result.receipt.passed).toBe(false);
    expect(result.receipt.failures.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        "Answer claim must be entailed by cited exact revision.",
        "Answer citation locator must resolve or return explicit redaction.",
        "No-evidence answer must abstain without invented sources.",
      ]),
    );
  });
});
