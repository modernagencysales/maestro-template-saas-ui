import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    runId: Schema.String,
    transformId: Schema.String,
    status: Schema.Literals(["queued", "running", "completed", "failed"]),
    inputHash: Schema.String,
    outputHash: Schema.String,
    sourceIds: Schema.Array(Schema.String),
    citationIds: Schema.Array(Schema.String),
    policySnapshotId: Schema.String,
    modelReceiptId: Schema.String,
    idempotencyKey: Schema.String,
    createdAt: Schema.Number,
    completedAt: Schema.optional(Schema.Number),
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_transform", ["workspaceId", "transformId"])
  .index("by_status", ["workspaceId", "status"]);
