import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    slug: Schema.String,
    title: Schema.String,
    latestVersionId: Schema.String,
    sourceKind: Schema.Literals(["markdown", "link", "note", "document"]),
    sourceIds: Schema.Array(Schema.String),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_slug", ["workspaceId", "slug"]);
