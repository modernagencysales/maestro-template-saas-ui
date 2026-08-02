import * as Schema from "effect/Schema";

export type CreditLedgerReason =
  "manual_adjustment" | "llm_usage" | "seat_charge" | "refund";

export type CreditLedgerEntry = {
  readonly id: string;
  readonly workspaceSlug: string;
  readonly type: "credit" | "debit";
  readonly credits: number;
  readonly reason: CreditLedgerReason;
  readonly idempotencyKey: string;
  readonly createdAt: number;
  readonly balanceAfter: number;
  readonly lowBalance?: LowBalanceEvent;
};

export type UsageEvent = {
  readonly id: string;
  readonly workspaceSlug: string;
  readonly idempotencyKey: string;
  readonly provider: "openrouter" | "dodo" | "email" | "storage";
  readonly units: number;
  readonly costCredits: number;
  readonly createdAt: number;
};

export type LowBalanceEvent = {
  readonly workspaceSlug: string;
  readonly balanceCredits: number;
  readonly thresholdCredits: number;
};

export type FakeBillingReceipt = {
  readonly receiptId: string;
  readonly workspaceSlug: string;
  readonly mode: "fake";
  readonly operation: string;
  readonly idempotencyKey: string;
  readonly credits: number;
  readonly customerMetadata: "[redacted]";
  readonly providerMetadata: "[redacted]";
  readonly createdAt: number;
};

export class LowBalanceError extends Schema.TaggedErrorClass<LowBalanceError>()(
  "LowBalanceError",
  {
    workspaceSlug: Schema.String,
    availableCredits: Schema.Number,
    requestedCredits: Schema.Number,
  },
) {}

export class SeatLimitExceededError extends Schema.TaggedErrorClass<SeatLimitExceededError>()(
  "SeatLimitExceededError",
  {
    currentSeats: Schema.Number,
    requestedSeats: Schema.Number,
    seatLimit: Schema.Number,
  },
) {}

export class BillingIdempotencyKeyError extends Schema.TaggedErrorClass<BillingIdempotencyKeyError>()(
  "BillingIdempotencyKeyError",
  {
    field: Schema.String,
    message: Schema.String,
  },
) {}

const maxIdempotencyKeyLength = 128;
const idempotencyKeyPattern = /^[A-Za-z0-9._~-]+$/;

