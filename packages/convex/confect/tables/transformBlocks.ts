import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    runId: Schema.String,
    blockId: Schema.String,
    transformId: Schema.String,
    kind: Schema.Literals([
      "input",
      "retrieval",
      "model-output",
      "postprocess",
      "external-write",
    ]),
    inputHash: Schema.String,
    outputHash: Schema.String,
    sourceIds: Schema.Array(Schema.String),
    citationIds: Schema.Array(Schema.String),
    policySnapshotId: Schema.String,
    modelReceiptId: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_run", ["runId"])
  .index("by_transform", ["workspaceId", "transformId"]);
