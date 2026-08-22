import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";

import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { NotFound, ValidationFailed } from "../errors";
import {
  createWorkflowLifecycleControls,
  WorkflowLifecycleControlError,
  type WorkflowLifecycleControlPorts,
  type WorkflowLifecyclePrincipal,
} from "./_kit/lifecycle";
import {
  appendWorkflowLifecycleAudit,
  listOwnedWorkflowRuns,
  listOwnedWorkflowSteps,
  loadOwnedWorkflowRun,
  persistWorkflowLifecycleState,
} from "./lifecyclePersistence";
import { workflowLifecycleComponentAdapter } from "./lifecycleComponent";
import {
  inspectWorkflowExposedWork,
  inspectWorkflowRestart,
  inspectWorkflowRetention,
} from "./lifecycleInspection";

type Reader = Context.Service.Shape<typeof DatabaseReader>;
type Writer = Context.Service.Shape<typeof DatabaseWriter>;
type Mutation = Context.Service.Shape<typeof MutationCtx>;

export const authorizeWorkflowLifecycle = (workspaceId: string) =>
  withConfectClock(
    requireWorkspaceAccess(workspaceId as GenericId<"workspaces">, "editor"),
  ).pipe(
    Effect.map((access): WorkflowLifecyclePrincipal => ({
      workspaceId,
      actorId: String(access.userId),
      authority: "operator",
    })),
  );

export const makeWorkflowLifecycleQueryControls = (
  reader: Reader,
  principal: WorkflowLifecyclePrincipal,
) => createWorkflowLifecycleControls(readPorts(reader, principal));

export const makeWorkflowLifecycleMutationControls = (
  reader: Reader,
  writer: Writer,
  mutation: Mutation,
  principal: WorkflowLifecyclePrincipal,
) => {
  const component = workflowLifecycleComponentAdapter(mutation);
  return createWorkflowLifecycleControls({
    ...readPorts(reader, principal),
    saveLifecycleState: (workflowRunId, state) =>
      Effect.runPromise(
        persistWorkflowLifecycleState(writer, workflowRunId, state),
      ),
    appendAudit: (event) =>
      Effect.runPromise(appendWorkflowLifecycleAudit(writer, reader, event)),
    component,
  });
};

export const runWorkflowLifecycleControl = <Result>(
  workflowRunId: string,
  run: () => Promise<Result>,
) =>
  Effect.tryPromise({
    try: run,
    catch: (error) => mapLifecycleError(workflowRunId, error),
  });

const readPorts = (
  reader: Reader,
  principal: WorkflowLifecyclePrincipal,
): WorkflowLifecycleControlPorts => ({
  authorize: async (candidate) =>
    candidate.workspaceId === principal.workspaceId &&
    candidate.actorId === principal.actorId &&
    candidate.authority === principal.authority,
  loadOwnedRun: (workspaceId, workflowRunId) =>
    Effect.runPromise(loadOwnedWorkflowRun(reader, workspaceId, workflowRunId)),
  saveLifecycleState: unavailableOperation,
  appendAudit: unavailableOperation,
  listOwnedRuns: (workspaceId, pagination) =>
    Effect.runPromise(listOwnedWorkflowRuns(reader, workspaceId, pagination)),
  listOwnedRunsByName: (workspaceId, workflowName, pagination) =>
    Effect.runPromise(
      listOwnedWorkflowRuns(reader, workspaceId, pagination, workflowName),
    ),
  listOwnedSteps: (_workspaceId, workflowRunId, _generation, pagination) =>
    Effect.runPromise(
      listOwnedWorkflowSteps(reader, workflowRunId, pagination),
    ),
  inspectRestart: (input) =>
    Effect.runPromise(inspectWorkflowRestart(reader, input)),
  inspectQuiescence: (input) =>
    Effect.runPromise(inspectWorkflowExposedWork(reader, input)),
  inspectRetention: (input) =>
    Effect.runPromise(inspectWorkflowRetention(reader, input)),
  component: {
    status: unavailableOperation,
    cancel: unavailableOperation,
    restart: unavailableOperation,
    cleanup: unavailableOperation,
  },
});

const unavailableOperation = async (): Promise<never> => {
  throw new WorkflowLifecycleControlError({
    code: "COMPONENT_REJECTED",
    message: "Workflow lifecycle operation is unavailable.",
  });
};

const mapLifecycleError = (workflowRunId: string, error: unknown) =>
  error instanceof WorkflowLifecycleControlError && error.code === "UNAVAILABLE"
    ? new NotFound({ resource: "workflowRuns", id: workflowRunId })
    : new ValidationFailed({
        field: "lifecycle",
        message:
          error instanceof WorkflowLifecycleControlError
            ? error.message
            : "Workflow lifecycle operation is unavailable.",
      });

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;
