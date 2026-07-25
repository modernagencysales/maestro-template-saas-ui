import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { NotFound, ValidationFailed } from "../errors";
import { ProductWorkflowEventId } from "./_kit/events";
import { WorkflowPrincipal } from "./_kit/principal";
import {
  WorkflowCapabilityReference,
  WorkflowEventReference,
} from "./_kit/workflowReferences";

export const AllocateWorkflowEventInstanceArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  workflowRunId: Schema.NonEmptyString,
  componentWorkflowId: Schema.NonEmptyString,
  generation: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  eventDefinition: WorkflowEventReference,
  eventInstanceKey: Schema.NonEmptyString,
  componentEventId: Schema.NonEmptyString,
  principal: WorkflowPrincipal,
  creatorCapability: WorkflowCapabilityReference,
  occurredAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});

export const OwnedWorkflowEventResult = Schema.Struct({
  eventId: ProductWorkflowEventId,
  componentEventId: Schema.NonEmptyString,
  workspaceId: Schema.NonEmptyString,
  workflowRunId: Schema.NonEmptyString,
  generation: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  eventDefinition: WorkflowEventReference,
  eventInstanceKey: Schema.NonEmptyString,
  principal: WorkflowPrincipal,
  creatorCapability: WorkflowCapabilityReference,
});

export const ReconcileWorkflowEventInstanceArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  eventId: ProductWorkflowEventId,
  outcome: Schema.Literal("canceled", "cleanup"),
  occurredAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});

export const ReconcileWorkflowEventInstanceResult = Schema.Struct({
  status: Schema.Literal("allocated", "invalidated", "canceled"),
  cleanup: Schema.Literal("active", "residual-inaccessible"),
});

const errors = Schema.Union(NotFound, ValidationFailed);

const allocate = FunctionSpec.internalMutation({
  name: "allocate",
  args: () => AllocateWorkflowEventInstanceArgs,
  returns: () => OwnedWorkflowEventResult,
  error: () => errors,
});

const reconcile = FunctionSpec.internalMutation({
  name: "reconcile",
  args: () => ReconcileWorkflowEventInstanceArgs,
  returns: () => ReconcileWorkflowEventInstanceResult,
  error: () => errors,
});

export default GroupSpec.make().addFunction(allocate).addFunction(reconcile);
