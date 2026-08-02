import type {
  DimensionKey,
  DimensionScoreValue,
  EvaluationVerdict,
} from "./schemas";

type Dimensions = Readonly<Record<DimensionKey, DimensionScoreValue>>;

export const selectVerdict = (dimensions: Dimensions): EvaluationVerdict => {
  if (dimensions.feasibility.score < 30) {
    return "too-expensive-for-version-one";
  }
  if (
    dimensions.problemSeverity.score >= 65 &&
    dimensions.solutionClarity.score < 45
  ) {
    return "strong-problem-weak-solution";
  }
  if (
    dimensions.distribution.score < 40 &&
    dimensions.solutionClarity.score >= 60
  ) {
    return "good-product-unclear-distribution";
  }
  if (dimensions.customerSpecificity.score < 35) {
    return "needs-a-different-customer";
  }
  return "promising-but-blurry";
};
