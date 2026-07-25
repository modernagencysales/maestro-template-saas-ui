import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
import { reconcileWorkflowCompletion } from "./lifecycleReconciliation";
import { runBoundedWorkflowRetentionSweep } from "./_kit/lifecycleSweep";

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
    return yield* runWorkflowLifecycleControl(args.workflowRunId, () =>
      controls.cancel(principal, args),
    );
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
      return yield* runWorkflowLifecycleControl(args.workflowRunId, () =>
        controls.restart(principal, args),
      );
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
      return yield* reconcileWorkflowCompletion(reader, writer, args).pipe(
        Effect.mapError(
          (error) =>
            new ValidationFailed({
              field: "onComplete",
              message: error.message,
            }),
        ),
      );
    }),
);

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
