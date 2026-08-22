import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    reportId: Schema.String,
    sessionId: Schema.String,
    ownerUserId: Schema.optional(Schema.String),
    currentVersion: Schema.Number,
    verdict: Schema.String,
    overallScore: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_report", ["reportId"])
  .index("by_session", ["sessionId"])
  .index("by_owner", ["ownerUserId"]);
