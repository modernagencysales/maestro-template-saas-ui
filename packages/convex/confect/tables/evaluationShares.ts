import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    shareTokenHash: Schema.String,
    reportId: Schema.String,
    reportVersion: Schema.Number,
    status: Schema.Literals(["active", "revoked"]),
    publicSnapshotJson: Schema.String,
    createdAt: Schema.Number,
    revokedAt: Schema.optional(Schema.Number),
  }),
)
  .index("by_token_hash", ["shareTokenHash"])
  .index("by_report", ["reportId"]);
