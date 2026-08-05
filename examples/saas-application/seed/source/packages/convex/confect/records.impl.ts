import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter } from "./_generated/services";
import {
  requireWorkspaceAccess,
  requireWorkspaceActorAccess,
} from "./capabilities/_kit/workspaceAccess";
import { NotFound, ValidationFailed } from "./errors";
import records from "./records.spec";

const withClock = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const listRecords = (workspaceId: GenericId<"workspaces">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("records")
      .index("by_workspace", (query) => query.eq("workspaceId", workspaceId))
      .take(100)
      .pipe(Effect.orDie);
  });

const readRecord = (
  workspaceId: GenericId<"workspaces">,
  recordId: GenericId<"records">,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const record = yield* reader
      .table("records")
      .get(recordId)
      .pipe(Effect.orDie);
    if (record === null || record.workspaceId !== workspaceId) {
      return yield* new NotFound({ resource: "records", id: recordId });
    }
    return record;
  });

const createRecord = (
  workspaceId: GenericId<"workspaces">,
  title: string,
  detail: string,
) =>
  Effect.gen(function* () {
    const normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      return yield* new ValidationFailed({
        field: "title",
        message: "Record title is required.",
      });
    }
    const now = yield* withClock(Clock.currentTimeMillis);
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const recordId = yield* writer
      .table("records")
      .insert({
        workspaceId,
        title: normalizedTitle,
        detail: detail.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const created = yield* reader
      .table("records")
      .get(recordId)
      .pipe(Effect.orDie);
    if (created === null) {
      return yield* new NotFound({ resource: "records", id: recordId });
    }
    return created;
  });

const list = FunctionImpl.make(
  databaseSchema,
  records,
  "list",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      yield* withClock(requireWorkspaceAccess(workspaceId, "viewer"));
      return yield* listRecords(workspaceId);
    }),
);

const read = FunctionImpl.make(
  databaseSchema,
  records,
  "read",
  ({ workspaceId, recordId }) =>
    Effect.gen(function* () {
      yield* withClock(requireWorkspaceAccess(workspaceId, "viewer"));
      return yield* readRecord(workspaceId, recordId);
    }),
);

const create = FunctionImpl.make(
  databaseSchema,
  records,
  "create",
  ({ workspaceId, title, detail }) =>
    Effect.gen(function* () {
      yield* withClock(requireWorkspaceAccess(workspaceId, "editor"));
      return yield* createRecord(workspaceId, title, detail);
    }),
);

const listForActor = FunctionImpl.make(
  databaseSchema,
  records,
  "listForActor",
  ({ workspaceId, userId }) =>
    Effect.gen(function* () {
      yield* withClock(
        requireWorkspaceActorAccess(workspaceId, userId, "viewer"),
      );
      return yield* listRecords(workspaceId);
    }),
);

const readForActor = FunctionImpl.make(
  databaseSchema,
  records,
  "readForActor",
  ({ workspaceId, userId, recordId }) =>
    Effect.gen(function* () {
      yield* withClock(
        requireWorkspaceActorAccess(workspaceId, userId, "viewer"),
      );
      return yield* readRecord(workspaceId, recordId);
    }),
);

const createForActor = FunctionImpl.make(
  databaseSchema,
  records,
  "createForActor",
  ({ workspaceId, userId, title, detail }) =>
    Effect.gen(function* () {
      yield* withClock(
        requireWorkspaceActorAccess(workspaceId, userId, "editor"),
      );
      return yield* createRecord(workspaceId, title, detail);
    }),
);

export default GroupImpl.make(databaseSchema, records).pipe(
  Layer.provide(list),
  Layer.provide(read),
  Layer.provide(create),
  Layer.provide(listForActor),
  Layer.provide(readForActor),
  Layer.provide(createForActor),
  GroupImpl.finalize,
);
