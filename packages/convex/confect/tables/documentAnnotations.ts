import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    annotationId: Schema.String,
    documentId: Schema.String,
    workspaceId: Schema.String,
    versionId: Schema.String,
    startOffset: Schema.Number,
    endOffset: Schema.Number,
    quotedText: Schema.String,
    authorType: Schema.Literals(["human", "agent"]),
    authorId: Schema.String,
    body: Schema.String,
    status: Schema.Literals(["open", "resolved"]),
    createdAt: Schema.Number,
  }),
)
  .index("by_document", ["documentId"])
  .index("by_document_status", ["documentId", "status"])
  .index("by_workspace", ["workspaceId"]);
