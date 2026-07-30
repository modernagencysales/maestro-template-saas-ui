import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    environment: Schema.Literal("staging", "production"),
    targetId: Schema.String,
    commitSha: Schema.String,
    action: Schema.Literal("preflight", "convex", "cloudflare"),
    approvalHash: Schema.optional(Schema.String),
    verdictHash: Schema.optional(Schema.String),
    authorityOrigin: Schema.optional(Schema.String),
    consumptionId: Schema.String,
    consumedAt: Schema.Number,
  }),
)
  .index("by_scope_action", ["environment", "targetId", "commitSha", "action"])
  .index("by_scope_action_approval", [
    "environment",
    "targetId",
    "commitSha",
    "action",
    "approvalHash",
  ]);
