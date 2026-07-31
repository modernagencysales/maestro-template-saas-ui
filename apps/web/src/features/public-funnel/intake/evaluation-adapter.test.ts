import { describe, expect, it } from "vitest";

import { fixtureCompleteAnswers, makeEvaluation } from "./evaluation-adapter";

describe("free evaluation adapter", () => {
  it("creates an evidence-backed report from completed answers", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);

    expect(evaluation.report.verdict).toBeDefined();
    expect(evaluation.report.whatItWillTake).toHaveLength(3);
    expect(
      evaluation.result.dimensions.distribution.evidenceAnswerIds,
    ).toContain("distributionEvidence");
  });

  it("creates a stable public-safe identifier without copying idea text", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);

    expect(evaluation.id).toMatch(/^idea_[a-z0-9]+$/);
    expect(evaluation.id).not.toContain("dental");
  });
});
