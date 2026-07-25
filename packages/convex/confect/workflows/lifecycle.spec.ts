import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";

const NonNegativeInteger = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
);

const Pagination = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  limit: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
    Schema.lessThanOrEqualTo(100),
  ),
});

const WorkflowLifecycleErrors = Schema.Union(
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
);

const ControlArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  reasonCode: Schema.Literal(
    "operator-request",
    "recovery",
    "policy-change",
    "retention-sweep",
  ),
  occurredAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});

export const WorkflowLifecycleRunProjection = Schema.Struct({
  workflowRunId: Schema.NonEmptyString,
  workflowName: Schema.NonEmptyString,
  workflowId: Schema.NonEmptyString,
  workflowVersion: NonNegativeInteger,
  status: Schema.NonEmptyString,
  generation: NonNegativeInteger,
  startedAt: Schema.Number,
  completedAt: Schema.NullOr(Schema.Number),
});

export const WorkflowLifecycleStepProjection = Schema.Struct({
  stepName: Schema.NonEmptyString,
  status: Schema.NonEmptyString,
  attempt: NonNegativeInteger,
  startedAt: Schema.NullOr(Schema.Number),
  finishedAt: Schema.NullOr(Schema.Number),
  errorCode: Schema.NullOr(Schema.String),
});

const RunPage = Schema.Struct({
  page: Schema.Array(WorkflowLifecycleRunProjection),
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
});

const StepPage = Schema.Struct({
  page: Schema.Array(WorkflowLifecycleStepProjection),
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
});

const cancel = FunctionSpec.internalMutation({
  name: "cancel",
  args: () => ControlArgs,
  returns: () =>
    Schema.Struct({
      status: Schema.Literal("canceled"),
      actionMayFinish: Schema.Literal(true),
    }),
  error: () => WorkflowLifecycleErrors,
});

const list = FunctionSpec.internalQuery({
  name: "list",
  args: () =>
    Schema.Struct({ workspaceId: Id("workspaces"), ...Pagination.fields }),
  returns: () => RunPage,
  error: () => WorkflowLifecycleErrors,
});

const listByName = FunctionSpec.internalQuery({
  name: "listByName",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      workflowName: Schema.NonEmptyString,
      ...Pagination.fields,
    }),
  returns: () => RunPage,
  error: () => WorkflowLifecycleErrors,
});

const listSteps = FunctionSpec.internalQuery({
  name: "listSteps",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      workflowRunId: Id("workflowRuns"),
      ...Pagination.fields,
    }),
  returns: () => StepPage,
  error: () => WorkflowLifecycleErrors,
});

const cleanup = FunctionSpec.internalMutation({
  name: "cleanup",
  args: () => ControlArgs,
  returns: () =>
    Schema.Struct({
      status: Schema.Literal("component-cleanup-requested"),
      fullDeletionProven: Schema.Literal(false),
    }),
  error: () => WorkflowLifecycleErrors,
});

const restart = FunctionSpec.internalMutation({
  name: "restart",
  args: () =>
    Schema.Struct({
      ...ControlArgs.fields,
      restartAnchor: Schema.NonEmptyString,
    }),
  returns: () =>
    Schema.Struct({
      generation: NonNegativeInteger,
      discardedSteps: Schema.Array(Schema.NonEmptyString),
    }),
  error: () => WorkflowLifecycleErrors,
});

export default GroupSpec.make()
  .addFunction(cancel)
  .addFunction(restart)
  .addFunction(list)
  .addFunction(listByName)
  .addFunction(listSteps)
  .addFunction(cleanup);
