import * as Schema from "effect/Schema";

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

export const EvaluationVerdictSchema = Schema.Literals(evaluationVerdicts);

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
  score: Schema.Number.pipe(
    Schema.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  ),
  confidence: Schema.Number.pipe(
    Schema.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  ),
  evidenceAnswerIds: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMinLength(1)),
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

export const BuildabilityReportSchema = Schema.Struct({
  verdict: EvaluationVerdictSchema,
  overallScore: Schema.Number.pipe(
    Schema.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  ),
  roast: Schema.NonEmptyString,
  strongestElement: Schema.NonEmptyString,
  biggestWeakness: Schema.NonEmptyString,
  improvedIdea: Schema.NonEmptyString,
  whatItWillTake: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMinLength(1)),
  ),
  exclusiveInCompleteBuildPack: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMinLength(1)),
  ),
});

export type BuildabilityReport = Schema.Schema.Type<
  typeof BuildabilityReportSchema
>;

export const decodeBuildabilityReport = Schema.decodeUnknownSync(
  BuildabilityReportSchema,
  { onExcessProperty: "error" },
);
