import * as Data from "effect/Data";
import * as Result from "effect/Result";

/** Convex values permit at most 8,192 entries in an array. */
const MAX_CONVEX_ARRAY_ENTRIES = 8_192;

export const BOUNDED_BATCH_LIMITS = {
  maxItems: MAX_CONVEX_ARRAY_ENTRIES,
  batchSize: MAX_CONVEX_ARRAY_ENTRIES,
  fanOut: MAX_CONVEX_ARRAY_ENTRIES,
  stableIdentityLength: 128,
} as const;

export type BoundedBatchItemSource =
  | {
      readonly kind: "stable-identities";
      readonly identities: readonly string[];
    }
  | { readonly kind: "ordinals"; readonly count: number };

export type BoundedBatchPlanInput = {
  readonly maxItems: number;
  readonly batchSize: number;
  /** Maximum number of batch work units in one wave. */
  readonly fanOut: number;
  readonly items: BoundedBatchItemSource;
};

export type BoundedBatchPlanItem = {
  readonly ordinal: number;
  readonly instanceSuffix: string;
};

export type BoundedBatchPlanBatch = {
  readonly ordinal: number;
  readonly items: readonly BoundedBatchPlanItem[];
};

export type BoundedBatchPlanWave = {
  readonly ordinal: number;
  readonly batches: readonly BoundedBatchPlanBatch[];
};

export type BoundedBatchPlan = {
  readonly kind: "bounded-batch-plan";
  readonly maxItems: number;
  readonly batchSize: number;
  readonly fanOut: number;
  readonly identityMode: BoundedBatchItemSource["kind"];
  readonly empty: boolean;
  readonly itemCount: number;
  readonly batchCount: number;
  readonly waveCount: number;
  readonly waves: readonly BoundedBatchPlanWave[];
};

export type BoundedBatchPlanErrorCode =
  | "INVALID_BOUND"
  | "BOUND_EXCEEDED"
  | "BATCH_SIZE_EXCEEDS_MAX_ITEMS"
  | "INVALID_ITEM_COUNT"
  | "ITEM_LIMIT_EXCEEDED"
  | "INVALID_ITEM_IDENTITY"
  | "DUPLICATE_ITEM_IDENTITY";

export type BoundedBatchPlanErrorField =
  "maxItems" | "batchSize" | "fanOut" | "items" | "identity";

export class BoundedBatchPlanError extends Data.TaggedError(
  "BoundedBatchPlanError",
)<{
  readonly code: BoundedBatchPlanErrorCode;
  readonly field: BoundedBatchPlanErrorField;
  readonly safeMessage: "Bounded batch plan rejected.";
  readonly limit?: number;
  readonly ordinal?: number;
  readonly firstOrdinal?: number;
}> {}

const STABLE_ITEM_IDENTITY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ERROR_MESSAGE = "Bounded batch plan rejected." as const;

export const planBoundedBatch = (
  input: BoundedBatchPlanInput,
): Result.Result<BoundedBatchPlan, BoundedBatchPlanError> => {
  const bounds = [
    ["maxItems", input.maxItems],
    ["batchSize", input.batchSize],
    ["fanOut", input.fanOut],
  ] as const;
  for (const [field, value] of bounds) {
    const error = validateBound(field, value);
    if (error !== undefined) return Result.fail(error);
  }

  if (input.batchSize > input.maxItems) {
    return Result.fail(
      failure({
        code: "BATCH_SIZE_EXCEEDS_MAX_ITEMS",
        field: "batchSize",
        limit: input.maxItems,
      }),
    );
  }

  const itemCountError = validateItemCount(input.items, input.maxItems);
  if (itemCountError !== undefined) return Result.fail(itemCountError);

  const plannedItems = planItems(input.items);
  if (Result.isFailure(plannedItems)) return Result.fail(plannedItems.failure);

  const batches: BoundedBatchPlanBatch[] = [];
  for (
    let itemOffset = 0;
    itemOffset < plannedItems.success.length;
    itemOffset += input.batchSize
  ) {
    batches.push({
      ordinal: batches.length,
      items: plannedItems.success.slice(
        itemOffset,
        itemOffset + input.batchSize,
      ),
    });
  }

  const waves: BoundedBatchPlanWave[] = [];
  for (
    let batchOffset = 0;
    batchOffset < batches.length;
    batchOffset += input.fanOut
  ) {
    waves.push({
      ordinal: waves.length,
      batches: batches.slice(batchOffset, batchOffset + input.fanOut),
    });
  }

  return Result.succeed({
    kind: "bounded-batch-plan",
    maxItems: input.maxItems,
    batchSize: input.batchSize,
    fanOut: input.fanOut,
    identityMode: input.items.kind,
    empty: plannedItems.success.length === 0,
    itemCount: plannedItems.success.length,
    batchCount: batches.length,
    waveCount: waves.length,
    waves,
  });
};

