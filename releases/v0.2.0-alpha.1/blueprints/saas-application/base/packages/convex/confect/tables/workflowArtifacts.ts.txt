import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";
import {
  WorkflowArtifactKind,
  WorkflowArtifactSensitivity,
} from "../workflows/_kit/workflowArtifacts";

// Large workflow inputs and outputs referenced by ID.
export const WorkflowArtifactRow = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  workflowId: Schema.NonEmptyString,
  workflowVersion: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
  ),
  lifecycleGeneration: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
  ),
  referenceKey: Schema.NonEmptyString,
  kind: WorkflowArtifactKind,
  sensitivity: WorkflowArtifactSensitivity,
  contentJson: Schema.String,
  contentHash: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/)),
  measuredBytes: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
  ),
  referenceUntil: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  retentionUntil: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  createdAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  appendOnly: Schema.Literal(true),
});

export const decodeWorkflowArtifactRow =
  Schema.decodeUnknownEither(WorkflowArtifactRow);

export default Table.make(() => WorkflowArtifactRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_run_reference", ["workflowRunId", "referenceKey"])
  .index("by_run_hash", ["workflowRunId", "contentHash"])
  .index("by_workspace_retention", ["workspaceId", "retentionUntil"]);
