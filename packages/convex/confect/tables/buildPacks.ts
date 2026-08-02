import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    packId: Schema.String,
    reportId: Schema.String,
    reportVersion: Schema.Number,
    status: Schema.Literals([
      "running",
      "failed-recoverable",
      "needs-support",
      "completed",
      "revoked",
    ]),
    canonicalPackJson: Schema.optional(Schema.String),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_pack", ["packId"])
  .index("by_report", ["reportId"]);
