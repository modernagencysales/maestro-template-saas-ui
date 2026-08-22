import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
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
  generation: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  eventDefinition: WorkflowEventReference,
  eventInstanceKey: Schema.NonEmptyString,
  componentEventId: Schema.NonEmptyString,
  principal: WorkflowPrincipal,
  creatorCapability: WorkflowCapabilityReference,
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

export const OwnedWorkflowEventResult = Schema.Struct({
  eventId: ProductWorkflowEventId,
  componentEventId: Schema.NonEmptyString,
  workspaceId: Schema.NonEmptyString,
  workflowRunId: Schema.NonEmptyString,
  generation: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  eventDefinition: WorkflowEventReference,
  eventInstanceKey: Schema.NonEmptyString,
  principal: WorkflowPrincipal,
  creatorCapability: WorkflowCapabilityReference,
});

export const ReconcileWorkflowEventInstanceArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  eventId: ProductWorkflowEventId,
  outcome: Schema.Literals(["consumed", "canceled", "cleanup"]),
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

export const ReconcileWorkflowEventInstanceResult = Schema.Struct({
  status: Schema.Literals([
    "allocated",
    "sent",
    "consumed",
    "invalidated",
    "canceled",
  ]),
  cleanup: Schema.Literals(["active", "residual-inaccessible"]),
});

export const WorkflowEventInstanceSelector = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("id"),
    eventId: ProductWorkflowEventId,
  }),
  Schema.Struct({
    kind: Schema.Literal("definition"),
    componentWorkflowId: Schema.NonEmptyString,
    eventDefinition: WorkflowEventReference,
    eventInstanceKey: Schema.NonEmptyString,
  }),
]);

export const SendWorkflowEventInstanceArgs = Schema.Struct({
  selector: WorkflowEventInstanceSelector,
  delivery: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("value"), value: Schema.Unknown }),
    Schema.Struct({
      kind: Schema.Literal("error"),
      error: Schema.NonEmptyString,
    }),
  ]),
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

export const SendWorkflowEventInstanceResult = Schema.Struct({
  ...OwnedWorkflowEventResult.fields,
  status: Schema.Literal("sent"),
});

const errors = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
]);

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

const send = FunctionSpec.internalMutation({
  name: "send",
  args: () => SendWorkflowEventInstanceArgs,
  returns: () => SendWorkflowEventInstanceResult,
  error: () => errors,
});

export default GroupSpec.make()
  .addFunction(allocate)
  .addFunction(reconcile)
  .addFunction(send);
