import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workflowRunId: Schema.String,
    sourceIds: Schema.Array(Schema.String),
    sourceTitles: Schema.Array(Schema.String),
    evidenceHash: Schema.String,
    materiality: Schema.Literals(["required", "supporting", "excluded"]),
    snapshotJson: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_run", ["workflowRunId"])
  .index("by_hash", ["evidenceHash"]);
