import { describe, expect, it } from "vitest";
import { assertRecord, loadFrozenBrainEvalFixture } from "./brain-eval-report";
import { evaluateBrainMultilingual } from "./brain-multilingual";

const fixture = () =>
  assertRecord(loadFrozenBrainEvalFixture(), "fixture").multilingual;

describe("Brain multilingual eval", () => {
  it("approves the frozen multilingual fixture across five launch languages", () => {
    const result = evaluateBrainMultilingual(fixture());
    expect(result.receipt.passed).toBe(true);
    expect(result.receipt.totals.testCases).toBe(250);
  });

  it("fails non-English synonym cases that defeat keyword-only logic", () => {
    const result = evaluateBrainMultilingual({
      suiteVersion: "bad",
      modelId: "fake",
      promptVersion: "bad",
      toolSchemaVersion: "bad",
      cases: [
        {
          id: "bad-spanish-synonym",
          split: "test",
          labels: {
            reviewerA: "abstain",
            reviewerB: "abstain",
            adjudicated: "abstain",
          },
          language: "es",
          output: {
            semanticMatch: false,
            abstainedWhenNoEvidence: false,
            authorizationInvariant: false,
            keywordOnlyBypass: true,
          },
        },
      ],
    });
    expect(result.receipt.passed).toBe(false);
    expect(result.receipt.failures.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        "Multilingual case must preserve semantic classification or abstention.",
        "Multilingual paraphrase must not bypass authorization or abstention invariants.",
      ]),
    );
  });
});
