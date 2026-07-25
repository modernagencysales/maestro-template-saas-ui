import * as S from "effect/Schema";
import { defineWorkflowSchemaFields } from "@maestro-template/template-core/workflow-semantics";

export const WorkflowNodeKind = S.Literal(
  "source",
  "capability",
  "agent",
  "delay",
  "approval",
  "output",
);

export type WorkflowNodeKind = S.Schema.Type<typeof WorkflowNodeKind>;

export const WorkflowRetrySchemaFields = defineWorkflowSchemaFields("retry", {
  maxAttempts: S.Number,
  backoffMs: S.Number,
});

export const WorkflowRetryConfig = S.Struct(WorkflowRetrySchemaFields);

export const WorkflowNodeSchemaFields = defineWorkflowSchemaFields("node", {
  id: S.String,
  kind: WorkflowNodeKind,
  label: S.String,
  capability: S.optional(S.String),
  agent: S.optional(S.String),
  delayMs: S.optional(S.Number),
  retry: WorkflowRetryConfig,
});

export const WorkflowNode = S.Struct(WorkflowNodeSchemaFields);

export type WorkflowNode = S.Schema.Type<typeof WorkflowNode>;
