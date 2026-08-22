import * as S from "effect/Schema";
import { defineWorkflowSchemaFields } from "@maestro-template/template-core/workflow-semantics";

export const WorkflowConditionSchemaFields = defineWorkflowSchemaFields(
  "condition",
  {
    expression: S.String,
  },
);

export const WorkflowCondition = S.Struct(WorkflowConditionSchemaFields);

export const WorkflowEdgeSchemaFields = defineWorkflowSchemaFields("edge", {
  id: S.String,
  sourceNodeId: S.String,
  targetNodeId: S.String,
  condition: S.optional(WorkflowCondition),
});

export const WorkflowEdge = S.Struct(WorkflowEdgeSchemaFields);

export type WorkflowEdge = S.Schema.Type<typeof WorkflowEdge>;
