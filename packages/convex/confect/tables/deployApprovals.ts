import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    environment: Schema.Literal("staging", "production"),
    targetId: Schema.String,
    commitSha: Schema.String,
    issuerId: Schema.String,
    approvalHash: Schema.String,
    signature: Schema.String,
    expiresAt: Schema.Number,
  }),
).index("by_scope", ["environment", "targetId", "commitSha"]);
