import * as Schema from "effect/Schema";

export class SpendCapExceededError extends Schema.TaggedErrorClass<SpendCapExceededError>()(
  "SpendCapExceededError",
  {
    workspaceSlug: Schema.String,
    currentDailySpendCents: Schema.Number,
    estimatedCallCents: Schema.Number,
    dailySpendLimitCents: Schema.Number,
  },
) {}

export type LlmSpendInput = {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly inputCentsPerMillionTokens: number;
  readonly outputCentsPerMillionTokens: number;
  readonly minimumCents: number;
};

export type LlmSpendEstimate = {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly estimatedCents: number;
};

export type DailySpendCapInput = {
  readonly workspaceSlug: string;
  readonly currentDailySpendCents: number;
  readonly estimatedCallCents: number;
  readonly dailySpendLimitCents: number;
};

export const estimateConservativeTokenCount = (text: string): number => {
  const normalized = text.trim();

  if (!normalized) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
};

export const calculateLlmSpend = (input: LlmSpendInput): LlmSpendEstimate => {
  const inputCents =
    (input.promptTokens / 1_000_000) * input.inputCentsPerMillionTokens;
  const outputCents =
    (input.completionTokens / 1_000_000) * input.outputCentsPerMillionTokens;
  const estimatedCents = Math.max(
    input.minimumCents,
    Math.round((inputCents + outputCents) * 1_000_000) / 1_000_000,
  );

  return {
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    estimatedCents,
  };
};

export const verifyDailySpendCap = (
  input: DailySpendCapInput,
): true | SpendCapExceededError => {
  if (
    input.currentDailySpendCents + input.estimatedCallCents <=
    input.dailySpendLimitCents
  ) {
    return true;
  }

  return new SpendCapExceededError(input);
};