const validateBound = (
  field: "maxItems" | "batchSize" | "fanOut",
  value: number,
): BoundedBatchPlanError | undefined => {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return failure({ code: "INVALID_BOUND", field });
  }
  const limit = BOUNDED_BATCH_LIMITS[field];
  return value > limit
    ? failure({ code: "BOUND_EXCEEDED", field, limit })
    : undefined;
};

const validateItemCount = (
  items: BoundedBatchItemSource,
  maxItems: number,
): BoundedBatchPlanError | undefined => {
  const count =
    items.kind === "stable-identities" ? items.identities.length : items.count;
  if (
    items.kind === "ordinals" &&
    (!Number.isFinite(count) || !Number.isInteger(count) || count < 0)
  ) {
    return failure({ code: "INVALID_ITEM_COUNT", field: "items" });
  }
  return count > maxItems
    ? failure({
        code: "ITEM_LIMIT_EXCEEDED",
        field: "items",
        limit: maxItems,
      })
    : undefined;
};

const planItems = (
  items: BoundedBatchItemSource,
): Result.Result<readonly BoundedBatchPlanItem[], BoundedBatchPlanError> => {
  if (items.kind === "ordinals") {
    return Result.succeed(
      Array.from({ length: items.count }, (_, ordinal) => ({
        ordinal,
        instanceSuffix: ordinalInstanceSuffix(ordinal),
      })),
    );
  }

  const firstOrdinalByIdentity = new Map<string, number>();
  const planned: BoundedBatchPlanItem[] = [];
  for (const [ordinal, identity] of items.identities.entries()) {
    if (
      typeof identity !== "string" ||
      identity.length > BOUNDED_BATCH_LIMITS.stableIdentityLength ||
      !STABLE_ITEM_IDENTITY.test(identity)
    ) {
      return Result.fail(
        failure({
          code: "INVALID_ITEM_IDENTITY",
          field: "identity",
          ordinal,
          limit: BOUNDED_BATCH_LIMITS.stableIdentityLength,
        }),
      );
    }
    const firstOrdinal = firstOrdinalByIdentity.get(identity);
    if (firstOrdinal !== undefined) {
      return Result.fail(
        failure({
          code: "DUPLICATE_ITEM_IDENTITY",
          field: "identity",
          ordinal,
          firstOrdinal,
        }),
      );
    }
    firstOrdinalByIdentity.set(identity, ordinal);
    planned.push({
      ordinal,
      instanceSuffix: stableIdentityInstanceSuffix(identity),
    });
  }
  return Result.succeed(planned);
};

const ordinalInstanceSuffix = (ordinal: number): string =>
  `n${String(ordinal).padStart(6, "0")}`;

const stableIdentityInstanceSuffix = (identity: string): string =>
  `k${identity.length}-${identity}`;

const failure = (
  input: Omit<
    ConstructorParameters<typeof BoundedBatchPlanError>[0],
    "safeMessage"
  >,
): BoundedBatchPlanError =>
  new BoundedBatchPlanError({ ...input, safeMessage: SAFE_ERROR_MESSAGE });
