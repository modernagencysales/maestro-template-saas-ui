import { describe, expect, it } from "vitest";

import { fixtureInput } from "./fixtures";
import { dimensionWeights, scoreEvaluation } from "./rubric";

describe("scoreEvaluation", () => {
  it("uses weights that account for the entire evaluation", () => {
    expect(
      Object.values(dimensionWeights).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1);
  });

  it("selects good-product-unclear-distribution from the score pattern", () => {
    const result = scoreEvaluation(
      fixtureInput({
        distributionEvidence: [],
        evidence: fixtureInput().evidence.filter(
          ({ dimension }) => dimension !== "distribution",
        ),
      }),
    );

    expect(result.verdict).toBe("good-product-unclear-distribution");
    expect(result.dimensions.distribution.score).toBeLessThan(40);
  });

  it("keeps every score tied to the answers that support it", () => {
    const result = scoreEvaluation(fixtureInput());

    for (const dimension of Object.values(result.dimensions)) {
      expect(dimension.evidenceAnswerIds.length).toBeGreaterThan(0);
    }
  });
});
