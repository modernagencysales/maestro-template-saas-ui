import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import { NotFound, ValidationFailed } from "../errors";
import { WorkflowPrincipal } from "./_kit/principal";
import { WorkflowReference, WorkflowStepName } from "./_kit/workflowReferences";

export const SubworkflowRunLinkProjection = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  parentWorkflowId: Schema.NonEmptyString,
  parentWorkflowVersion: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
  ),
  generation: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  childWorkflow: WorkflowReference,
  childWorkflowVersion: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
  ),
  stepName: WorkflowStepName,
  principal: WorkflowPrincipal,
  cancellation: Schema.Literal("cascade"),
  cleanup: Schema.Literal("cascade-async"),
});

export const ReserveSubworkflowRunLinkArgs = Schema.Struct({
  projection: SubworkflowRunLinkProjection,
  occurredAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});

export const ReserveSubworkflowRunLinkResult = Schema.Struct({
  linkId: Id("workflowRunLinks"),
});

export const SubworkflowRunLinkOutcome = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal("succeeded"),
    resultJson: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("failed"),
    error: Schema.NonEmptyString,
  }),
  Schema.Struct({ kind: Schema.Literal("canceled") }),
);

export const ReconcileSubworkflowRunLinkArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  linkId: Id("workflowRunLinks"),
  outcome: SubworkflowRunLinkOutcome,
  occurredAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});

export const ReconcileSubworkflowRunLinkResult = Schema.Struct({
  status: Schema.Literal("succeeded", "failed", "canceled"),
});

const errors = Schema.Union(NotFound, ValidationFailed);

const reserve = FunctionSpec.internalMutation({
  name: "reserve",
  args: () => ReserveSubworkflowRunLinkArgs,
  returns: () => ReserveSubworkflowRunLinkResult,
  error: () => errors,
});

const reconcile = FunctionSpec.internalMutation({
  name: "reconcile",
  args: () => ReconcileSubworkflowRunLinkArgs,
  returns: () => ReconcileSubworkflowRunLinkResult,
  error: () => errors,
});

export default GroupSpec.make().addFunction(reserve).addFunction(reconcile);
