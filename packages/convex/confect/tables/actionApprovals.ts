import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    approvalId: Schema.String,
    jobId: Schema.String,
    reviewerId: Schema.String,
    tokenHash: Schema.String,
    scope: Schema.Literals(["action:approve", "action:review"]),
    status: Schema.Literals(["pending", "approved", "rejected", "expired"]),
    expiresAt: Schema.Number,
    createdAt: Schema.Number,
    reviewedAt: Schema.optional(Schema.Number),
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_job", ["workspaceId", "jobId"])
  .index("by_reviewer", ["workspaceId", "reviewerId"])
  .index("by_token_hash", ["tokenHash"]);
