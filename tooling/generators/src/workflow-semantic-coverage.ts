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
    "WF-NODE-FUNCTION-KIND": generated(
      "workflowNode action/query/mutation constructors",
      "exact generated registry kind dispatch",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-BATCH-MAX-ITEMS": generated(
      "WorkflowBoundedSubworkflowBatchNodeV2.maxItems",
      "pre-dispatch selected-item ceiling",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-BATCH-SIZE": generated(
      "WorkflowBoundedSubworkflowBatchNodeV2.batchSize",
      "deterministic contiguous partition",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-BATCH-FAN-OUT": generated(
      "WorkflowBoundedSubworkflowBatchNodeV2.fanOut",
      "bounded Workpool child waves",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-NODE-RETRY": generated(
      "WorkflowActionNodeV2.retry with WorkflowEffectContract",
      "exact guarded runAction retry options",
    ),
    "WF-FAILURE-COMPENSATION-STEPS": generated(
      "WorkflowFailurePolicy.steps",
      "completed-node filtering and reverse-order execution",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-FAILURE-COMPENSATION-NODE": generated(
      "WorkflowCompensationStep.forNodeId",
      "completed-node filtering before compensation dispatch",
      "packages/convex/test/workflow-conformance.test.ts",
    ),
    "WF-NODE-TRANSACTION": guardedDefault(
      "workflowNode query/mutation constructors",
      "independent by default; guarded inline options",
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
    "WF-TRANSACTION-KIND": guardedDefault(
      "WorkflowIndependentTransaction | WorkflowInlineTransaction",
      "independent or guarded inline compiler branch",
    ),
    "WF-TRANSACTION-LIMITS": guardedDefault(
      "inlineTransactionPreset | reviewedInlineTransaction",
      "validated step transactionLimits",
    ),
    "WF-TRANSACTION-BYTES-READ": guardedDefault(
      "InlineTransactionLimits.bytesRead",
      "transactionLimits.bytesRead",
    ),
    "WF-TRANSACTION-BYTES-WRITTEN": guardedDefault(
      "InlineTransactionLimits.bytesWritten",
      "transactionLimits.bytesWritten",
    ),
    "WF-TRANSACTION-DATABASE-QUERIES": guardedDefault(
      "InlineTransactionLimits.databaseQueries",
      "transactionLimits.databaseQueries",
    ),
    "WF-TRANSACTION-DOCUMENTS-READ": guardedDefault(
      "InlineTransactionLimits.documentsRead",
      "transactionLimits.documentsRead",
    ),
    "WF-TRANSACTION-DOCUMENTS-WRITTEN": guardedDefault(
      "InlineTransactionLimits.documentsWritten",
      "transactionLimits.documentsWritten",
    ),
    "WF-TRANSACTION-FUNCTIONS-SCHEDULED": guardedDefault(
      "InlineTransactionLimits.functionsScheduled",
      "transactionLimits.functionsScheduled",
    ),
    "WF-TRANSACTION-SCHEDULED-FUNCTION-ARGS-BYTES": guardedDefault(
      "InlineTransactionLimits.scheduledFunctionArgsBytes",
      "transactionLimits.scheduledFunctionArgsBytes",
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
    "WF-STEP-ACTION": generated(
      "workflowNode.action with WorkflowEffectContract",
      "guarded runAction with stable name and exact retry",
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
