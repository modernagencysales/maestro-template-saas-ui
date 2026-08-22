import { describe, expect, it } from "vitest";

import { fixtureInput } from "./fixtures";
import { scoreEvaluation } from "./rubric";
import { selectVerdict } from "./verdict";

describe("selectVerdict", () => {
  it("prioritizes an infeasible first version over the aggregate score", () => {
    const dimensions = scoreEvaluation(fixtureInput()).dimensions;
    expect(
      selectVerdict({
        ...dimensions,
        feasibility: { ...dimensions.feasibility, score: 29 },
      }),
    ).toBe("too-expensive-for-version-one");
  });

  it("identifies a strong problem paired with a weak solution", () => {
    const dimensions = scoreEvaluation(fixtureInput()).dimensions;
    expect(
      selectVerdict({
        ...dimensions,
        problemSeverity: { ...dimensions.problemSeverity, score: 80 },
        solutionClarity: { ...dimensions.solutionClarity, score: 35 },
      }),
    ).toBe("strong-problem-weak-solution");
  });
});
