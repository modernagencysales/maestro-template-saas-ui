import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    transformId: Schema.String,
    name: Schema.String,
    inputSchemaRef: Schema.String,
    outputSchemaRef: Schema.String,
    policyKind: Schema.Literals([
      "none",
      "approval-required",
      "review-required",
    ]),
    requiredEvidence: Schema.Array(Schema.String),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_transform", ["workspaceId", "transformId"]);
