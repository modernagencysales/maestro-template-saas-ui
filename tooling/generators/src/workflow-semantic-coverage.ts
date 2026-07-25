import { defineWorkflowSemanticCoverage } from "@maestro-template/template-core/workflow-semantics";

const graphFixture = "packages/convex/test/<name>.workflow.test.ts";
const runnerFixture = "tooling/generators/src/workflow-output-smoke.ts";

const generated = (
  constructor: string,
  compiler: string,
  fixture = graphFixture,
) => ({
  posture: "generated" as const,
  constructor,
  compiler,
  fixture,
});

const guardedDefault = (constructor: string, compiler: string) => ({
  posture: "guarded-default" as const,
  constructor,
  compiler,
  fixture: "tooling/generators/src/index.test.ts",
});

export const workflowGeneratorSemanticCoverage = defineWorkflowSemanticCoverage(
  {
    "WF-GRAPH-ID": generated("DurableWorkflowGraph.id", "workflow release id"),
    "WF-GRAPH-VERSION": generated(
      "DurableWorkflowGraph.version",
      "immutable graph version",
    ),
    "WF-GRAPH-START": generated(
      "DurableWorkflowGraph.startNodeId",
      "source node selection",
    ),
    "WF-GRAPH-NODES": generated(
      "DurableWorkflowGraph.nodes",
      "runDurableGraphWorkflow",
    ),
    "WF-GRAPH-EDGES": generated(
      "DurableWorkflowGraph.edges",
      "ready-node traversal",
    ),
    "WF-GRAPH-JOINS": generated("DurableWorkflowGraph.joins", "join readiness"),
    "WF-NODE-ID": generated("WorkflowNode.id", "journal step identity"),
    "WF-NODE-KIND": generated("WorkflowNodeKind", "node executor lookup"),
    "WF-NODE-LABEL": generated("WorkflowNode.label", "receipt projection"),
    "WF-NODE-RETRY": generated(
      "WorkflowActionNodeV2.retry with WorkflowEffectContract",
      "exact guarded runAction retry options",
    ),
    "WF-NODE-EVENT-DEFINITION": generated(
      "defineWorkflowEvent + defineWorkflowV2EventRegistry",
      "exact generated event registry entry",
      "tooling/generators/src/index.test.ts",
    ),
    "WF-NODE-EVENT-SCHEMA": generated(
      "WorkflowEventDefinition schema + validator",
      "shared generated await and delivery validator",
      "tooling/generators/src/index.test.ts",
    ),
    "WF-NODE-EVENT-INSTANCE": generated(
      "WorkflowEventNodeV2.eventInstanceKey + ProductWorkflowEventId",
      "persisted owned event allocation",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-RETRY-MAX-ATTEMPTS": generated(
      "WorkflowRetryConfigV2.maxAttempts",
      "validated runAction.retry.maxAttempts",
    ),
    "WF-RETRY-BACKOFF": guardedDefault(
      "WorkflowRetryConfig.backoffMs",
      "literal zero until Phase 1 compiler support",
    ),
    "WF-RETRY-INITIAL-BACKOFF": generated(
      "WorkflowRetryConfigV2.initialBackoffMs",
      "validated runAction.retry.initialBackoffMs",
    ),
    "WF-RETRY-BASE": generated(
      "WorkflowRetryConfigV2.base",
      "validated runAction.retry.base",
    ),
    "WF-EDGE-ID": generated("WorkflowEdge.id", "edge identity"),
    "WF-EDGE-SOURCE": generated(
      "WorkflowEdge.sourceNodeId",
      "ready-node traversal",
    ),
    "WF-EDGE-TARGET": generated(
      "WorkflowEdge.targetNodeId",
      "ready-node traversal",
    ),
    "WF-STEP-EVENT": generated(
      "runRegisteredWorkflowEvent",
      "ID-bound await and persisted consumed reconciliation",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-SEND-EVENT": generated(
      "generated workflowContracts.sendEvent selector",
      "authenticated translation to component-owned EventId",
      "tooling/generators/src/index.test.ts",
    ),
    "WF-CREATE-EVENT": guardedDefault(
      "generated internal event allocation refs",
      "internal persisted generation allocation only",
    ),
    "WF-DEFINE": generated(
      "defineMaestroWorkflow",
      "Confect-owned registered runner",
      runnerFixture,
    ),
  },
);
