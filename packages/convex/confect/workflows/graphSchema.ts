import * as S from "effect/Schema";
import { defineWorkflowSchemaFields } from "@maestro-template/template-core/workflow-semantics";

import { WorkflowEdge } from "./graphEdgeSchema";
import { WorkflowJoin } from "./graphJoinSchema";
import { WorkflowNode } from "./graphNodeSchema";

export { WorkflowCondition, WorkflowEdge } from "./graphEdgeSchema";
export { WorkflowJoin } from "./graphJoinSchema";
export {
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowRetryConfig,
} from "./graphNodeSchema";

export const DurableWorkflowGraphSchemaFields = defineWorkflowSchemaFields(
  "graph",
  {
    id: S.String,
    version: S.Number,
    startNodeId: S.String,
    nodes: S.Array(WorkflowNode).pipe(S.minItems(1)),
    edges: S.Array(WorkflowEdge),
    joins: S.Array(WorkflowJoin),
  },
);

export const DurableWorkflowGraph = S.Struct(DurableWorkflowGraphSchemaFields);

export type DurableWorkflowGraph = S.Schema.Type<typeof DurableWorkflowGraph>;
