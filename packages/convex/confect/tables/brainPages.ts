import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Id("workspaces"),
    slug: Schema.String,
    title: Schema.String,
    markdown: Schema.String,
    editorSnapshotJson: Schema.optional(Schema.String),
    editorSnapshotVersion: Schema.optional(Schema.Number),
    sourceKind: Schema.Literals(["markdown", "link", "note"]),
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_slug", ["workspaceId", "slug"]);
