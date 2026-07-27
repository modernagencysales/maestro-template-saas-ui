export const PINNED_INLINE_CONVEX_VERSION = "1.42.1" as const;

export const INLINE_TRANSACTION_LIMIT_FIELDS = [
  "bytesRead",
  "bytesWritten",
  "databaseQueries",
  "documentsRead",
  "documentsWritten",
  "functionsScheduled",
  "scheduledFunctionArgsBytes",
] as const;

export type InlineTransactionLimitField =
  (typeof INLINE_TRANSACTION_LIMIT_FIELDS)[number];

export type InlineTransactionLimits = Readonly<{
  readonly bytesRead?: number | undefined;
  readonly bytesWritten?: number | undefined;
  readonly databaseQueries?: number | undefined;
  readonly documentsRead?: number | undefined;
  readonly documentsWritten?: number | undefined;
  readonly functionsScheduled?: number | undefined;
  readonly scheduledFunctionArgsBytes?: number | undefined;
}>;

/** Values are pinned by docs/template/convex-compatibility.json. */
export const INLINE_TRANSACTION_PRESETS = {
  tiny: { documentsRead: 5, bytesWritten: 100 },
  "small-atomic": { documentsWritten: 100, bytesWritten: 1_048_576 },
} as const satisfies Readonly<Record<string, InlineTransactionLimits>>;

export type InlineTransactionPresetName =
  keyof typeof INLINE_TRANSACTION_PRESETS;

export type WorkflowInlineTransaction = {
  readonly kind: "inline";
  readonly posture: "small-atomic";
  readonly limitsProfile: InlineTransactionPresetName | "reviewed-explicit";
  readonly limits: InlineTransactionLimits;
};

export const inlineTransactionPreset = <
  const Name extends InlineTransactionPresetName,
>(
  name: Name,
): WorkflowInlineTransaction & { readonly limitsProfile: Name } => ({
  kind: "inline",
  posture: "small-atomic",
  limitsProfile: name,
  limits: INLINE_TRANSACTION_PRESETS[name],
});

export type ReviewedInlineTransaction = WorkflowInlineTransaction & {
  readonly limitsProfile: "reviewed-explicit";
};

export const reviewedInlineTransaction = (
  limits: InlineTransactionLimits,
): ReviewedInlineTransaction => {
  assertInlineTransactionLimits(limits);
  return {
    kind: "inline",
    posture: "small-atomic",
    limitsProfile: "reviewed-explicit",
    limits: { ...limits },
  };
};

export const inlineTransactionFinding = (
  transaction: WorkflowInlineTransaction,
): string | undefined => {
  try {
    assertInlineTransactionLimits(transaction.limits);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  if (transaction.limitsProfile === "reviewed-explicit") return undefined;
  const expected = INLINE_TRANSACTION_PRESETS[transaction.limitsProfile];
  return sameLimits(transaction.limits, expected)
    ? undefined
    : `inline transaction preset ${transaction.limitsProfile} does not match the pinned compatibility authority`;
};

export const assertInlineTransactionPreflight = (input: {
  readonly convexVersion: string;
  readonly transaction: WorkflowInlineTransaction;
  readonly capabilityPosture?: "small-atomic" | undefined;
}): void => {
  if (input.convexVersion !== PINNED_INLINE_CONVEX_VERSION) {
    throw new ConvexError({
      code: "INVALID_INLINE_TRANSACTION",
      message: `Inline transactions require pinned Convex ${PINNED_INLINE_CONVEX_VERSION}; received ${input.convexVersion}.`,
    });
  }
  if (input.capabilityPosture !== "small-atomic") {
    throw new ConvexError({
      code: "INVALID_INLINE_TRANSACTION",
      message:
        "Inline transactions require a capability registry entry with small-atomic posture.",
    });
  }
  const finding = inlineTransactionFinding(input.transaction);
  if (finding !== undefined) {
    throw new ConvexError({
      code: "INVALID_INLINE_TRANSACTION",
      message: finding,
    });
  }
};

const assertInlineTransactionLimits = (
  limits: InlineTransactionLimits,
): void => {
  const entries = Object.entries(limits);
  if (entries.length === 0) {
    throw new ConvexError({
      code: "INVALID_INLINE_TRANSACTION",
      message: "Inline transaction limits must contain at least one counter.",
    });
  }
  for (const [field, value] of entries) {
    if (
      !INLINE_TRANSACTION_LIMIT_FIELDS.includes(
        field as InlineTransactionLimitField,
      )
    ) {
      throw new ConvexError({
        code: "INVALID_INLINE_TRANSACTION",
        message: `Unsupported inline transaction limit ${field}.`,
      });
    }
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value <= 0
    ) {
      throw new ConvexError({
        code: "INVALID_INLINE_TRANSACTION",
        message: `Inline transaction limit ${field} must be a finite positive integer.`,
      });
    }
  }
};

const sameLimits = (
  actual: InlineTransactionLimits,
  expected: InlineTransactionLimits,
): boolean =>
  JSON.stringify(Object.entries(actual).sort()) ===
  JSON.stringify(Object.entries(expected).sort());
import { ConvexError } from "convex/values";
