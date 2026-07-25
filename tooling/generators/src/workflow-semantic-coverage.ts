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
    "WF-NODE-RETRY": guardedDefault(
      "WorkflowNode.retry",
      "maxAttempts=1/backoffMs=0 restriction",
    ),
    "WF-RETRY-ATTEMPTS": guardedDefault(
      "WorkflowRetryConfig.maxAttempts",
      "literal one until Phase 1 compiler support",
    ),
    "WF-RETRY-BACKOFF": guardedDefault(
      "WorkflowRetryConfig.backoffMs",
      "literal zero until Phase 1 compiler support",
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
    "WF-DEFINE": generated(
      "defineMaestroWorkflow",
      "Confect-owned registered runner",
      runnerFixture,
    ),
  },
);
