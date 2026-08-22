import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import type * as Context from "effect/Context";
import type { GenericId } from "convex/values";
import { makeFunctionReference } from "convex/server";

import databaseSchema from "../_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../_generated/services";
import { ValidationFailed } from "../errors";
import {
  authorizeWorkflowLifecycle,
  makeWorkflowLifecycleMutationControls,
  makeWorkflowLifecycleQueryControls,
  runWorkflowLifecycleControl,
} from "./lifecycleAdapters";
import lifecycle from "./lifecycle.spec";
import {
  completionAdmissionStatus,
  reconcileWorkflowCompletion,
} from "./lifecycleReconciliationCurrent";
import { runBoundedWorkflowRetentionSweep } from "./_kit/lifecycleSweep";
import { transitionWorkflowAdmission } from "./_kit/ownership";
import { planWorkflowDeadlineRestart } from "./_kit/workflowDeadline";

const reconcileDeadlineRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:reconcile",
);
const scheduleDeadlineRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:schedule",
);
type Mutation = Context.Service.Shape<typeof MutationCtx>;

const cancel = FunctionImpl.make(databaseSchema, lifecycle, "cancel", (args) =>
  Effect.gen(function* () {
    const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const mutation = yield* MutationCtx;
    const controls = makeWorkflowLifecycleMutationControls(
      reader,
      writer,
      mutation,
      principal,
    );
    const run = yield* reader
      .table("workflowRuns")
      .get(args.workflowRunId)
      .pipe(Effect.orDie);
    const result = yield* runWorkflowLifecycleControl(args.workflowRunId, () =>
      controls.cancel(principal, args),
    );
    if (
      run?.lifecycleGeneration !== undefined &&
      run.lifecycleGeneration !== null
    ) {
      yield* reconcileDeadline(
        mutation,
        args.workflowRunId,
        run.lifecycleGeneration,
      );
    }
    return result;
  }),
);

const list = FunctionImpl.make(databaseSchema, lifecycle, "list", (args) =>
  Effect.gen(function* () {
    const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
    const reader = yield* DatabaseReader;
    const controls = makeWorkflowLifecycleQueryControls(reader, principal);
    return yield* runWorkflowLifecycleControl("list", () =>
      controls.list(principal, args),
    );
  }),
);

const listByName = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "listByName",
  (args) =>
    Effect.gen(function* () {
      const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
      const reader = yield* DatabaseReader;
      const controls = makeWorkflowLifecycleQueryControls(reader, principal);
      return yield* runWorkflowLifecycleControl("listByName", () =>
        controls.listByName(principal, args),
      );
    }),
);

const listSteps = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "listSteps",
  (args) =>
    Effect.gen(function* () {
      const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
      const reader = yield* DatabaseReader;
      const controls = makeWorkflowLifecycleQueryControls(reader, principal);
      return yield* runWorkflowLifecycleControl(args.workflowRunId, () =>
        controls.listSteps(principal, args),
      );
    }),
);

const cleanup = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "cleanup",
  (args) =>
    Effect.gen(function* () {
      const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const mutation = yield* MutationCtx;
      const controls = makeWorkflowLifecycleMutationControls(
        reader,
        writer,
        mutation,
        principal,
      );
      return yield* runWorkflowLifecycleControl(args.workflowRunId, () =>
        controls.cleanup(principal, args),
      );
    }),
);

const restart = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "restart",
  (args) =>
    Effect.gen(function* () {
      const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const mutation = yield* MutationCtx;
      const controls = makeWorkflowLifecycleMutationControls(
        reader,
        writer,
        mutation,
        principal,
      );
      const run = yield* reader
        .table("workflowRuns")
        .get(args.workflowRunId)
        .pipe(Effect.orDie);
      const restartDeadline = planWorkflowDeadlineRestart({
        deadlineAt: run?.deadlineAt,
        timeoutMs: run?.timeoutMs,
        occurredAt: args.occurredAt,
      });
      if (Result.isFailure(restartDeadline)) {
        return yield* new ValidationFailed({
          field: "deadline",
          message: restartDeadline.failure.message,
        });
      }
      const result = yield* runWorkflowLifecycleControl(
        args.workflowRunId,
        () => controls.restart(principal, args),
      );
      yield* reconcileDeadline(
        mutation,
        args.workflowRunId,
        result.generation - 1,
      );
      if (restartDeadline.success.kind === "schedule") {
        yield* scheduleDeadline(
          mutation,
          args.workspaceId,
          args.workflowRunId,
          restartDeadline.success.requestedAt,
          restartDeadline.success.horizonMs,
        );
      }
      return result;
    }),
);

