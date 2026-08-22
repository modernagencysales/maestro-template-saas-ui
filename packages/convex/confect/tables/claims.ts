import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    claimId: Schema.String,
    conceptIds: Schema.Array(Schema.String),
    body: Schema.String,
    status: Schema.Literals(["supported", "disputed", "unsupported-draft"]),
    citationIds: Schema.Array(Schema.String),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_status", ["workspaceId", "status"]);
