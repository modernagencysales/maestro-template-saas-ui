import * as Schema from "effect/Schema";

export const buildPackStageNames = [
  "normalize",
  "challenge",
  "research",
  "design",
  "specify",
  "review",
  "compile",
  "map-to-maestro",
] as const;

export const BuildPackStageNameSchema = Schema.Literals(buildPackStageNames);
export const BuildPackStageStatusSchema = Schema.Literals([
  "queued",
  "running",
  "completed",
  "failed-recoverable",
  "needs-support",
]);

export type BuildPackStageName = (typeof buildPackStageNames)[number];
export type BuildPackStageStatus =
  "queued" | "running" | "completed" | "failed-recoverable" | "needs-support";

export type BuildPackStage = {
  readonly name: BuildPackStageName;
  readonly status: BuildPackStageStatus;
  readonly attempts: number;
  readonly output?: string;
  readonly error?: string;
};

export type BuildPackRun = {
  readonly packId: string;
  readonly reportId: string;
  readonly reportVersion: number;
  readonly status:
    "running" | "failed-recoverable" | "needs-support" | "completed";
  readonly stages: readonly BuildPackStage[];
};

export type CompetitorClaim = {
  readonly text: string;
  readonly citations: readonly string[];
};

export type CompleteBuildPack = {
  readonly productBrief: string;
  readonly customerAndProblem: string;
  readonly scope: readonly string[];
  readonly requirements: readonly string[];
  readonly userJourneys: readonly string[];
  readonly dataModel: readonly string[];
  readonly architecture: string;
  readonly integrations: readonly string[];
  readonly securityAndPrivacy: readonly string[];
  readonly deliveryPlan: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly risks: readonly string[];
  readonly openQuestions: readonly string[];
  readonly competitorClaims: readonly CompetitorClaim[];
};

const nonBlankText = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const CompetitorClaimSchema = Schema.Struct({
  text: nonBlankText,
  citations: Schema.NonEmptyArray(nonBlankText),
});

export const CompleteBuildPackSchema = Schema.Struct({
  productBrief: nonBlankText,
  customerAndProblem: nonBlankText,
  scope: Schema.Array(nonBlankText),
  requirements: Schema.Array(nonBlankText),
  userJourneys: Schema.Array(nonBlankText),
  dataModel: Schema.Array(nonBlankText),
  architecture: nonBlankText,
  integrations: Schema.Array(nonBlankText),
  securityAndPrivacy: Schema.Array(nonBlankText),
  deliveryPlan: Schema.Array(nonBlankText),
  acceptanceCriteria: Schema.Array(nonBlankText),
  risks: Schema.Array(nonBlankText),
  openQuestions: Schema.Array(nonBlankText),
  competitorClaims: Schema.Array(CompetitorClaimSchema),
});

export const decodeCompleteBuildPack = (input: unknown): CompleteBuildPack =>
  Schema.decodeUnknownSync(CompleteBuildPackSchema, {
    onExcessProperty: "error",
  })(input);

export const createBuildPackRun = (input: {
  readonly packId: string;
  readonly reportId: string;
  readonly reportVersion: number;
  readonly entitlementStatus: "active" | "revoked" | "missing";
}): BuildPackRun => {
  if (input.entitlementStatus !== "active") {
    throw new Error("Build Pack generation requires an active entitlement.");
  }
  return {
    packId: input.packId,
    reportId: input.reportId,
    reportVersion: input.reportVersion,
    status: "running",
    stages: buildPackStageNames.map((name, index) => ({
      name,
      status: index === 0 ? "running" : "queued",
      attempts: index === 0 ? 1 : 0,
    })),
  };
};

export const advanceBuildPack = (
  run: BuildPackRun,
  output: string,
): BuildPackRun => {
  const currentIndex = run.stages.findIndex(
    ({ status }) => status === "running",
  );
  if (currentIndex < 0) throw new Error("No Build Pack stage is running.");
  const isComplete = currentIndex === run.stages.length - 1;
  return {
    ...run,
    status: isComplete ? "completed" : "running",
    stages: run.stages.map((stage, index) => {
      if (index === currentIndex) {
        return { ...stage, status: "completed", output };
      }
      if (index === currentIndex + 1) {
        return { ...stage, status: "running", attempts: stage.attempts + 1 };
      }
      return stage;
    }),
  };
};

export const failBuildPackStage = (
  run: BuildPackRun,
  error: string,
): BuildPackRun => {
  const current = run.stages.find(({ status }) => status === "running");
  if (!current) throw new Error("No Build Pack stage is running.");
  const needsSupport = current.attempts >= 3;
  return {
    ...run,
    status: needsSupport ? "needs-support" : "failed-recoverable",
    stages: run.stages.map((stage) =>
      stage.name === current.name
        ? {
            ...stage,
            status: needsSupport ? "needs-support" : "failed-recoverable",
            error,
          }
        : stage,
    ),
  };
};

export const retryBuildPackStage = (run: BuildPackRun): BuildPackRun => {
  if (run.status === "needs-support") {
    throw new Error("This Build Pack stage needs support before it can retry.");
  }
  const failed = run.stages.find(
    ({ status }) => status === "failed-recoverable",
  );
  if (!failed) throw new Error("No recoverable Build Pack stage exists.");
  return {
    ...run,
    status: "running",
    stages: run.stages.map((stage) =>
      stage.name === failed.name
        ? {
            name: stage.name,
            status: "running",
            attempts: stage.attempts + 1,
          }
        : stage,
    ),
  };
};

const requireText = (name: string, value: string): void => {
  if (!value.trim()) throw new Error(`${name} must not be blank.`);
};

export const validateCompleteBuildPack = (
  pack: CompleteBuildPack,
): CompleteBuildPack => {
  requireText("productBrief", pack.productBrief);
  requireText("customerAndProblem", pack.customerAndProblem);
  requireText("architecture", pack.architecture);
  for (const claim of pack.competitorClaims) {
    if (claim.citations.length === 0) {
      throw new Error("Every researched competitor claim requires a citation.");
    }
  }
  return pack;
};
