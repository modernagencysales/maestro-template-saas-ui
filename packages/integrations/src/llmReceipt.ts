import { createHash } from "node:crypto";
import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";
import type { ModelProvider, ModelRegion } from "./llmEgressPolicy";

export const ModelCallState = Schema.Literal(
  "queued",
  "running",
  "succeeded",
  "retryable_failure",
  "permanent_failure",
  "cancelled",
);

export type ModelCallState = Schema.Schema.Type<typeof ModelCallState>;

export class ModelReceiptMismatch extends Schema.TaggedError<ModelReceiptMismatch>()(
  "ModelReceiptMismatch",
  {
    field: Schema.String,
    expected: Schema.optional(Schema.String),
    actual: Schema.optional(Schema.String),
  },
) {}

export type ModelCallUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costCents: number;
};

export type ModelCallReceipt = {
  readonly attemptKey: string;
  readonly workspaceSlug: string;
  readonly provider: ModelProvider;
  readonly mode: ProviderMode;
  readonly model: string;
  readonly region: ModelRegion;
  readonly state: ModelCallState;
  readonly trustedInstructionVersion: string;
  readonly toolSchemaVersion: string;
  readonly requestHash: string;
  readonly responseHash: string;
  readonly sourceHash: string;
  readonly latencyMs: number;
  readonly usage: ModelCallUsage;
  readonly generatedAt: string;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

export const hashModelPayload = (payload: unknown): string =>
  `sha256:${createHash("sha256").update(stableJson(payload)).digest("hex")}`;

export const makeModelCallReceipt = (
  input: Omit<ModelCallReceipt, "state">,
): ModelCallReceipt => ({
  ...input,
  state: "succeeded",
});
