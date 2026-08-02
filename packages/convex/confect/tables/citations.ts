import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    citationId: Schema.String,
    claimId: Schema.String,
    sourceId: Schema.String,
    sourceKind: Schema.Literals(["markdown", "link", "note", "document"]),
    sourceTitle: Schema.String,
    quotedText: Schema.String,
    startOffset: Schema.Number,
    endOffset: Schema.Number,
    createdAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_claim", ["claimId"])
  .index("by_source", ["sourceId"]);
