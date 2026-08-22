import * as S from "effect/Schema";
import { defineWorkflowSchemaFields } from "@maestro-template/template-core/workflow-semantics";

import { WorkflowEdge } from "./graphEdgeSchema";
import { WorkflowJoin } from "./graphJoinSchema";
import { WorkflowNode, WorkflowNodeV2 } from "./graphNodeSchema";
import { WorkflowPolicyPosture } from "./_kit/policySnapshot";

export { WorkflowCondition, WorkflowEdge } from "./graphEdgeSchema";
export { WorkflowJoin } from "./graphJoinSchema";
export {
  WorkflowNode,
  WorkflowNodeV2,
  WorkflowNodeKind,
  WorkflowRetryConfig,
  WorkflowRetryConfigV2,
  WorkflowSchedule,
  WorkflowPayloadPolicy,
  WorkflowTransactionLimits,
} from "./graphNodeSchema";
export { WorkflowFailurePolicy } from "./_kit/failurePolicy";
export type {
  WorkflowFailureRoute,
  WorkflowSettledFailure,
} from "./_kit/failurePolicy";

export const DurableWorkflowGraphSchemaFields = defineWorkflowSchemaFields(
  "graph",
  {
    id: S.String,
    version: S.Number,
    startNodeId: S.String,
    nodes: S.Array(WorkflowNode).pipe(S.check(S.isMinLength(1))),
    edges: S.Array(WorkflowEdge),
    joins: S.Array(WorkflowJoin),
  },
);

export const DurableWorkflowGraph = S.Struct(DurableWorkflowGraphSchemaFields);

export type DurableWorkflowGraph = S.Schema.Type<typeof DurableWorkflowGraph>;

export const WorkflowKickoffProfile = S.Struct({
  name: S.NonEmptyString,
  mode: S.Literals(["eager-first-poll", "queued"]),
  default: S.Boolean,
});

export const WorkflowUnstableArgsPosture = S.Union([
  S.Struct({ enabled: S.Literal(false) }),
  S.Struct({ enabled: S.Literal(true), adrRef: S.NonEmptyString }),
]);

export const DurableWorkflowGraphV2 = S.Struct({
  schemaVersion: S.Literal(2),
  id: S.NonEmptyString,
  version: S.Number.pipe(
    S.check(S.isFinite()),
    S.check(S.isInt()),
    S.check(S.isGreaterThan(0)),
  ),
  startNodeId: S.NonEmptyString,
  argsSchemaName: S.NonEmptyString,
  returnSchemaName: S.NonEmptyString,
  principalSchemaName: S.NonEmptyString,
  policyPosture: WorkflowPolicyPosture,
  kickoffProfiles: S.Array(WorkflowKickoffProfile),
  unstableArgs: WorkflowUnstableArgsPosture,
  nodes: S.Array(WorkflowNodeV2).pipe(S.check(S.isMinLength(1))),
  edges: S.Array(WorkflowEdge),
  joins: S.Array(WorkflowJoin),
});

export type DurableWorkflowGraphV2 = S.Schema.Type<
  typeof DurableWorkflowGraphV2
>;

export const decodeDurableWorkflowGraphV2 = S.decodeUnknownExit(
  DurableWorkflowGraphV2,
  { errors: "all", onExcessProperty: "error" },
);
