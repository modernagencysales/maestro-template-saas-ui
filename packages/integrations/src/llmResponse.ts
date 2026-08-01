import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";
import type { LlmSpendEstimate } from "./spend";

export const LlmFinishReason = Schema.Literals([
  "stop",
  "length",
  "tool_call",
  "content_filter",
]);

export type LlmFinishReason = Schema.Schema.Type<typeof LlmFinishReason>;

export type LlmCompletionReceipt = {
  readonly workspaceSlug: string;
  readonly idempotencyKey?: string;
  readonly generatedAt: string;
};

export type LlmCompletion = {
  readonly provider: "openrouter";
  readonly mode: ProviderMode;
  readonly model: string;
  readonly text: string;
  readonly finishReason: LlmFinishReason;
  readonly usage: LlmSpendEstimate;
  readonly receipt: LlmCompletionReceipt;
};

export type LlmCompletionInput = {
  readonly mode: ProviderMode;
  readonly model: string;
  readonly workspaceSlug: string;
  readonly text: string;
  readonly usage: LlmSpendEstimate;
  readonly generatedAt: string;
  readonly idempotencyKey?: string;
};

export class LlmReceiptValidationError extends Schema.TaggedErrorClass<LlmReceiptValidationError>()(
  "LlmReceiptValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  },
) {}

const maxIdempotencyKeyLength = 128;
const idempotencyKeyPattern = /^[A-Za-z0-9._~-]+$/;

export const validateOptionalLlmIdempotencyKey = (
  idempotencyKey: string | undefined,
): string | undefined | LlmReceiptValidationError => {
  if (idempotencyKey === undefined) {
    return undefined;
  }

  const trimmed = idempotencyKey.trim();

  if (!trimmed) {
    return new LlmReceiptValidationError({
      field: "idempotencyKey",
      message: "idempotencyKey must not be blank.",
    });
  }

  if (trimmed !== idempotencyKey) {
    return new LlmReceiptValidationError({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  }

  if (idempotencyKey.length > maxIdempotencyKeyLength) {
    return new LlmReceiptValidationError({
      field: "idempotencyKey",
      message: `idempotencyKey must be ${String(maxIdempotencyKeyLength)} characters or fewer.`,
    });
  }

  if (!idempotencyKeyPattern.test(idempotencyKey)) {
    return new LlmReceiptValidationError({
      field: "idempotencyKey",
      message:
        "idempotencyKey must contain only URL-safe letters, numbers, '.', '_', '~', or '-'.",
    });
  }

  return idempotencyKey;
};

export const makeLlmCompletion = (
  input: LlmCompletionInput,
): LlmCompletion | LlmReceiptValidationError => {
  const idempotencyKey = validateOptionalLlmIdempotencyKey(
    input.idempotencyKey,
  );

  if (idempotencyKey instanceof LlmReceiptValidationError) {
    return idempotencyKey;
  }

  const receipt: LlmCompletionReceipt = idempotencyKey
    ? {
        workspaceSlug: input.workspaceSlug,
        idempotencyKey,
        generatedAt: input.generatedAt,
      }
    : {
        workspaceSlug: input.workspaceSlug,
        generatedAt: input.generatedAt,
      };

  return {
    provider: "openrouter",
    mode: input.mode,
    model: input.model,
    text: input.text,
    finishReason: "stop",
    usage: input.usage,
    receipt,
  };
};

export const makeFakeLlmCompletionText = (workspaceSlug: string): string =>
  `Deterministic fake completion for ${workspaceSlug}. Replace this through the guarded LLM gateway before live use.`;
