import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { NotFound, ValidationFailed } from "../errors";
import { withMutationErrorCapture } from "../observability/errorCapture";
import pages from "./pages.spec";
import { isCurrentPageRevision, nextPageUpdatedAt } from "./pageRevision";
import { isAdvancingSnapshotVersion } from "./snapshotVersion";

const unsafeAssumeClockProvided = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const list = FunctionImpl.make(
  databaseSchema,
  pages,
  "list",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(workspaceId, "viewer"),
      );
      const reader = yield* DatabaseReader;
      return yield* reader
        .table("brainPages")
        .index("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
        .pipe(Effect.orDie);
    }),
);

const get = FunctionImpl.make(
  databaseSchema,
  pages,
  "get",
  ({ workspaceId, pageId }) =>
    Effect.gen(function* () {
      yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(workspaceId, "viewer"),
      );
      const reader = yield* DatabaseReader;
      const page = yield* reader
        .table("brainPages")
        .get(pageId)
        .pipe(Effect.orDie);
      if (page === null || page.workspaceId !== workspaceId) {
        return yield* new NotFound({ resource: "brainPages", id: pageId });
      }
      return page;
    }),
);

const createMarkdown = FunctionImpl.make(
  databaseSchema,
  pages,
  "createMarkdown",
  ({ workspaceId, slug, title, markdown }) =>
    withMutationErrorCapture(
      "brain/pages.createMarkdown",
      Effect.gen(function* () {
        yield* unsafeAssumeClockProvided(
          requireWorkspaceAccess(workspaceId, "editor"),
        );
        const updatedAt = yield* unsafeAssumeClockProvided(
          Clock.currentTimeMillis,
        );
        const writer = yield* DatabaseWriter;
        return yield* writer
          .table("brainPages")
          .insert({
            workspaceId,
            slug,
            title,
            markdown,
            sourceKind: "markdown",
            updatedAt,
          })
          .pipe(Effect.orDie);
      }),
    ),
);

const updateMarkdown = FunctionImpl.make(
  databaseSchema,
  pages,
  "updateMarkdown",
  ({ workspaceId, pageId, markdown, expectedUpdatedAt }) =>
    withMutationErrorCapture(
      "brain/pages.updateMarkdown",
      Effect.gen(function* () {
        yield* unsafeAssumeClockProvided(
          requireWorkspaceAccess(workspaceId, "editor"),
        );
        const reader = yield* DatabaseReader;
        const writer = yield* DatabaseWriter;
        const page = yield* reader
          .table("brainPages")
          .get(pageId)
          .pipe(Effect.orDie);
        if (page === null || page.workspaceId !== workspaceId) {
          return yield* new NotFound({ resource: "brainPages", id: pageId });
        }
        if (!isCurrentPageRevision(page.updatedAt, expectedUpdatedAt)) {
          return yield* new ValidationFailed({
            field: "expectedUpdatedAt",
            message: "Brain page changed after this editor loaded.",
          });
        }
        const clockNow = yield* unsafeAssumeClockProvided(
          Clock.currentTimeMillis,
        );
        const updatedAt = nextPageUpdatedAt(page.updatedAt, clockNow);
        yield* writer
          .table("brainPages")
          .patch(pageId, { markdown, updatedAt })
          .pipe(Effect.orDie);
        return { ...page, markdown, updatedAt };
      }),
    ),
);

const recordSnapshotInternal = FunctionImpl.make(
  databaseSchema,
  pages,
  "recordSnapshotInternal",
  ({ workspaceId, pageId, snapshot, version }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const page = yield* reader
        .table("brainPages")
        .get(pageId)
        .pipe(Effect.orDie);

      if (page === null) {
        return yield* new NotFound({ resource: "brainPages", id: pageId });
      }

      if (page.workspaceId !== workspaceId) {
        return yield* new ValidationFailed({
          field: "workspaceId",
          message: "Brain page does not belong to workspace.",
        });
      }

      if (!isAdvancingSnapshotVersion(page.editorSnapshotVersion, version)) {
        return yield* new ValidationFailed({
          field: "version",
          message: "Snapshot version must be a newer positive safe integer.",
        });
      }

      const updatedAt = yield* unsafeAssumeClockProvided(
        Clock.currentTimeMillis,
      );
      yield* writer
        .table("brainPages")
        .patch(pageId, {
          editorSnapshotJson: snapshot,
          editorSnapshotVersion: version,
          updatedAt,
        })
        .pipe(Effect.orDie);

      return { ok: true as const };
    }),
);

export default GroupImpl.make(databaseSchema, pages).pipe(
  Layer.provide(list),
  Layer.provide(get),
  Layer.provide(createMarkdown),
  Layer.provide(updateMarkdown),
  Layer.provide(recordSnapshotInternal),
  GroupImpl.finalize,
);
