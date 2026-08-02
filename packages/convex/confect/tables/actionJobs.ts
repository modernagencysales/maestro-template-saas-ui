import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    jobId: Schema.String,
    workflowRunId: Schema.String,
    capabilityId: Schema.String,
    targetKind: Schema.Literals(["email", "crm", "webhook", "notion", "api"]),
    targetRef: Schema.String,
    payloadHash: Schema.String,
    approvalPolicyId: Schema.optional(Schema.String),
    safeModeExemptionReason: Schema.optional(Schema.String),
    status: Schema.Literals([
      "queued",
      "waiting_for_approval",
      "published",
      "failed",
    ]),
    idempotencyKey: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workflow_run", ["workspaceId", "workflowRunId"])
  .index("by_status", ["workspaceId", "status"])
  .index("by_idempotency_key", ["workspaceId", "idempotencyKey"]);
