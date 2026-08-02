import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  BOUNDED_BATCH_LIMITS,
  BoundedBatchPlanError,
  planBoundedBatch,
  type BoundedBatchPlanInput,
} from "../confect/workflows/_kit/boundedBatch";

const baseInput: BoundedBatchPlanInput = {
  maxItems: 8,
  batchSize: 2,
  fanOut: 2,
  items: { kind: "ordinals", count: 5 },
};

const leftError = (input: BoundedBatchPlanInput): BoundedBatchPlanError => {
  const result = planBoundedBatch(input);
  expect(Result.isFailure(result)).toBe(true);
  if (Result.isSuccess(result)) {
    throw new Error("expected bounded batch planning to fail");
  }
  return result.failure;
};

describe("bounded workflow batch planning", () => {
  it.each([
    ["maxItems", 0],
    ["maxItems", -1],
    ["maxItems", 1.5],
    ["maxItems", Number.NaN],
    ["maxItems", Number.POSITIVE_INFINITY],
    ["batchSize", 0],
    ["batchSize", -1],
    ["batchSize", 1.5],
    ["batchSize", Number.NaN],
    ["batchSize", Number.POSITIVE_INFINITY],
    ["fanOut", 0],
    ["fanOut", -1],
    ["fanOut", 1.5],
    ["fanOut", Number.NaN],
    ["fanOut", Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid %s values", (field, value) => {
    expect(leftError({ ...baseInput, [field]: value })).toMatchObject({
      _tag: "BoundedBatchPlanError",
      code: "INVALID_BOUND",
      field,
      safeMessage: "Bounded batch plan rejected.",
    });
  });

  it.each([
    ["maxItems", BOUNDED_BATCH_LIMITS.maxItems + 1],
    ["batchSize", BOUNDED_BATCH_LIMITS.batchSize + 1],
    ["fanOut", BOUNDED_BATCH_LIMITS.fanOut + 1],
  ] as const)(
    "rejects excessive %s values instead of clamping",
    (field, value) => {
      expect(leftError({ ...baseInput, [field]: value })).toMatchObject({
        code: "BOUND_EXCEEDED",
        field,
        limit: BOUNDED_BATCH_LIMITS[field],
      });
    },
  );

  it("rejects a batch size larger than the declared item bound", () => {
    expect(
      leftError({
        ...baseInput,
        maxItems: 3,
        batchSize: 4,
        items: { kind: "ordinals", count: 0 },
      }),
    ).toMatchObject({
      code: "BATCH_SIZE_EXCEEDS_MAX_ITEMS",
      field: "batchSize",
      limit: 3,
    });
  });

  it("builds deterministic waves of bounded batches in source order", () => {
    const result = planBoundedBatch({
      maxItems: 6,
      batchSize: 2,
      fanOut: 2,
      items: {
        kind: "stable-identities",
        identities: [
          "source-1",
          "source-2",
          "source-3",
          "source-4",
          "source-5",
        ],
      },
    });

    expect(result).toEqual(
      Result.succeed({
        kind: "bounded-batch-plan",
        maxItems: 6,
        batchSize: 2,
        fanOut: 2,
        identityMode: "stable-identities",
        empty: false,
        itemCount: 5,
        batchCount: 3,
        waveCount: 2,
        waves: [
          {
            ordinal: 0,
            batches: [
              {
                ordinal: 0,
                items: [
                  { ordinal: 0, instanceSuffix: "k8-source-1" },
                  { ordinal: 1, instanceSuffix: "k8-source-2" },
                ],
              },
              {
                ordinal: 1,
                items: [
                  { ordinal: 2, instanceSuffix: "k8-source-3" },
                  { ordinal: 3, instanceSuffix: "k8-source-4" },
                ],
              },
            ],
          },
          {
            ordinal: 1,
            batches: [
              {
                ordinal: 2,
                items: [{ ordinal: 4, instanceSuffix: "k8-source-5" }],
              },
            ],
          },
        ],
      }),
    );
  });

  it("derives deterministic ordinal suffixes when no stable identity exists", () => {
    const result = planBoundedBatch({
      maxItems: 4,
      batchSize: 2,
      fanOut: 1,
      items: { kind: "ordinals", count: 3 },
    });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) return;
    expect(
      result.success.waves.flatMap((wave) =>
        wave.batches.flatMap((batch) => batch.items),
      ),
    ).toEqual([
      { ordinal: 0, instanceSuffix: "n000000" },
      { ordinal: 1, instanceSuffix: "n000001" },
      { ordinal: 2, instanceSuffix: "n000002" },
    ]);
  });

  it("rejects item overflow instead of truncating produced work", () => {
    expect(
      leftError({
        maxItems: 2,
        batchSize: 1,
        fanOut: 1,
        items: { kind: "ordinals", count: 3 },
      }),
    ).toMatchObject({
      code: "ITEM_LIMIT_EXCEEDED",
      field: "items",
      limit: 2,
    });

    expect(
      leftError({
        maxItems: 2,
        batchSize: 1,
        fanOut: 1,
        items: {
          kind: "stable-identities",
          identities: ["one", "two", "three"],
        },
      }),
    ).toMatchObject({
      code: "ITEM_LIMIT_EXCEEDED",
      field: "items",
      limit: 2,
    });
  });

  it("keeps every produced-work dimension within its declared bound", () => {
    const result = planBoundedBatch({
      maxItems: 17,
      batchSize: 3,
      fanOut: 2,
      items: { kind: "ordinals", count: 17 },
    });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) return;
    const batches = result.success.waves.flatMap((wave) => wave.batches);
    const items = batches.flatMap((batch) => batch.items);
    expect(items).toHaveLength(17);
    expect(items.length).toBeLessThanOrEqual(result.success.maxItems);
    expect(
      result.success.waves.every(
        (wave) => wave.batches.length <= result.success.fanOut,
      ),
    ).toBe(true);
    expect(
      batches.every((batch) => batch.items.length <= result.success.batchSize),
    ).toBe(true);
    expect(
      new Set(items.map(({ instanceSuffix }) => instanceSuffix)).size,
    ).toBe(items.length);
  });

  it("rejects invalid and duplicate identities without leaking their values", () => {
    const privateIdentity = "private customer payload";
    const invalid = leftError({
      ...baseInput,
      items: {
        kind: "stable-identities",
        identities: ["valid", privateIdentity],
      },
    });
    expect(invalid).toMatchObject({
      code: "INVALID_ITEM_IDENTITY",
      field: "identity",
      ordinal: 1,
      limit: BOUNDED_BATCH_LIMITS.stableIdentityLength,
    });
    expect(JSON.stringify(invalid)).not.toContain(privateIdentity);

    const duplicateIdentity = "must-not-leak";
    const duplicate = leftError({
      ...baseInput,
      items: {
        kind: "stable-identities",
        identities: [duplicateIdentity, "other", duplicateIdentity],
      },
    });
    expect(duplicate).toMatchObject({
      code: "DUPLICATE_ITEM_IDENTITY",
      field: "identity",
      firstOrdinal: 0,
      ordinal: 2,
    });
    expect(JSON.stringify(duplicate)).not.toContain(duplicateIdentity);
  });

  it("rejects invalid ordinal counts with safe typed errors", () => {
    for (const count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        leftError({
          ...baseInput,
          items: { kind: "ordinals", count },
        }),
      ).toMatchObject({
        code: "INVALID_ITEM_COUNT",
        field: "items",
      });
    }
  });

  it.each([
    { kind: "ordinals", count: 0 } as const,
    { kind: "stable-identities", identities: [] } as const,
  ])("returns an explicit empty plan for $kind input", (items) => {
    expect(planBoundedBatch({ ...baseInput, items })).toEqual(
      Result.succeed({
        kind: "bounded-batch-plan",
        maxItems: 8,
        batchSize: 2,
        fanOut: 2,
        identityMode: items.kind,
        empty: true,
        itemCount: 0,
        batchCount: 0,
        waveCount: 0,
        waves: [],
      }),
    );
  });

  it("returns deterministic JSON-serializable data without mutating input", () => {
    const identities = ["alpha", "beta", "gamma"];
    const input: BoundedBatchPlanInput = {
      maxItems: 3,
      batchSize: 2,
      fanOut: 1,
      items: { kind: "stable-identities", identities },
    };
    const first = planBoundedBatch(input);
    const second = planBoundedBatch(input);

    expect(first).toEqual(second);
    expect(identities).toEqual(["alpha", "beta", "gamma"]);
    expect(Result.isSuccess(first)).toBe(true);
    if (Result.isFailure(first)) return;
    expect(JSON.parse(JSON.stringify(first.success))).toEqual(first.success);
  });
});
