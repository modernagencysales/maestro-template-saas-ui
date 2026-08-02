import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import versioning, {
  AppendVersionArgs,
  LatestVersionArgs,
  MarkFreshnessArgs,
  ReconcileVersionArgs,
  RestoreVersionArgs,
  VersionFreshnessReturn,
  VersioningError,
  VersionedEntryReturn,
} from "../confect/ops/versioning.spec";
import versioningImpl from "../confect/ops/versioning.impl";
import versionFreshness from "../confect/tables/versionFreshness";
import versionedEntries from "../confect/tables/versionedEntries";
import { testConfectLayer } from "./support/confect";

describe("versioning Confect contracts", () => {
  it("declares append-only history and mutable freshness tables", () => {
    expect(versionedEntries.indexes).toMatchObject({
      by_entity: ["workspaceId", "entityKey"],
      by_entity_version: ["workspaceId", "entityKey", "versionKey"],
      by_reconciliation: ["workspaceId", "entityKey", "reconciliationKey"],
    });
    expect(versionFreshness.indexes).toMatchObject({
      by_entity: ["workspaceId", "entityKey"],
      by_status: ["workspaceId", "status"],
    });
  });

  it("validates append, restore, reconcile, freshness, and latest args", () => {
    expect(
      Schema.decodeUnknownSync(AppendVersionArgs)({
        workspaceId: "workspace_123",
        entityKey: "brain/page/founder-notes",
        versionKey: "v1",
        causation: "human-edit",
        actorId: "user_123",
        payloadHash: "sha256:abc",
        payloadJson: '{"title":"Founder notes"}',
        idempotencyKey: "append-v1",
      }),
    ).toMatchObject({ causation: "human-edit" });

    expect(
      Schema.decodeUnknownSync(RestoreVersionArgs)({
        workspaceId: "workspace_123",
        entityKey: "brain/page/founder-notes",
        restoredFromVersionKey: "v1",
        versionKey: "v3",
        actorId: "user_123",
        payloadHash: "sha256:restore",
        payloadJson: '{"title":"Restored"}',
        idempotencyKey: "restore-v3",
      }),
    ).toMatchObject({ restoredFromVersionKey: "v1" });

    expect(
      Schema.decodeUnknownSync(ReconcileVersionArgs)({
        workspaceId: "workspace_123",
        entityKey: "crm/account/acme",
        externalVersion: "salesforce:001:7",
        actorId: "sync_worker",
        payloadHash: "sha256:crm",
        payloadJson: '{"accountName":"Acme"}',
        idempotencyKey: "sync-001",
      }),
    ).toMatchObject({ externalVersion: "salesforce:001:7" });

    expect(
      Schema.decodeUnknownSync(MarkFreshnessArgs)({
        workspaceId: "workspace_123",
        entityKey: "brain/page/founder-notes",
        status: "review-due",
        reason: "Source is older than 30 days.",
        nextReviewAt: 1_702_678_400_000,
      }),
    ).toMatchObject({ status: "review-due" });

    expect(
      Schema.decodeUnknownSync(LatestVersionArgs)({
        workspaceId: "workspace_123",
        entityKey: "brain/page/founder-notes",
      }),
    ).toEqual({
      workspaceId: "workspace_123",
      entityKey: "brain/page/founder-notes",
    });
  });

  it("declares append-only version and separate freshness return schemas", () => {
    expect(
      Schema.decodeUnknownSync(VersionedEntryReturn)({
        workspaceId: "workspace_123",
        entityKey: "brain/page/founder-notes",
        versionKey: "v3",
        priorVersionKey: "v1",
        restoredFromVersionKey: "v1",
        causation: "restore",
        actorId: "user_123",
        payloadHash: "sha256:restore",
        payloadJson: '{"title":"Restored"}',
        idempotencyKey: "restore-v3",
        appendOnly: true,
        createdAt: 1,
      }),
    ).toMatchObject({
      causation: "restore",
      appendOnly: true,
      restoredFromVersionKey: "v1",
    });

    expect(
      Schema.decodeUnknownSync(VersionFreshnessReturn)({
        workspaceId: "workspace_123",
        entityKey: "brain/page/founder-notes",
        status: "review-due",
        reason: "Source is older than 30 days.",
        checkedAt: 1,
        nextReviewAt: 2,
        mutableFreshness: true,
      }),
    ).toMatchObject({
      status: "review-due",
      mutableFreshness: true,
    });
  });

  it("declares public-safe typed errors", () => {
    const encoded = [
      new VersioningError.InvalidCausation({ causation: "botched-merge" }),
      new VersioningError.VersionNotFound({
        entityKey: "brain/page/founder-notes",
        versionKey: "v404",
      }),
      new VersioningError.ValidationFailed({
        field: "entityKey",
        message: "entityKey is required.",
      }),
    ].map((error) => Schema.encodeSync(VersioningError.Schema)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "InvalidCausation",
      "VersionNotFound",
      "ValidationFailed",
    ]);
    expect(JSON.stringify(encoded)).not.toContain("secret");
  });

  it("registers versioning public Confect functions", () => {
    const serialized = JSON.stringify(versioning);

    expect(serialized).toContain("append");
    expect(serialized).toContain("restore");
    expect(serialized).toContain("reconcile");
    expect(serialized).toContain("markFreshness");
    expect(serialized).toContain("latest");
    expect(serialized).toContain("public");
  });

  it("exports a finalized fake/local Confect implementation", () => {
    expect(Layer.isLayer(versioningImpl)).toBe(true);
  });

  it("rejects padded append idempotency keys before creating append-only history", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.versioning.append, {
          workspaceId: "workspace_123",
          entityKey: "brain/page/founder-notes",
          versionKey: "v1",
          causation: "human-edit",
          actorId: "user_123",
          payloadHash: "sha256:abc",
          payloadJson: '{"title":"Founder notes"}',
          idempotencyKey: " append-v1 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(VersioningError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });

  it("rejects padded restore idempotency keys before creating append-only history", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.versioning.restore, {
          workspaceId: "workspace_123",
          entityKey: "brain/page/founder-notes",
          restoredFromVersionKey: "v1",
          versionKey: "v3",
          actorId: "user_123",
          payloadHash: "sha256:restore",
          payloadJson: '{"title":"Restored"}',
          idempotencyKey: " restore-v3 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(VersioningError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });

  it("rejects padded reconcile idempotency keys before creating append-only history", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.versioning.reconcile, {
          workspaceId: "workspace_123",
          entityKey: "crm/account/acme",
          externalVersion: "salesforce:001:7",
          actorId: "sync_worker",
          payloadHash: "sha256:crm",
          payloadJson: '{"accountName":"Acme"}',
          idempotencyKey: " sync-001 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(VersioningError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });
});