const reconcileCompletion = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "reconcileCompletion",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const reconciled = yield* reconcileWorkflowCompletion(
        reader,
        writer,
        args,
      ).pipe(
        Effect.mapError(
          (error) =>
            new ValidationFailed({
              field: "onComplete",
              message: error.message,
            }),
        ),
      );
      const mutation = yield* MutationCtx;
      const run = yield* reader
        .table("workflowRuns")
        .get(args.context.workflowRunId as GenericId<"workflowRuns">)
        .pipe(Effect.orDie);
      yield* transitionWorkflowAdmission(
        mutation,
        args.context.workflowRunId as GenericId<"workflowRuns">,
        completionAdmissionStatus(reconciled.status, run?.status),
      ).pipe(Effect.orDie);
      yield* reconcileDeadline(
        mutation,
        args.context.workflowRunId as GenericId<"workflowRuns">,
        args.context.generation,
      );
      return reconciled;
    }),
);

const reconcileDeadline = (
  mutation: Mutation,
  workflowRunId: GenericId<"workflowRuns">,
  generation: number,
) =>
  Effect.tryPromise({
    try: () =>
      mutation.runMutation(reconcileDeadlineRef, { workflowRunId, generation }),
    catch: () =>
      new ValidationFailed({
        field: "deadline",
        message: "Workflow deadline reconciliation failed.",
      }),
  });

const scheduleDeadline = (
  mutation: Mutation,
  workspaceId: GenericId<"workspaces">,
  workflowRunId: GenericId<"workflowRuns">,
  requestedAt: number,
  horizonMs: number,
) =>
  Effect.tryPromise({
    try: () =>
      mutation.runMutation(scheduleDeadlineRef, {
        workspaceId,
        workflowRunId,
        requestedAt,
        horizonMs,
      }),
    catch: () =>
      new ValidationFailed({
        field: "deadline",
        message: "Restarted workflow deadline could not be scheduled.",
      }),
  });

const reconcileCleanup = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "reconcileCleanup",
  (args) =>
    Effect.gen(function* () {
      const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const mutation = yield* MutationCtx;
      const controls = makeWorkflowLifecycleMutationControls(
        reader,
        writer,
        mutation,
        principal,
      );
      return yield* runWorkflowLifecycleControl(args.workflowRunId, () =>
        controls.reconcileCleanup(principal, args),
      );
    }),
);

const sweepRetention = FunctionImpl.make(
  databaseSchema,
  lifecycle,
  "sweepRetention",
  (args) =>
    Effect.gen(function* () {
      const principal = yield* authorizeWorkflowLifecycle(args.workspaceId);
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const mutation = yield* MutationCtx;
      const controls = makeWorkflowLifecycleMutationControls(
        reader,
        writer,
        mutation,
        principal,
      );
      return yield* runWorkflowLifecycleControl("retention-sweep", () =>
        runBoundedWorkflowRetentionSweep(controls, principal, args),
      );
    }),
);

export default GroupImpl.make(databaseSchema, lifecycle).pipe(
  Layer.provide(cancel),
  Layer.provide(restart),
  Layer.provide(reconcileCompletion),
  Layer.provide(reconcileCleanup),
  Layer.provide(sweepRetention),
  Layer.provide(list),
  Layer.provide(listByName),
  Layer.provide(listSteps),
  Layer.provide(cleanup),
  GroupImpl.finalize,
);
