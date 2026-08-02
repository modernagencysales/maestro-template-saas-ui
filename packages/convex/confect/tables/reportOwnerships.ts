import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    reportId: Schema.String,
    emailHash: Schema.String,
    ownerAccessTokenHash: Schema.String,
    claimedAt: Schema.Number,
  }),
)
  .index("by_report", ["reportId"])
  .index("by_owner_token", ["ownerAccessTokenHash"])
  .index("by_email_hash", ["emailHash"]);
