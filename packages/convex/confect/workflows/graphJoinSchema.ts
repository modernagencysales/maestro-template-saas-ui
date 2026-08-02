import * as S from "effect/Schema";
import { defineWorkflowSchemaFields } from "@maestro-template/template-core/workflow-semantics";

export const WorkflowJoinSchemaFields = defineWorkflowSchemaFields("join", {
  nodeId: S.String,
  strategy: S.Literals(["all-successful", "any-successful"]),
  sourceNodeIds: S.Array(S.String),
});

export const WorkflowJoin = S.Struct(WorkflowJoinSchemaFields);

export type WorkflowJoin = S.Schema.Type<typeof WorkflowJoin>;
