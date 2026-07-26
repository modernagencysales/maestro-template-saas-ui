import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import {
  WorkflowComponentCleanupState,
  WorkflowComponentResidualState,
  WorkflowGenerationQuiescence,
  WorkflowLifecycleExecution,
  WorkflowOnCompleteContext,
  WorkflowProductCleanupState,
  WorkflowRetentionTime,
} from "../workflows/_kit/lifecycleState";
import { DurableWorkflowPrincipal } from "../workflows/_kit/principal";
import { WorkflowPolicySnapshot } from "../workflows/_kit/policySnapshot";
import { WorkflowAdmissionLane } from "../workflows/_kit/workflowAdmission";

export const WorkflowRunStatus = Schema.Literal(
  "queued",
  "running",
  "completed",
  "failed",
  "canceled",
  "timedOut",
);

export type WorkflowRunStatus = Schema.Schema.Type<typeof WorkflowRunStatus>;

export const WorkflowRunRow = Schema.Struct({
  workspaceId: Schema.String,
  workflowId: Schema.String,
  workflowVersion: Schema.Number,
  graphJson: Schema.String,
  status: WorkflowRunStatus,
  admissionLane: Schema.optional(WorkflowAdmissionLane),
  idempotencyKey: Schema.String,
  startedByUserId: Schema.String,
  startedAt: Schema.Number,
  completedAt: Schema.NullOr(Schema.Number),
  failedAt: Schema.NullOr(Schema.Number),
  trustReceiptId: Schema.NullOr(Schema.String),
  componentWorkflowId: Schema.optional(Schema.String),
  workflowKind: Schema.optional(Schema.String),
  sourceRunKind: Schema.optional(Schema.String),
  sourceRunId: Schema.optional(Schema.String),
  timeoutMs: Schema.optional(Schema.Number),
  deadlineAt: Schema.optional(Schema.Number),
  timedOutAt: Schema.optional(Schema.NullOr(Schema.Number)),
  timeoutErrorCode: Schema.optional(Schema.NullOr(Schema.String)),
  timeoutSummary: Schema.optional(Schema.NullOr(Schema.String)),
  lifecycleExecution: Schema.optional(
    Schema.NullOr(WorkflowLifecycleExecution),
  ),
  lifecycleGeneration: Schema.optional(
    Schema.NullOr(
      Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    ),
  ),
  lifecycleGenerationAnchor: Schema.optional(Schema.NullOr(Schema.String)),
  lifecycleRestartAnchor: Schema.optional(Schema.NullOr(Schema.String)),
  priorGenerationQuiescence: Schema.optional(
    Schema.NullOr(WorkflowGenerationQuiescence),
  ),
  cleanupState: Schema.optional(Schema.NullOr(WorkflowProductCleanupState)),
  componentCleanupState: Schema.optional(
    Schema.NullOr(WorkflowComponentCleanupState),
  ),
  componentResidualState: Schema.optional(
    Schema.NullOr(WorkflowComponentResidualState),
  ),
  parentRetentionUntil: Schema.optional(WorkflowRetentionTime),
  childRetentionUntil: Schema.optional(WorkflowRetentionTime),
  evidenceRetentionUntil: Schema.optional(WorkflowRetentionTime),
  onCompleteContext: Schema.optional(Schema.NullOr(WorkflowOnCompleteContext)),
  principalSnapshot: Schema.optional(Schema.NullOr(DurableWorkflowPrincipal)),
  policySnapshot: Schema.optional(Schema.NullOr(WorkflowPolicySnapshot)),
});

export default Table.make(() => WorkflowRunRow)
  .index("by_workspace_status", ["workspaceId", "status"])
  .index("by_workspace_admission_status", [
    "workspaceId",
    "admissionLane",
    "status",
  ])
  .index("by_workflow_version", ["workflowId", "workflowVersion"])
  .index("by_idempotency_key", ["workspaceId", "idempotencyKey"])
  .index("by_component_workflow", ["componentWorkflowId"])
  .index("by_workspace_component_workflow", [
    "workspaceId",
    "componentWorkflowId",
  ]);
