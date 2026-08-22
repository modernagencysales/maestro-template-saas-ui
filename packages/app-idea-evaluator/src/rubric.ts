import {
  DimensionScore,
  dimensionKeys,
  type DimensionKey,
  type DimensionScoreValue,
  type EvaluationInput,
  type EvaluationResult,
} from "./schemas";
import { selectVerdict } from "./verdict";

export const dimensionWeights = {
  customerSpecificity: 0.1,
  problemSeverity: 0.12,
  problemFrequency: 0.08,
  existingEffortOrSpend: 0.08,
  solutionClarity: 0.1,
  differentiation: 0.1,
  feasibility: 0.12,
  distribution: 0.12,
  monetization: 0.08,
  founderAdvantage: 0.05,
  operationalRisk: 0.03,
  maestroFit: 0.02,
} as const satisfies Record<DimensionKey, number>;

const scoreDimension = (
  input: EvaluationInput,
  dimension: DimensionKey,
): DimensionScoreValue => {
  const evidence = input.evidence.filter(
    (item) => item.dimension === dimension,
  );
  if (evidence.length === 0) {
    return {
      score: 20,
      confidence: 0,
      evidenceAnswerIds: ["missing-evidence"],
    };
  }
  const strength =
    evidence.reduce((total, item) => total + item.strength, 0) /
    evidence.length;
  return DimensionScore.make({
    score: Math.round(Math.min(1, Math.max(0, strength)) * 100),
    confidence: Math.min(1, 0.5 + evidence.length * 0.15),
    evidenceAnswerIds: evidence.map(({ answerId }) => answerId),
  });
};

export const weightedScore = (
  dimensions: Readonly<Record<DimensionKey, DimensionScoreValue>>,
): number =>
  Math.round(
    dimensionKeys.reduce(
      (total, key) => total + dimensions[key].score * dimensionWeights[key],
      0,
    ),
  );

export const scoreEvaluation = (input: EvaluationInput): EvaluationResult => {
  const dimensions = Object.fromEntries(
    dimensionKeys.map((key) => [key, scoreDimension(input, key)]),
  ) as Record<DimensionKey, DimensionScoreValue>;
  const overallScore = weightedScore(dimensions);
  const initialVerdict = selectVerdict(dimensions);
  const verdict =
    initialVerdict === "promising-but-blurry" && overallScore >= 70
      ? "worth-testing"
      : initialVerdict;

  return { input, dimensions, overallScore, verdict };
};
