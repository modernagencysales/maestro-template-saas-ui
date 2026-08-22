import type { GenericId } from "convex/values";
import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { componentsGeneric } from "convex/server";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  MutationRunner,
  QueryRunner,
  QueryCtx,
} from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { startWorkflowAndRecordOwnership } from "../workflows/_kit/ownership";
import {
  getMaestroWorkflowStatus,
  type MaestroWorkflowComponent,
  type MaestroWorkflowId,
} from "../workflows/_kit/defineMaestroWorkflow";
import { workflowPublicationRegistry } from "../workflows/_generated/workflowRegistry";
import {
  projectWorkflowStatus,
  type WorkflowStatusRunProjection,
} from "../workflows/_kit/status";
import { publicationFixtureGraph } from "../workflows/publicationFixture/v1.graph";
import { validateWorkflowEventDelivery } from "../workflows/_kit/events";
import { publicationFixtureApprovalDecisionEvent } from "../workflows/publicationFixture/v1.registry";
import { publicationFixtureV1Release } from "../workflows/publicationFixture/v1.release";
import publicationFixture from "./publicationFixture.spec";

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const workflowComponent = componentsGeneric()
  .workflow as unknown as MaestroWorkflowComponent;

const errorMessage = (error: unknown): string | null => {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
};

const toWorkflowValidationFailed = (error: unknown): ValidationFailed =>
  new ValidationFailed({
    field: "workflow",
    message: errorMessage(error) ?? "Unable to start workflow.",
  });

type WorkflowError =
  | Unauthorized
  | MemberNotInWorkspace
  | WorkspaceNotFound
  | NotFound
  | ValidationFailed;

const toWorkflowError = (error: unknown): WorkflowError => {
  if (
    error instanceof Unauthorized ||
    error instanceof MemberNotInWorkspace ||
    error instanceof WorkspaceNotFound ||
    error instanceof NotFound ||
    error instanceof ValidationFailed
  ) {
    return error;
  }

  return toWorkflowValidationFailed(error);
};

const findWorkflowRun = (
  workspaceId: GenericId<"workspaces">,
  componentWorkflowId: string,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const run = yield* reader
      .table("workflowRuns")
      .index("by_workspace_component_workflow", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("componentWorkflowId", componentWorkflowId),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);

    if (!run) {
      return yield* new NotFound({
        resource: "workflowRuns",
        id: componentWorkflowId,
      });
    }

    return run;
  });

const startWithProfile = (
  kickoffProfile: "interactive" | "queued",
  {
    workspaceId,
    idempotencyKey,
  }: {
    readonly workspaceId: GenericId<"workspaces">;
    readonly idempotencyKey: string;
  },
) =>
  Effect.gen(function* () {
    const access = yield* withConfectClock(
      requireWorkspaceAccess(workspaceId, "editor"),
    );
    const startedAt = yield* withConfectClock(Clock.currentTimeMillis);
    const principal = {
      version: 1 as const,
      kind: "user" as const,
      workspaceId,
      actorId: access.userId,
      role: access.role,
      grants: ["workflow:start"],
      authEpoch: 1,
      kickoffAt: startedAt,
      provenance: access.reason,
    };
    const componentWorkflowId = yield* startWorkflowAndRecordOwnership({
      workflowRef: publicationFixtureV1Release.runner.ref,
      onCompleteRef: publicationFixtureV1Release.completion.ref,
      buildWorkflowArgs: (workflowRunId) => ({
        workspaceId,
        workflowRunId,
        idempotencyKey,
        principal,
      }),
      workspaceId,
      workflowId: publicationFixtureGraph.id,
      workflowVersion: publicationFixtureV1Release.version,
      graphJson: JSON.stringify(publicationFixtureGraph),
      idempotencyKey,
      startedByUserId: access.userId,
      startedAt: startedAt,
      workflowKind: "workflow.publicationFixture",
      kickoffProfile:
        kickoffProfile === "interactive" ? "eager-first-poll" : "queued",
      publication: {
        registry: workflowPublicationRegistry,
        graphHash: publicationFixtureV1Release.graphHash,
        runnerModule: publicationFixtureV1Release.runner.module,
        runnerFunctionReference:
          publicationFixtureV1Release.runner.functionReference,
        releaseChecksum: publicationFixtureV1Release.releaseChecksum,
      },
    }).pipe(Effect.mapError(toWorkflowValidationFailed));
    const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);

    return {
      status: "queued" as const,
      workflow: "publicationFixture" as const,
      workflowRunId: run._id,
      componentWorkflowId,
    };
  }).pipe(Effect.mapError(toWorkflowError));

const startInteractiveImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "startInteractive",
  (args) => startWithProfile("interactive", args),
);

const startQueuedImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "startQueued",
  (args) => startWithProfile("queued", args),
);

const statusImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "status",
  ({ workspaceId, componentWorkflowId }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);
      const ctx = yield* QueryCtx;
      const rawStatus = yield* Effect.promise(() =>
        getMaestroWorkflowStatus(
          ctx,
          workflowComponent,
          componentWorkflowId as MaestroWorkflowId,
        ),
      ).pipe(Effect.mapError(toWorkflowValidationFailed));
      const runProjection = {
        ...(run.status !== undefined ? { status: run.status } : {}),
        ...(run.deadlineAt !== undefined ? { deadlineAt: run.deadlineAt } : {}),
        ...(run.timedOutAt !== undefined ? { timedOutAt: run.timedOutAt } : {}),
        ...(run.timeoutErrorCode !== undefined
          ? { timeoutErrorCode: run.timeoutErrorCode }
          : {}),
        ...(run.timeoutSummary !== undefined
          ? { timeoutSummary: run.timeoutSummary }
          : {}),
        ...(run.lifecycleExecution !== undefined
          ? { lifecycleExecution: run.lifecycleExecution }
          : {}),
        ...(run.lifecycleGeneration !== undefined
          ? { lifecycleGeneration: run.lifecycleGeneration }
          : {}),
        ...(run.priorGenerationQuiescence !== undefined
          ? { priorGenerationQuiescence: run.priorGenerationQuiescence }
          : {}),
        ...(run.cleanupState !== undefined
          ? { cleanupState: run.cleanupState }
          : {}),
        ...(run.componentCleanupState !== undefined
          ? { componentCleanupState: run.componentCleanupState }
          : {}),
        ...(run.componentResidualState !== undefined
          ? { componentResidualState: run.componentResidualState }
          : {}),
      } satisfies WorkflowStatusRunProjection;

      return projectWorkflowStatus(rawStatus, runProjection);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const sendEventImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "sendEvent",
  ({ selector, delivery }) =>
    Effect.gen(function* () {
      const validated = validateWorkflowEventDelivery(
        publicationFixtureApprovalDecisionEvent,
        delivery,
      );
      const occurredAt = yield* withConfectClock(Clock.currentTimeMillis);
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.eventInstances.send, {
        selector:
          selector.kind === "id"
            ? selector
            : {
                kind: "definition" as const,
                componentWorkflowId: selector.componentWorkflowId,
                eventDefinition:
                  publicationFixtureApprovalDecisionEvent.reference,
                eventInstanceKey: selector.eventInstanceKey,
              },
        delivery: validated,
        occurredAt,
      });
    }).pipe(Effect.mapError(toWorkflowError)),
);

const cancelImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "cancel",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.lifecycle.cancel, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const restartImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "restart",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(
        refs.internal.workflows.lifecycle.restart,
        args,
      );
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "list",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(refs.internal.workflows.lifecycle.list, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listByNameImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "listByName",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(
        refs.internal.workflows.lifecycle.listByName,
        args,
      );
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listStepsImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "listSteps",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(refs.internal.workflows.lifecycle.listSteps, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const cleanupImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "cleanup",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(
        refs.internal.workflows.lifecycle.cleanup,
        args,
      );
    }).pipe(Effect.mapError(toWorkflowError)),
);

export default GroupImpl.make(databaseSchema, publicationFixture).pipe(
  Layer.provide(startInteractiveImpl),
  Layer.provide(startQueuedImpl),
  Layer.provide(statusImpl),
  Layer.provide(cancelImpl),
  Layer.provide(restartImpl),
  Layer.provide(listImpl),
  Layer.provide(listByNameImpl),
  Layer.provide(listStepsImpl),
  Layer.provide(cleanupImpl),
  Layer.provide(sendEventImpl),
  GroupImpl.finalize,
);
