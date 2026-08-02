import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    challengeId: Schema.String,
    reportId: Schema.String,
    emailHash: Schema.String,
    verificationTokenHash: Schema.String,
    status: Schema.Literal("pending", "consumed"),
    createdAt: Schema.Number,
    expiresAt: Schema.Number,
    consumedAt: Schema.optional(Schema.Number),
  }),
)
  .index("by_challenge", ["challengeId"])
  .index("by_token_hash", ["verificationTokenHash"])
  .index("by_report", ["reportId"]);
