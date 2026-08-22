import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const WorkflowRunLinkRow = Schema.Struct({
  workspaceId: Schema.String,
  parentWorkflowId: Schema.String,
  childWorkflowId: Schema.NullOr(Schema.String),
  parentKind: Schema.String,
  childKind: Schema.String,
  relationKind: Schema.String,
  relationId: Schema.String,
  idempotencyKey: Schema.String,
  status: Schema.Literals([
    "starting",
    "running",
    "succeeded",
    "failed",
    "canceled",
  ]),
  childResultJson: Schema.NullOr(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

export default Table.make(() => WorkflowRunLinkRow)
  .index("by_workspace_and_parent", ["workspaceId", "parentWorkflowId"])
  .index("by_workspace_and_child", ["workspaceId", "childWorkflowId"])
  .index("by_workspace_and_idempotency", ["workspaceId", "idempotencyKey"]);
