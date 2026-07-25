import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

import { WorkflowPrincipal } from "../workflows/_kit/principal";
import {
  WorkflowCapabilityReference,
  WorkflowEventReference,
} from "../workflows/_kit/workflowReferences";

export const WorkflowEventInstanceStatus = Schema.Literal(
  "allocated",
  "invalidated",
  "canceled",
);

export const WorkflowEventInstanceCleanup = Schema.Literal(
  "active",
  "residual-inaccessible",
);

export const WorkflowEventInstanceRow = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  workflowRunId: Schema.NonEmptyString,
  componentWorkflowId: Schema.NonEmptyString,
  generation: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  eventDefinition: WorkflowEventReference,
  eventInstanceKey: Schema.NonEmptyString,
  eventId: Schema.NonEmptyString,
  componentEventId: Schema.NonEmptyString,
  principal: WorkflowPrincipal,
  creatorCapability: WorkflowCapabilityReference,
  status: WorkflowEventInstanceStatus,
  cleanup: WorkflowEventInstanceCleanup,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

export default Table.make(() => WorkflowEventInstanceRow)
  .index("by_exact_ownership", [
    "workspaceId",
    "workflowRunId",
    "generation",
    "eventDefinition",
    "eventInstanceKey",
  ])
  .index("by_logical_instance", [
    "workspaceId",
    "workflowRunId",
    "eventDefinition",
    "eventInstanceKey",
  ])
  .index("by_component_generation", ["componentWorkflowId", "generation"])
  .index("by_product_event", ["eventId"])
  .index("by_component_event", ["componentEventId"]);
