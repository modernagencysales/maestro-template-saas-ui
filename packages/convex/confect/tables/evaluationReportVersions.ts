import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    reportId: Schema.String,
    version: Schema.Number,
    reportJson: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_report", ["reportId"])
  .index("by_report_version", ["reportId", "version"]);
