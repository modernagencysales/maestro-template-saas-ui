import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId, Value } from "convex/values";
import * as Clock from "effect/Clock";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { NotFound, Unauthorized, ValidationFailed } from "../errors";
import {
  assertWorkflowArtifactDeletable,
  fromStoredWorkflowArtifact,
  prepareWorkflowArtifact,
  resolveWorkflowArtifactReference,
  toStoredWorkflowArtifact,
  type StoredWorkflowArtifactRow,
  type WorkflowArtifactRow,
  type WorkflowArtifactRun,
} from "./_kit/workflowArtifacts";
import artifacts from "./artifacts.spec";

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const put = FunctionImpl.make(databaseSchema, artifacts, "put", (args) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const run = yield* loadOwnedRun(reader, args);
    const row = yield* contract(() =>
      prepareWorkflowArtifact(run, { ...args, content: args.content as Value }),
    );
    const existing = yield* reader
      .table("workflowArtifacts")
      .index("by_run_reference", (q) =>
        q
          .eq("workflowRunId", args.workflowRunId)
          .eq("referenceKey", args.referenceKey),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (existing) {
      const resolved = yield* contract(() =>
        resolveWorkflowArtifactReference(toRuntimeRow(existing), row),
      );
      if (resolved) return reference(resolved.artifactId, resolved.row);
    }
    const writer = yield* DatabaseWriter;
    const stored = yield* contract(() => toStoredWorkflowArtifact(row));
    const artifactId = yield* writer
      .table("workflowArtifacts")
      .insert({
        ...stored,
        workspaceId: args.workspaceId,
        workflowRunId: args.workflowRunId,
      })
      .pipe(Effect.orDie);
    return reference(artifactId, row);
  }),
);

const getOwned = FunctionImpl.make(
  databaseSchema,
  artifacts,
  "getOwned",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const row = yield* loadArtifact(reader, args.artifactId);
      const resolved = resolveWorkflowArtifactReference(row, args);
      if (!resolved) return yield* unavailable(args.artifactId);
      return valueProjection(resolved.artifactId, resolved.row);
    }),
);

const get = FunctionImpl.make(
  databaseSchema,
  artifacts,
  "get",
  ({ artifactId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const row = yield* loadArtifact(reader, artifactId);
      const minimumRole = row.sensitivity === "restricted" ? "admin" : "viewer";
      yield* withConfectClock(
        requireWorkspaceAccess(
          row.workspaceId as GenericId<"workspaces">,
          minimumRole,
        ),
      ).pipe(
        Effect.mapError((error) =>
          error instanceof Unauthorized
            ? error
            : new NotFound({ resource: "workflowArtifacts", id: artifactId }),
        ),
      );
      return valueProjection(artifactId, row);
    }),
);

const remove = FunctionImpl.make(databaseSchema, artifacts, "remove", (args) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const row = yield* loadArtifact(reader, args.artifactId);
    if (
      !resolveWorkflowArtifactReference(row, {
        workspaceId: args.workspaceId,
        workflowRunId: args.workflowRunId,
        artifactId: args.artifactId,
      })
    ) {
      return yield* unavailable(args.artifactId);
    }
    const run = yield* loadOwnedRun(reader, {
      workspaceId: args.workspaceId,
      workflowRunId: args.workflowRunId,
      workflowId: row.workflowId,
      workflowVersion: row.workflowVersion,
      lifecycleGeneration: row.lifecycleGeneration,
    });
    yield* contract(() => assertWorkflowArtifactDeletable(run, row, args.now));
    const writer = yield* DatabaseWriter;
    yield* writer.table("workflowArtifacts").delete(row._id).pipe(Effect.orDie);
    return null;
  }),
);

type Reader = Context.Service.Shape<typeof DatabaseReader>;

const loadOwnedRun = (
  reader: Reader,
  args: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly workflowId: string;
    readonly workflowVersion: number;
    readonly lifecycleGeneration: number;
  },
) =>
  reader
    .table("workflowRuns")
    .get(args.workflowRunId as GenericId<"workflowRuns">)
    .pipe(
      Effect.orDie,
      Effect.flatMap((row) => {
        if (
          row === null ||
          row.workspaceId !== args.workspaceId ||
          row.workflowId !== args.workflowId ||
          row.workflowVersion !== args.workflowVersion ||
          row.lifecycleGeneration !== args.lifecycleGeneration
        ) {
          return unavailable(args.workflowRunId);
        }
        return Effect.succeed({
          ...row,
          workflowRunId: row._id,
          lifecycleGeneration: args.lifecycleGeneration,
        } satisfies WorkflowArtifactRun);
      }),
    );

const loadArtifact = (reader: Reader, artifactId: string) =>
  reader
    .table("workflowArtifacts")
    .get(artifactId as GenericId<"workflowArtifacts">)
    .pipe(
      Effect.orDie,
      Effect.flatMap((row) =>
        row
          ? Effect.try({
              try: () => toRuntimeRow(row),
              catch: () =>
                new NotFound({ resource: "workflowArtifacts", id: artifactId }),
            })
          : unavailable(artifactId),
      ),
    );

const toRuntimeRow = (
  row: StoredWorkflowArtifactRow & {
    readonly _id: GenericId<"workflowArtifacts">;
  },
): WorkflowArtifactRow & { readonly _id: GenericId<"workflowArtifacts"> } => ({
  ...fromStoredWorkflowArtifact(row),
  _id: row._id,
});

const reference = (artifactId: string, row: WorkflowArtifactRow) => ({
  artifactId: artifactId as GenericId<"workflowArtifacts">,
  contentHash: row.contentHash,
  measuredBytes: row.measuredBytes,
  sensitivity: row.sensitivity,
});

const valueProjection = (artifactId: string, row: WorkflowArtifactRow) => ({
  ...reference(artifactId, row),
  workflowRunId: row.workflowRunId as GenericId<"workflowRuns">,
  workflowId: row.workflowId,
  workflowVersion: row.workflowVersion,
  lifecycleGeneration: row.lifecycleGeneration,
  referenceKey: row.referenceKey,
  kind: row.kind,
  content: row.content,
  retentionUntil: row.retentionUntil,
});

const contract = <A>(evaluate: () => A) =>
  Effect.try({
    try: evaluate,
    catch: () =>
      new ValidationFailed({
        field: "workflowArtifact",
        message: "Workflow artifact is unavailable.",
      }),
  });

const unavailable = (id: string) =>
  Effect.fail(new NotFound({ resource: "workflowArtifacts", id }));

export default GroupImpl.make(databaseSchema, artifacts).pipe(
  Layer.provide(put),
  Layer.provide(getOwned),
  Layer.provide(get),
  Layer.provide(remove),
  GroupImpl.finalize,
);
