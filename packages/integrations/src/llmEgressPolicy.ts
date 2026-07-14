import * as Schema from "effect/Schema";

export type ModelProvider = "openrouter";
export type ModelRegion = "us" | "eu" | "local";

export class ModelPolicyDenied extends Schema.TaggedError<ModelPolicyDenied>()(
  "ModelPolicyDenied",
  {
    reason: Schema.String,
    provider: Schema.optional(Schema.String),
    model: Schema.optional(Schema.String),
    region: Schema.optional(Schema.String),
  },
) {}

export class ModelInputTooLarge extends Schema.TaggedError<ModelInputTooLarge>()(
  "ModelInputTooLarge",
  {
    maxInputTokens: Schema.Number,
    estimatedInputTokens: Schema.Number,
  },
) {}

export class ModelBudgetExceeded extends Schema.TaggedError<ModelBudgetExceeded>()(
  "ModelBudgetExceeded",
  {
    maxSpendCents: Schema.Number,
    estimatedSpendCents: Schema.Number,
    currentSpendCents: Schema.Number,
  },
) {}

export type StructuredModelPolicy = {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly region: ModelRegion;
  readonly allowedProviders: readonly ModelProvider[];
  readonly allowedModels: readonly string[];
  readonly allowedRegions: readonly ModelRegion[];
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxSpendCents: number;
  readonly currentSpendCents?: number;
  readonly retention: "none" | "provider-default";
  readonly training: "disabled" | "provider-default";
};

export type ImmutableContentManifest = {
  readonly sourceHash: string;
  readonly contentHashes: readonly string[];
  readonly canary?: string;
};

export type StructuredPolicyCheck = {
  readonly estimatedInputTokens: number;
  readonly estimatedSpendCents: number;
};

export type StructuredPolicyError =
  ModelPolicyDenied | ModelInputTooLarge | ModelBudgetExceeded;

export const estimateStructuredInputTokens = (input: {
  readonly trustedInstructionVersion: string;
  readonly toolSchemaVersion: string;
  readonly immutableContentManifest: ImmutableContentManifest;
}): number =>
  Math.ceil(
    [
      input.trustedInstructionVersion,
      input.toolSchemaVersion,
      input.immutableContentManifest.sourceHash,
      ...input.immutableContentManifest.contentHashes,
    ].join(" ").length / 4,
  );

export const estimateStructuredSpendCents = (
  inputTokens: number,
  outputTokens: number,
): number =>
  Math.max(1, Math.ceil((inputTokens * 20 + outputTokens * 40) / 1_000_000));

export const enforceStructuredModelPolicy = (input: {
  readonly trustedInstructionVersion: string;
  readonly toolSchemaVersion: string;
  readonly immutableContentManifest: ImmutableContentManifest;
  readonly modelPolicy: StructuredModelPolicy;
}): StructuredPolicyCheck | StructuredPolicyError => {
  const { modelPolicy } = input;

  if (!modelPolicy.allowedProviders.includes(modelPolicy.provider)) {
    return new ModelPolicyDenied({
      reason: "Provider is not allowed by model policy.",
      provider: modelPolicy.provider,
    });
  }

  if (!modelPolicy.allowedModels.includes(modelPolicy.model)) {
    return new ModelPolicyDenied({
      reason: "Model is not allowed by model policy.",
      model: modelPolicy.model,
    });
  }

  if (!modelPolicy.allowedRegions.includes(modelPolicy.region)) {
    return new ModelPolicyDenied({
      reason: "Region is not allowed by model policy.",
      region: modelPolicy.region,
    });
  }

  if (modelPolicy.retention !== "none" || modelPolicy.training !== "disabled") {
    return new ModelPolicyDenied({
      reason: "Model policy must disable provider retention and training.",
      provider: modelPolicy.provider,
      model: modelPolicy.model,
    });
  }

  const estimatedInputTokens = estimateStructuredInputTokens(input);

  if (estimatedInputTokens > modelPolicy.maxInputTokens) {
    return new ModelInputTooLarge({
      maxInputTokens: modelPolicy.maxInputTokens,
      estimatedInputTokens,
    });
  }

  const estimatedSpendCents = estimateStructuredSpendCents(
    estimatedInputTokens,
    modelPolicy.maxOutputTokens,
  );
  const currentSpendCents = modelPolicy.currentSpendCents ?? 0;

  if (currentSpendCents + estimatedSpendCents > modelPolicy.maxSpendCents) {
    return new ModelBudgetExceeded({
      maxSpendCents: modelPolicy.maxSpendCents,
      estimatedSpendCents,
      currentSpendCents,
    });
  }

  return { estimatedInputTokens, estimatedSpendCents };
};