export const validateBillingIdempotencyKey = (
  idempotencyKey: string | undefined,
): string | BillingIdempotencyKeyError => {
  if (idempotencyKey === undefined) {
    return new BillingIdempotencyKeyError({
      field: "idempotencyKey",
      message: "idempotencyKey is required.",
    });
  }

  const trimmed = idempotencyKey.trim();

  if (!trimmed) {
    return new BillingIdempotencyKeyError({
      field: "idempotencyKey",
      message: "idempotencyKey must not be blank.",
    });
  }

  if (trimmed !== idempotencyKey) {
    return new BillingIdempotencyKeyError({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  }

  if (idempotencyKey.length > maxIdempotencyKeyLength) {
    return new BillingIdempotencyKeyError({
      field: "idempotencyKey",
      message: `idempotencyKey must be ${String(maxIdempotencyKeyLength)} characters or fewer.`,
    });
  }

  if (!idempotencyKeyPattern.test(idempotencyKey)) {
    return new BillingIdempotencyKeyError({
      field: "idempotencyKey",
      message:
        "idempotencyKey must contain only URL-safe letters, numbers, '.', '_', '~', or '-'.",
    });
  }

  return idempotencyKey;
};

export const computeCreditBalance = (
  entries: readonly CreditLedgerEntry[],
): number =>
  entries.reduce(
    (balance, entry) =>
      entry.type === "credit"
        ? balance + entry.credits
        : balance - entry.credits,
    0,
  );

const ledgerId = (workspaceSlug: string, idempotencyKey: string): string =>
  `ledger_${workspaceSlug}_${idempotencyKey}`;

const lowBalanceFor = (
  workspaceSlug: string,
  balanceCredits: number,
  thresholdCredits: number,
): LowBalanceEvent | undefined =>
  balanceCredits <= thresholdCredits
    ? { workspaceSlug, balanceCredits, thresholdCredits }
    : undefined;

export const addCredits = (input: {
  readonly workspaceSlug: string;
  readonly credits: number;
  readonly reason: CreditLedgerReason;
  readonly idempotencyKey: string;
  readonly createdAt: number;
  readonly lowBalanceThresholdCredits?: number;
}): CreditLedgerEntry | BillingIdempotencyKeyError => {
  const idempotencyKey = validateBillingIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey instanceof BillingIdempotencyKeyError) {
    return idempotencyKey;
  }

  const balanceAfter = input.credits;
  const lowBalance = lowBalanceFor(
    input.workspaceSlug,
    balanceAfter,
    input.lowBalanceThresholdCredits ?? 10,
  );
  const base = {
    id: ledgerId(input.workspaceSlug, idempotencyKey),
    workspaceSlug: input.workspaceSlug,
    type: "credit" as const,
    credits: input.credits,
    reason: input.reason,
    idempotencyKey,
    createdAt: input.createdAt,
    balanceAfter,
  };

  return lowBalance ? { ...base, lowBalance } : base;
};

export const deductCredits = (input: {
  readonly workspaceSlug: string;
  readonly existingEntries: readonly CreditLedgerEntry[];
  readonly credits: number;
  readonly reason: CreditLedgerReason;
  readonly idempotencyKey: string;
  readonly createdAt: number;
  readonly lowBalanceThresholdCredits?: number;
}): CreditLedgerEntry | LowBalanceError | BillingIdempotencyKeyError => {
  const idempotencyKey = validateBillingIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey instanceof BillingIdempotencyKeyError) {
    return idempotencyKey;
  }

  const currentBalance = computeCreditBalance(input.existingEntries);

  if (currentBalance < input.credits) {
    return new LowBalanceError({
      workspaceSlug: input.workspaceSlug,
      availableCredits: currentBalance,
      requestedCredits: input.credits,
    });
  }

  const balanceAfter = currentBalance - input.credits;
  const lowBalance = lowBalanceFor(
    input.workspaceSlug,
    balanceAfter,
    input.lowBalanceThresholdCredits ?? 10,
  );
  const base = {
    id: ledgerId(input.workspaceSlug, idempotencyKey),
    workspaceSlug: input.workspaceSlug,
    type: "debit" as const,
    credits: input.credits,
    reason: input.reason,
    idempotencyKey,
    createdAt: input.createdAt,
    balanceAfter,
  };

  return lowBalance ? { ...base, lowBalance } : base;
};

export const duplicateUsageEvent = (
  existingEvents: readonly UsageEvent[],
  idempotencyKey: string,
): boolean =>
  existingEvents.some((event) => event.idempotencyKey === idempotencyKey);

export const recordUsageEvent = (input: {
  readonly existingEvents: readonly UsageEvent[];
  readonly workspaceSlug: string;
  readonly idempotencyKey: string;
  readonly provider: UsageEvent["provider"];
  readonly units: number;
  readonly costCredits: number;
  readonly createdAt: number;
}): UsageEvent | BillingIdempotencyKeyError => {
  const idempotencyKey = validateBillingIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey instanceof BillingIdempotencyKeyError) {
    return idempotencyKey;
  }

  const existing = input.existingEvents.find(
    (event) => event.idempotencyKey === idempotencyKey,
  );

  if (existing) {
    return existing;
  }

  return {
    id: `usage_${input.workspaceSlug}_${idempotencyKey}`,
    workspaceSlug: input.workspaceSlug,
    idempotencyKey,
    provider: input.provider,
    units: input.units,
    costCredits: input.costCredits,
    createdAt: input.createdAt,
  };
};

export const preflightSeatCount = (input: {
  readonly currentSeats: number;
  readonly requestedSeats: number;
  readonly seatLimit: number;
}): true | SeatLimitExceededError =>
  input.requestedSeats <= input.seatLimit
    ? true
    : new SeatLimitExceededError(input);

export const createFakeBillingReceipt = (input: {
  readonly workspaceSlug: string;
  readonly operation: string;
  readonly idempotencyKey: string;
  readonly credits: number;
  readonly customerMetadata: Readonly<Record<string, unknown>>;
  readonly providerMetadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
}): FakeBillingReceipt | BillingIdempotencyKeyError => {
  const idempotencyKey = validateBillingIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey instanceof BillingIdempotencyKeyError) {
    return idempotencyKey;
  }

  return {
    receiptId: `billing_${input.workspaceSlug}_${idempotencyKey}`,
    workspaceSlug: input.workspaceSlug,
    mode: "fake",
    operation: input.operation,
    idempotencyKey,
    credits: input.credits,
    customerMetadata: "[redacted]",
    providerMetadata: "[redacted]",
    createdAt: input.createdAt,
  };
};
