import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    entityKey: Schema.String,
    status: Schema.Literals(["fresh", "review-due", "stale"]),
    reason: Schema.String,
    checkedAt: Schema.Number,
    nextReviewAt: Schema.optional(Schema.Number),
    mutableFreshness: Schema.Boolean,
  }),
)
  .index("by_entity", ["workspaceId", "entityKey"])
  .index("by_status", ["workspaceId", "status"]);
