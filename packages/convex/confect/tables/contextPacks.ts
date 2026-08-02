import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    contextPackId: Schema.String,
    title: Schema.String,
    sourceIds: Schema.Array(Schema.String),
    citationIds: Schema.Array(Schema.String),
    claimIds: Schema.Array(Schema.String),
    freshness: Schema.Literals(["fresh", "review-due", "stale"]),
    trustReceiptId: Schema.String,
    sourceBacked: Schema.Boolean,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_trust_receipt", ["trustReceiptId"]);
