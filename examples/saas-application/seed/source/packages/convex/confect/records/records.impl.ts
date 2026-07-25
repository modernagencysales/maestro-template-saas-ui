import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { NotFound, ValidationFailed } from "../errors";
import records from "./records.spec";

const withClock = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const list = FunctionImpl.make(
  databaseSchema,
  records,
  "list",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      yield* withClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const reader = yield* DatabaseReader;
      return yield* reader
        .table("records")
        .index("by_workspace", (query) => query.eq("workspaceId", workspaceId))
        .take(100)
        .pipe(Effect.orDie);
    }),
);

const read = FunctionImpl.make(
  databaseSchema,
  records,
  "read",
  ({ workspaceId, recordId }) =>
    Effect.gen(function* () {
      yield* withClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const reader = yield* DatabaseReader;
      const record = yield* reader
        .table("records")
        .get(recordId)
        .pipe(Effect.orDie);
      if (record === null || record.workspaceId !== workspaceId) {
        return yield* new NotFound({ resource: "records", id: recordId });
      }
      return record;
    }),
);

const create = FunctionImpl.make(
  databaseSchema,
  records,
  "create",
  ({ workspaceId, title, detail }) =>
    Effect.gen(function* () {
      yield* withClock(requireWorkspaceAccess(workspaceId, "editor"));
      const normalizedTitle = title.trim();
      if (normalizedTitle.length === 0) {
        return yield* new ValidationFailed({
          field: "title",
          message: "Record title is required.",
        });
      }
      const now = yield* withClock(Clock.currentTimeMillis);
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
      const created = yield* writer
        .table("records")
        .get(recordId)
        .pipe(Effect.orDie);
      if (created === null) {
        return yield* new NotFound({ resource: "records", id: recordId });
      }
      return created;
    }),
);

export default GroupImpl.make(databaseSchema, records).pipe(
  Layer.provide(list),
  Layer.provide(read),
  Layer.provide(create),
  GroupImpl.finalize,
);
