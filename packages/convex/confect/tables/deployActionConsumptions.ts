import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    environment: Schema.Literal("staging", "production"),
    targetId: Schema.String,
    commitSha: Schema.String,
    action: Schema.Literal("preflight", "convex", "cloudflare"),
    consumptionId: Schema.String,
    consumedAt: Schema.Number,
  }),
).index("by_scope_action", ["environment", "targetId", "commitSha", "action"]);
