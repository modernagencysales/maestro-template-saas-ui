import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Context from "effect/Context";
import type { GenericId } from "convex/values";

import databaseSchema from "../_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../_generated/services";
import { transitionWorkflowAdmission } from "./_kit/ownership";
import stageObservations from "./stageObservations.spec";

const executionIdentity = FunctionImpl.make(
  databaseSchema,
  stageObservations,
  "executionIdentity",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      return yield* readWorkflowExecutionIdentity(reader, args);
    }),
);

const recordStarted = FunctionImpl.make(
  databaseSchema,
  stageObservations,
  "recordStarted",
  (args) => recordObservedStageStarted(args),
);

export const recordObservedStageStarted = (args: StageStartedArgs) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    yield* requireOwnedGeneration(reader, args);
    yield* markWorkflowRunDispatched(reader, writer, args.workflowRunId);
    const existing = yield* reader
      .table("workflowStageRuns")
      .index("by_run_generation_stage", (q) =>
        q
          .eq("workflowRunId", args.workflowRunId)
          .eq("lifecycleGeneration", args.lifecycleGeneration)
          .eq("stageKey", args.stageKey),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (existing) {
      yield* writer
        .table("workflowStageRuns")
        .patch(existing._id, {
          ...projection(args),
          status: "running",
          completedAt: null,
          errorJson: null,
          outputJson: null,
        })
        .pipe(Effect.orDie);
    } else {
      yield* writer
        .table("workflowStageRuns")
        .insert({
          ...projection(args),
          status: "running",
          attempt: args.attemptNumber ?? 1,
          startedAt: args.observedAt,
          completedAt: null,
          errorJson: null,
          outputJson: null,
        })
        .pipe(Effect.orDie);
    }
    return null;
  });
export const markWorkflowRunDispatched = (
  reader: Context.Service.Shape<typeof DatabaseReader>,
  writer: Context.Service.Shape<typeof DatabaseWriter>,
  workflowRunId: string,
) =>
  Effect.gen(function* () {
    const run = yield* reader
      .table("workflowRuns")
      .get(workflowRunId as GenericId<"workflowRuns">)
      .pipe(Effect.orDie);
    if (run?.status === "queued") {
      yield* writer
        .table("workflowRuns")
        .patch(run._id, { status: "running" })
        .pipe(Effect.orDie);
      const mutation = yield* MutationCtx;
      yield* transitionWorkflowAdmission(mutation, run._id, "running").pipe(
        Effect.orDie,
      );
    }
  });

const recordFinished = FunctionImpl.make(
  databaseSchema,
  stageObservations,
  "recordFinished",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      yield* requireOwnedGeneration(reader, args);
      const existing = yield* reader
        .table("workflowStageRuns")
        .index("by_run_generation_stage", (q) =>
          q
            .eq("workflowRunId", args.workflowRunId)
            .eq("lifecycleGeneration", args.lifecycleGeneration)
            .eq("stageKey", args.stageKey),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing) {
        yield* writer
          .table("workflowStageRuns")
          .patch(existing._id, {
            ...projection(args),
            status: args.status,
            completedAt: args.observedAt,
            errorJson: args.errorJson ?? null,
            outputJson: args.outputJson ?? null,
          })
          .pipe(Effect.orDie);
      }
      return null;
    }),
);

type StageProjectionArgs = {
  readonly workflowRunId: string;
  readonly componentWorkflowId: string;
  readonly nodeId: string;
  readonly label: string;
  readonly kind:
    | "source"
    | "capability"
    | "agent"
    | "delay"
    | "approval"
    | "output"
    | "subworkflow"
    | "event";
  readonly stageKey: string;
  readonly lifecycleGeneration: number;
  readonly externalEffect: boolean;
  readonly observedAt: number;
  readonly attemptNumber?: number | undefined;
  readonly order?: number | undefined;
};

type StageStartedArgs = StageProjectionArgs & { readonly status: "running" };

const projection = (args: StageProjectionArgs) => ({
  workflowRunId: args.workflowRunId,
  nodeId: args.nodeId,
  label: args.label,
  kind: args.kind,
  stageKey: args.stageKey,
  lifecycleGeneration: args.lifecycleGeneration,
  externalEffect: args.externalEffect,
  componentWorkflowId: args.componentWorkflowId,
  ...(args.attemptNumber ? { attemptNumber: args.attemptNumber } : {}),
  ...(args.order !== undefined ? { order: args.order } : {}),
});

const requireOwnedGeneration = (
  reader: Context.Service.Shape<typeof DatabaseReader>,
  args: {
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
    readonly lifecycleGeneration: number;
  },
) =>
  reader
    .table("workflowRuns")
    .get(args.workflowRunId as GenericId<"workflowRuns">)
    .pipe(
      Effect.orDie,
      Effect.flatMap((run) =>
        run?.lifecycleGeneration === args.lifecycleGeneration &&
        componentIdentityMatches(run, args.componentWorkflowId)
          ? Effect.void
          : Effect.die(
              new Error("Observed workflow stage ownership mismatch."),
            ),
      ),
    );

export const readWorkflowExecutionIdentity = (
  reader: Context.Service.Shape<typeof DatabaseReader>,
  args: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
  },
) =>
  reader
    .table("workflowRuns")
    .get(args.workflowRunId as GenericId<"workflowRuns">)
    .pipe(
      Effect.orDie,
      Effect.flatMap((run) =>
        run !== null &&
        run.workspaceId === args.workspaceId &&
        run.lifecycleGeneration != null &&
        componentIdentityMatches(run, args.componentWorkflowId)
          ? Effect.succeed({
              generation: run.lifecycleGeneration,
              observedAt: run.startedAt,
            })
          : Effect.die(
              new Error("Workflow execution identity is unavailable."),
            ),
      ),
    );

const componentIdentityMatches = (
  run: {
    readonly componentWorkflowId?: string | undefined;
    readonly lifecycleGeneration?: number | null | undefined;
  },
  componentWorkflowId: string,
) =>
  run.componentWorkflowId === componentWorkflowId ||
  (run.componentWorkflowId === undefined && run.lifecycleGeneration === 0);

export default GroupImpl.make(databaseSchema, stageObservations).pipe(
  Layer.provide(executionIdentity),
  Layer.provide(recordStarted),
  Layer.provide(recordFinished),
  GroupImpl.finalize,
);
