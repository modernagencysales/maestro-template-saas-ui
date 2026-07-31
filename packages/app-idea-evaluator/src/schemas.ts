import { Schema } from "effect";

export const dimensionKeys = [
  "customerSpecificity",
  "problemSeverity",
  "problemFrequency",
  "existingEffortOrSpend",
  "solutionClarity",
  "differentiation",
  "feasibility",
  "distribution",
  "monetization",
  "founderAdvantage",
  "operationalRisk",
  "maestroFit",
] as const;

export type DimensionKey = (typeof dimensionKeys)[number];

export const evaluationVerdicts = [
  "too-expensive-for-version-one",
  "strong-problem-weak-solution",
  "good-product-unclear-distribution",
  "needs-a-different-customer",
  "worth-testing",
  "promising-but-blurry",
] as const;

export type EvaluationVerdict = (typeof evaluationVerdicts)[number];

export type EvaluationEvidence = {
  readonly answerId: string;
  readonly dimension: DimensionKey;
  readonly strength: number;
};

export type EvaluationInput = {
  readonly ideaName: string;
  readonly ideaSummary: string;
  readonly customer: string;
  readonly problem: string;
  readonly currentAlternative: string;
  readonly solution: string;
  readonly differentiation: string;
  readonly revenueModel: string;
  readonly founderAdvantage: string;
  readonly constraints: readonly string[];
  readonly distributionEvidence: readonly string[];
  readonly evidence: readonly EvaluationEvidence[];
};

export type DimensionScoreValue = {
  readonly score: number;
  readonly confidence: number;
  readonly evidenceAnswerIds: readonly string[];
};

const DimensionScoreSchema = Schema.Struct({
  score: Schema.Number.pipe(Schema.between(0, 100)),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  evidenceAnswerIds: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.minItems(1),
  ),
});

const decodeDimensionScore = Schema.decodeUnknownSync(DimensionScoreSchema);

export const DimensionScore = {
  make: (value: DimensionScoreValue): DimensionScoreValue =>
    decodeDimensionScore(value),
};

export type EvaluationResult = {
  readonly input: EvaluationInput;
  readonly dimensions: Readonly<Record<DimensionKey, DimensionScoreValue>>;
  readonly overallScore: number;
  readonly verdict: EvaluationVerdict;
};

export type BuildabilityReport = {
  readonly verdict: EvaluationVerdict;
  readonly overallScore: number;
  readonly roast: string;
  readonly strongestElement: string;
  readonly biggestWeakness: string;
  readonly improvedIdea: string;
  readonly whatItWillTake: readonly string[];
  readonly exclusiveInCompleteBuildPack: readonly string[];
};
