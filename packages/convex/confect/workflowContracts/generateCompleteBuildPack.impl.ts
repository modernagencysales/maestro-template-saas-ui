import {
  getMaestroWorkflowStatus as getStatus,
  sendMaestroWorkflowEvent as sendEvent,
  type MaestroWorkflowComponent as WorkflowComponent,
  type MaestroWorkflowId as WorkflowId,
} from "../workflows/_kit/defineMaestroWorkflow";
import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  componentsGeneric,
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, MutationCtx, QueryCtx } from "../_generated/services";
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
  projectWorkflowStatus,
  type WorkflowStatusRunProjection,
} from "../workflows/_kit/status";
import { generateCompleteBuildPackGraph } from "../workflows/generateCompleteBuildPack.graph";
import generateCompleteBuildPack from "./generateCompleteBuildPack.spec";

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const workflowComponent = componentsGeneric()
  .workflow as unknown as WorkflowComponent;

type WorkflowRunFunctionArgs = {
  readonly args: {
    readonly workspaceId: string;
    readonly idempotencyKey: string;
  };
  readonly startAsync?: boolean;
};

const generateCompleteBuildPackRunRef = makeFunctionReference<
  "mutation",
  WorkflowRunFunctionArgs,
  WorkflowId
>(
  "workflowRunners/generateCompleteBuildPack:run",
) as unknown as FunctionReference<
  "mutation",
  "internal",
  WorkflowRunFunctionArgs,
  WorkflowId
>;

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

const findWorkflowRun = (workspaceId: string, componentWorkflowId: string) =>
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
      return yield* Effect.fail(
        new NotFound({
          resource: "workflowRuns",
          id: componentWorkflowId,
        }),
      );
    }

    return run;
  });

const startImpl = FunctionImpl.make(
  databaseSchema,
  generateCompleteBuildPack,
  "start",
  ({ workspaceId, idempotencyKey }) =>
    Effect.gen(function* () {
      const access = yield* withConfectClock(
        requireWorkspaceAccess(workspaceId, "editor"),
      );
      const startedAt = yield* withConfectClock(Clock.currentTimeMillis);
      const componentWorkflowId = yield* startWorkflowAndRecordOwnership({
        workflowRef: generateCompleteBuildPackRunRef,
        workflowArgs: { workspaceId, idempotencyKey },
        workspaceId,
        workflowId: generateCompleteBuildPackGraph.id,
        workflowVersion: generateCompleteBuildPackGraph.version,
        graphJson: JSON.stringify(generateCompleteBuildPackGraph),
        idempotencyKey,
        startedByUserId: access.userId,
        startedAt: startedAt,
        workflowKind: "workflow.generateCompleteBuildPack",
        kickoffProfile: "eager-first-poll",
      }).pipe(Effect.mapError(toWorkflowValidationFailed));

      return {
        status: "queued" as const,
        workflow: "generateCompleteBuildPack" as const,
        componentWorkflowId,
      };
    }).pipe(Effect.mapError(toWorkflowError)),
);

const statusImpl = FunctionImpl.make(
  databaseSchema,
  generateCompleteBuildPack,
  "status",
  ({ workspaceId, componentWorkflowId }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);
      const ctx = yield* QueryCtx;
      const rawStatus = yield* Effect.promise(() =>
        getStatus(ctx, workflowComponent, componentWorkflowId as WorkflowId),
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
      } satisfies WorkflowStatusRunProjection;

      return projectWorkflowStatus(rawStatus, runProjection);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const approveImpl = FunctionImpl.make(
  databaseSchema,
  generateCompleteBuildPack,
  "approve",
  ({ workspaceId, componentWorkflowId, nodeId }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "editor"));
      yield* findWorkflowRun(workspaceId, componentWorkflowId);
      const ctx = yield* MutationCtx;
      const eventId = yield* Effect.promise(() =>
        sendEvent(ctx, workflowComponent, {
          workflowId: componentWorkflowId as WorkflowId,
          name: generateCompleteBuildPackGraph.id + "." + nodeId + ".approved",
          value: null,
        }),
      ).pipe(Effect.mapError(toWorkflowValidationFailed));

      return { eventId };
    }).pipe(Effect.mapError(toWorkflowError)),
);

export default GroupImpl.make(databaseSchema, generateCompleteBuildPack).pipe(
  Layer.provide(startImpl),
  Layer.provide(statusImpl),
  Layer.provide(approveImpl),
  GroupImpl.finalize,
);
