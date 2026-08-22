import type { WorkflowSemanticRule } from "./schema";

export * from "./failure-policy";

export const WORKFLOW_SCHEMA_FIELDS = {
  graph: ["id", "version", "startNodeId", "nodes", "edges", "joins"],
  node: ["id", "kind", "label", "capability", "agent", "delayMs", "retry"],
  retry: ["maxAttempts", "backoffMs"],
  graphV2: [
    "schemaVersion",
    "id",
    "version",
    "startNodeId",
    "argsSchemaName",
    "returnSchemaName",
    "principalSchemaName",
    "policyPosture",
    "kickoffProfiles",
    "unstableArgs",
    "nodes",
    "edges",
    "joins",
  ],
  nodeV2: [
    "id",
    "label",
    "stepName",
    "payloadPolicy",
    "semanticRuleIds",
    "failurePolicy",
    "kind",
    "capability",
    "functionKind",
    "retry",
    "schedule",
    "transaction",
    "agent",
    "delayMs",
    "eventDefinition",
    "eventSchemaName",
    "eventInstanceKey",
    "workflow",
    "childVersion",
    "maxItems",
    "batchSize",
    "fanOut",
  ],
  retryV2: ["maxAttempts", "initialBackoffMs", "base"],
  failurePolicy: ["kind", "edgeId", "failure", "steps"],
  compensationStep: ["forNodeId", "capability", "stepName"],
  settledFailure: ["_tag", "code", "message"],
  schedule: ["kind", "delayMs", "timestamp"],
  payloadPolicy: ["maxInputBytes", "maxResultBytes", "resultMode"],
  transaction: ["kind", "limits"],
  transactionLimits: [
    "bytesRead",
    "bytesWritten",
    "databaseQueries",
    "documentsRead",
    "documentsWritten",
    "functionsScheduled",
    "scheduledFunctionArgsBytes",
  ],
  kickoffProfile: ["name", "mode", "default"],
  unstableArgs: ["enabled", "adrRef"],
  policyPosture: [
    "kind",
    "reason",
    "schemaName",
    "policyVersionId",
    "policyHash",
  ],
  edge: ["id", "sourceNodeId", "targetNodeId", "condition"],
  condition: ["expression"],
  join: ["nodeId", "strategy", "sourceNodeIds"],
} as const;

type WorkflowSchemaSection = keyof typeof WORKFLOW_SCHEMA_FIELDS;
type WorkflowSchemaFieldName<Section extends WorkflowSchemaSection> =
  (typeof WORKFLOW_SCHEMA_FIELDS)[Section][number];

export const defineWorkflowSchemaFields = <
  Section extends WorkflowSchemaSection,
  const Fields extends Record<WorkflowSchemaFieldName<Section>, unknown>,
>(
  section: Section,
  fields: Fields &
    Record<Exclude<keyof Fields, WorkflowSchemaFieldName<Section>>, never>,
): Fields => {
  const expected = WORKFLOW_SCHEMA_FIELDS[section] as readonly string[];
  const actual = Object.keys(fields);
  if (
    actual.length !== expected.length ||
    expected.some((field) => !Object.hasOwn(fields, field))
  ) {
    throw new Error(`Workflow ${section} schema fields differ from registry.`);
  }
  return fields;
};

const prefixWorkflowFields = <
  Prefix extends string,
  const Fields extends readonly string[],
>(
  prefix: Prefix,
  fields: Fields,
): readonly `${Prefix}${Fields[number]}`[] =>
  fields.map((field) => `${prefix}${field}` as `${Prefix}${Fields[number]}`);

const LEGACY_WORKFLOW_GRAPH_FIELDS = [
  ...WORKFLOW_SCHEMA_FIELDS.graph,
  ...prefixWorkflowFields("nodes[].", WORKFLOW_SCHEMA_FIELDS.node),
  ...prefixWorkflowFields("nodes[].retry.", WORKFLOW_SCHEMA_FIELDS.retry),
  ...prefixWorkflowFields("edges[].", WORKFLOW_SCHEMA_FIELDS.edge),
  ...prefixWorkflowFields(
    "edges[].condition.",
    WORKFLOW_SCHEMA_FIELDS.condition,
  ),
  ...prefixWorkflowFields("joins[].", WORKFLOW_SCHEMA_FIELDS.join),
] as const;

const WORKFLOW_GRAPH_V2_FIELDS = [
  ...WORKFLOW_SCHEMA_FIELDS.graphV2,
  ...prefixWorkflowFields("nodes[].", WORKFLOW_SCHEMA_FIELDS.nodeV2),
  ...prefixWorkflowFields("nodes[].retry.", WORKFLOW_SCHEMA_FIELDS.retryV2),
  ...prefixWorkflowFields(
    "nodes[].failurePolicy.",
    WORKFLOW_SCHEMA_FIELDS.failurePolicy,
  ),
  ...prefixWorkflowFields(
    "nodes[].failurePolicy.failure.",
    WORKFLOW_SCHEMA_FIELDS.settledFailure,
  ),
  ...prefixWorkflowFields(
    "nodes[].failurePolicy.steps[].",
    WORKFLOW_SCHEMA_FIELDS.compensationStep,
  ),
  ...prefixWorkflowFields("nodes[].schedule.", WORKFLOW_SCHEMA_FIELDS.schedule),
  ...prefixWorkflowFields(
    "nodes[].payloadPolicy.",
    WORKFLOW_SCHEMA_FIELDS.payloadPolicy,
  ),
  ...prefixWorkflowFields(
    "nodes[].transaction.",
    WORKFLOW_SCHEMA_FIELDS.transaction,
  ),
  ...prefixWorkflowFields(
    "nodes[].transaction.limits.",
    WORKFLOW_SCHEMA_FIELDS.transactionLimits,
  ),
  ...prefixWorkflowFields(
    "kickoffProfiles[].",
    WORKFLOW_SCHEMA_FIELDS.kickoffProfile,
  ),
  ...prefixWorkflowFields("unstableArgs.", WORKFLOW_SCHEMA_FIELDS.unstableArgs),
  ...prefixWorkflowFields(
    "policyPosture.",
    WORKFLOW_SCHEMA_FIELDS.policyPosture,
  ),
  ...prefixWorkflowFields("edges[].", WORKFLOW_SCHEMA_FIELDS.edge),
  ...prefixWorkflowFields(
    "edges[].condition.",
    WORKFLOW_SCHEMA_FIELDS.condition,
  ),
  ...prefixWorkflowFields("joins[].", WORKFLOW_SCHEMA_FIELDS.join),
] as const;

export const WORKFLOW_GRAPH_FIELDS: readonly string[] = [
  ...new Set([...LEGACY_WORKFLOW_GRAPH_FIELDS, ...WORKFLOW_GRAPH_V2_FIELDS]),
];

export const OFFICIAL_WORKFLOW_PRIMITIVES = [
  "defineWorkflow",
  "runQuery",
  "runMutation",
  "runAction",
  "runWorkflow",
  "sleep",
  "awaitEvent",
  "start.eagerFirstPoll",
  "start.queued",
  "status",
  "cancel",
  "restart",
  "cleanup",
  "list",
  "listByName",
  "listSteps",
  "sendEvent",
  "createEvent",
  "Date",
  "Math.random",
  "Intl",
  "crypto",
] as const;

const DOC = "docs/template/convex-workflow-compatibility.md";
const GRAPH_FIXTURE = "packages/convex/test/workflow-conformance.test.ts";
const GENERATOR_FIXTURE = "tooling/generators/src/index.test.ts";
const V2_GRAPH_FIXTURE = "packages/convex/test/workflow-graph-v2.test.ts";
const V2_BUILDER_FIXTURE = "packages/convex/test/workflow-builder.test.ts";
const FAILURE_POLICY_FIXTURE =
  "packages/template-core/src/workflow-semantics/failure-policy.test.ts";
const INLINE_TRANSACTION_BUILDER_FIXTURE =
  "packages/convex/test/workflow-builder.test.ts";
const WORKPOOL_SAFETY_FIXTURE =
  "tooling/convex-compat/src/candidate-install.test.ts";
const INLINE_TRANSACTION_GUARD =
  "independent remains default; inline is query/mutation capability only with small-atomic posture; named presets or reviewed explicit positive counters are mandatory; action, scheduled, and other node combinations are structurally rejected; canonical JSON/runtime parity is executable; support is pinned to Convex 1.42.1";

const supported = <const Id extends string>(
  id: Id,
  subject: string,
  typedConstructor: string,
  compilerMapping: string,
  fixture = GRAPH_FIXTURE,
  runtimeGuard = "typed graph validation",
): WorkflowSemanticRule & { readonly id: Id } => ({
  id,
  subject,
  status: "supported",
  reason: "Mapped through the canonical Maestro workflow authoring path.",
  repair: "Use the named typed constructor and rerun pnpm check:workflow:fast.",
  typedConstructor,
  compilerMapping,
  fixture,
  runtimeGuard,
  documentation: DOC,
});

const restricted = <const Id extends string>(
  id: Id,
  subject: string,
  reason: string,
  repair: string,
  fixture = GRAPH_FIXTURE,
): WorkflowSemanticRule & { readonly id: Id } => ({
  id,
  subject,
  status: "intentionally-restricted",
  reason,
  repair,
  typedConstructor: "not exposed",
  compilerMapping: "rejected before generation",
  fixture,
  runtimeGuard: "semantic gate rejection",
  documentation: DOC,
});

const unsupported = <const Id extends string>(
  id: Id,
  subject: string,
  reason: string,
  repair: string,
  fixture = GRAPH_FIXTURE,
): WorkflowSemanticRule & { readonly id: Id } => ({
  id,
  subject,
  status: "unsupported",
  reason,
  repair,
  typedConstructor: "not exposed",
  compilerMapping: "rejected before generation",
  fixture,
  runtimeGuard: "semantic gate rejection",
  documentation: DOC,
});

export const WORKFLOW_SEMANTICS = [
  supported(
    "WF-GRAPH-ID",
    "graph.id",
    "DurableWorkflowGraph.id",
    "workflow release identity",
  ),
  supported(
    "WF-GRAPH-VERSION",
    "graph.version",
    "DurableWorkflowGraph.version",
    "immutable graph version",
  ),
  supported(
    "WF-GRAPH-START",
    "graph.startNodeId",
    "DurableWorkflowGraph.startNodeId",
    "readStartNode",
  ),
  supported(
    "WF-GRAPH-NODES",
    "graph.nodes",
    "DurableWorkflowGraph.nodes",
    "runDurableGraphWorkflow",
  ),
  supported(
    "WF-GRAPH-EDGES",
    "graph.edges",
    "DurableWorkflowGraph.edges",
    "ready-node traversal",
  ),
  supported(
    "WF-GRAPH-JOINS",
    "graph.joins",
    "DurableWorkflowGraph.joins",
    "join readiness",
  ),
  supported(
    "WF-GRAPH-SCHEMA-VERSION",
    "graph.schemaVersion",
    "DurableWorkflowGraphV2.schemaVersion",
    "v2 decoder dispatch",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-GRAPH-ARGS-SCHEMA",
    "graph.argsSchemaName",
    "defineWorkflowGraphV2.argsSchemaName",
    "generated runner args validator binding",
    GENERATOR_FIXTURE,
  ),
  supported(
    "WF-GRAPH-RETURN-SCHEMA",
    "graph.returnSchemaName",
    "defineWorkflowGraphV2.returnSchemaName",
    "generated runner return validator binding",
    GENERATOR_FIXTURE,
  ),
  supported(
    "WF-GRAPH-PRINCIPAL-SCHEMA",
    "graph.principalSchemaName",
    "defineWorkflowGraphV2.principalSchemaName",
    "generated reserved principal validator binding",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-GRAPH-POLICY-POSTURE",
    "graph.policyPosture",
    "policyPosture.none | policyPosture.pinned",
    "defineMaestroWorkflow metadata policy posture",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-GRAPH-KICKOFF-PROFILES",
    "graph.kickoffProfiles",
    "defineWorkflowGraphV2.kickoffProfiles",
    "named generated start mutations",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-GRAPH-UNSTABLE-ARGS",
    "graph.unstableArgs",
    "defineWorkflowGraphV2.unstableArgs",
    "false default or ADR-gated graph metadata",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-NODE-ID",
    "graph.nodes[].id",
    "WorkflowNode.id",
    "stable journal step identity",
  ),
  supported(
    "WF-NODE-KIND",
    "graph.nodes[].kind",
    "WorkflowNodeKind",
    "nodeExecutors lookup",
  ),
  supported(
    "WF-NODE-LABEL",
    "graph.nodes[].label",
    "WorkflowNode.label",
    "receipt projection",
  ),
  supported(
    "WF-NODE-CAPABILITY",
    "graph.nodes[].capability",
    "WorkflowNode.capability",
    "generated capability registry",
  ),
  supported(
    "WF-NODE-AGENT",
    "graph.nodes[].agent",
    "WorkflowNode.agent",
    "generated agent-seat capability registry",
  ),
  supported(
    "WF-NODE-DELAY",
    "graph.nodes[].delayMs",
    "WorkflowNode.delayMs",
    "step.sleep",
  ),
  supported(
    "WF-NODE-STEP-NAME",
    "graph.nodes[].stepName",
    "WorkflowStepName",
    "unique durable step name",
    V2_GRAPH_FIXTURE,
  ),
  restricted(
    "WF-NODE-PAYLOAD-POLICY",
    "graph.nodes[].payloadPolicy",
    "WP-1.1 validates payload metadata but does not enforce budgets at the capability boundary.",
    "Keep generated bounded defaults until the WP-1.6 payload compiler and size fixtures land.",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-NODE-SEMANTIC-RULES",
    "graph.nodes[].semanticRuleIds",
    "WorkflowSemanticRuleId[]",
    "defineMaestroWorkflow semantic coverage validation",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-NODE-FAILURE-POLICY",
    "graph.nodes[].failurePolicy",
    "WorkflowFailurePolicy<WorkflowCapabilityReference, WorkflowStepName>",
    "project declared policy to validated failureRoutes before ready-wave dispatch",
    FAILURE_POLICY_FIXTURE,
    "undeclared routing rethrows the first settled rejection",
  ),
  supported(
    "WF-FAILURE-POLICY-KIND",
    "graph.nodes[].failurePolicy.kind",
    "fail | error-edge | compensation",
    "select fail, passed error edge, or declared compensation compiler",
    FAILURE_POLICY_FIXTURE,
    "tagged-union decoding with no implicit routing fallback",
  ),
  supported(
    "WF-FAILURE-EDGE",
    "graph.nodes[].failurePolicy.edgeId",
    "errorEdgePolicy.edgeId | compensationPolicy.edgeId",
    "validateFailureRoutes existing outgoing edge then passedEdges.add(edgeId)",
    FAILURE_POLICY_FIXTURE,
    "route must name an outgoing edge of the failed capability node",
  ),
  supported(
    "WF-FAILURE-ENVELOPE",
    "graph.nodes[].failurePolicy.failure",
    "WorkflowSettledFailure",
    "apply typed failure to stable declared-order workflow context",
    FAILURE_POLICY_FIXTURE,
    "safe tagged code and bounded single-line message",
  ),
  supported(
    "WF-FAILURE-COMPENSATION-STEPS",
    "graph.nodes[].failurePolicy.steps",
    "non-empty WorkflowCompensationStep[]",
    "filter to completed graph nodes and execute in reverse declared order",
    FAILURE_POLICY_FIXTURE,
    "empty compensation plans and missing immutable registry provenance fail before dispatch",
  ),
  supported(
    "WF-FAILURE-COMPENSATION-NODE",
    "graph.nodes[].failurePolicy.steps[].forNodeId",
    "existing durable graph node id",
    "compensate only steps whose durable node completed in the settled execution",
    FAILURE_POLICY_FIXTURE,
    "unknown node ids fail graph validation",
  ),
  supported(
    "WF-FAILURE-COMPENSATION-CAPABILITY",
    "graph.nodes[].failurePolicy.steps[].capability",
    "WorkflowCapabilityReference",
    "run completed compensation steps in reverse order through generated action capability registry",
    FAILURE_POLICY_FIXTURE,
    "generated versioned capability reference and registry membership",
  ),
  supported(
    "WF-FAILURE-COMPENSATION-STEP",
    "graph.nodes[].failurePolicy.steps[].stepName",
    "WorkflowStepName",
    "run each compensation with its own immutable registry payload policy, semantic provenance, and stable name",
    FAILURE_POLICY_FIXTURE,
    "versioned restart-safe step name",
  ),
  supported(
    "WF-FAILURE-TAG",
    "graph.nodes[].failurePolicy.failure._tag",
    "WorkflowSettledFailure._tag",
    "validateFailureRoutes typed settled failure discriminator",
    FAILURE_POLICY_FIXTURE,
  ),
  supported(
    "WF-FAILURE-CODE",
    "graph.nodes[].failurePolicy.failure.code",
    "WorkflowSafeFailureCode",
    "project redacted stable failure code to workflow context",
    FAILURE_POLICY_FIXTURE,
    "non-empty uppercase safe code",
  ),
  supported(
    "WF-FAILURE-MESSAGE",
    "graph.nodes[].failurePolicy.failure.message",
    "WorkflowSafeFailureMessage",
    "project redacted stable failure message to workflow context",
    FAILURE_POLICY_FIXTURE,
    "non-empty single-line message capped at 256 characters",
  ),
  restricted(
    "WF-FAILURE-UNDECLARED-ROUTE",
    "behavior.failureRouting.undeclared",
    "Implicit error-edge or compensation routing hides settled sibling behavior.",
    "Declare nodes[].failurePolicy or retain fail behavior.",
    FAILURE_POLICY_FIXTURE,
  ),
  supported(
    "WF-NODE-FUNCTION-KIND",
    "graph.nodes[].functionKind",
    "workflowNode action/query/mutation constructors",
    "validated functionKind -> exact generated registry kind -> matching runAction/runQuery/runMutation",
    GRAPH_FIXTURE,
    "registry kind mismatch, action-only retry, and query/mutation transaction posture fail before dispatch",
  ),
  restricted(
    "WF-NODE-SCHEDULE",
    "graph.nodes[].schedule",
    "Durable schedule options are not compiled by the WP-1.1 bootstrap runner.",
    "Use an unscheduled node until the WP-1.11 scheduling compiler and horizon fixtures land.",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-NODE-TRANSACTION",
    "graph.nodes[].transaction",
    "workflowNode.query/mutation and inlineQuery/inlineMutation",
    "independent -> named step options; guarded inline -> { inline: true, transactionLimits }",
    INLINE_TRANSACTION_BUILDER_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-NODE-EVENT-DEFINITION",
    "graph.nodes[].eventDefinition",
    "defineWorkflowEvent + defineWorkflowV2EventRegistry",
    "eventDefinition -> exact generated registry entry -> runRegisteredWorkflowEvent",
    GRAPH_FIXTURE,
    "opaque definition and ownership mismatch rejection before awaitEvent",
  ),
  supported(
    "WF-NODE-EVENT-SCHEMA",
    "graph.nodes[].eventSchemaName",
    "WorkflowEventDefinition schema + validator",
    "eventSchemaName -> exact generated definition schemaName + shared delivery validator",
    GRAPH_FIXTURE,
    "schema mismatch and invalid delivery rejection before component dispatch",
  ),
  supported(
    "WF-NODE-EVENT-INSTANCE",
    "graph.nodes[].eventInstanceKey",
    "WorkflowEventNodeV2.eventInstanceKey + ProductWorkflowEventId",
    "eventInstanceKey -> persisted workflowEventInstances allocation -> component-owned EventId",
    GRAPH_FIXTURE,
    "workspace, run, generation, definition, instance, principal, creator, lifecycle ownership",
  ),
  restricted(
    "WF-NODE-SUBWORKFLOW",
    "graph.nodes[].workflow",
    "Exact-version publication binding, cycle/depth/fan-out preflight, durable authority inheritance, bounded payload receipts, and idempotent product-run linkage are implemented; product lifecycle cascade cancellation and cleanup remain restricted.",
    "Keep child cancellation and cleanup restricted until product lifecycle controls can drive and prove cascade execution, reconciliation, quiescence, and retention without relying on unsupported scheduled-child semantics in Workflow 0.4.4.",
    GRAPH_FIXTURE,
  ),
  supported(
    "WF-NODE-CHILD-VERSION",
    "graph.nodes[].childVersion",
    "WorkflowNodeV2.childVersion + immutable publication subworkflow runtime binding",
    "workflow reference/version -> published graph snapshot, runner, mapper, result schema, lifecycle contract, and exact workflowRunLinks reconciliation",
    GRAPH_FIXTURE,
    "registry-key/version mismatch, forged graph snapshot, mapper/schema identity drift, dependency checksum drift, cycle/depth/fan-out, and replay fixtures",
  ),
  supported(
    "WF-BATCH-MAX-ITEMS",
    "graph.nodes[].maxItems",
    "WorkflowBoundedSubworkflowBatchNodeV2.maxItems",
    "pre-dispatch selected-item ceiling",
    GRAPH_FIXTURE,
    "positive integer at most 8192; overflow rejects instead of truncating",
  ),
  supported(
    "WF-BATCH-SIZE",
    "graph.nodes[].batchSize",
    "WorkflowBoundedSubworkflowBatchNodeV2.batchSize",
    "deterministic contiguous batch partition",
    GRAPH_FIXTURE,
    "positive integer no larger than maxItems",
  ),
  supported(
    "WF-BATCH-FAN-OUT",
    "graph.nodes[].fanOut",
    "WorkflowBoundedSubworkflowBatchNodeV2.fanOut",
    "bounded Promise.allSettled wave over Workpool-owned child dispatch",
    GRAPH_FIXTURE,
    "positive integer within topology policy; Workpool remains the only scheduler",
  ),
  supported(
    "WF-NODE-RETRY",
    "graph.nodes[].retry",
    "WorkflowActionNodeV2.retry with WorkflowEffectContract",
    "runAction { name, retry } after effect reservation and provider-key proof",
    GRAPH_FIXTURE,
    "action-only strategy, guard, finite-horizon, dedupe-coverage, and key-path validation; V1 remains one-attempt",
  ),
  supported(
    "WF-RETRY-MAX-ATTEMPTS",
    "graph.nodes[].retry.maxAttempts",
    "WorkflowRetryConfigV2.maxAttempts",
    "exact runAction.retry.maxAttempts including the initial attempt",
    GRAPH_FIXTURE,
    "finite positive integer; non-retriable effects reject values above one",
  ),
  restricted(
    "WF-RETRY-BACKOFF",
    "graph.nodes[].retry.backoffMs",
    "Backoff is not yet compiled into action retry behavior.",
    "Set backoffMs to 0 or use a reviewed capability-owned retry seam.",
  ),
  supported(
    "WF-RETRY-INITIAL-BACKOFF",
    "graph.nodes[].retry.initialBackoffMs",
    "WorkflowRetryConfigV2.initialBackoffMs",
    "exact runAction.retry.initialBackoffMs",
    GRAPH_FIXTURE,
    "finite and nonnegative with covered retry plus restart horizon",
  ),
  supported(
    "WF-RETRY-BASE",
    "graph.nodes[].retry.base",
    "WorkflowRetryConfigV2.base",
    "exact runAction.retry.base",
    GRAPH_FIXTURE,
    "finite and at least one with a declarative effect strategy",
  ),
  restricted(
    "WF-SCHEDULE-KIND",
    "graph.nodes[].schedule.kind",
    "WP-1.1 does not compile runAfter or runAt options.",
    "Omit scheduling until WP-1.11 adds exact option and horizon fixtures.",
    V2_BUILDER_FIXTURE,
  ),
  restricted(
    "WF-SCHEDULE-DELAY",
    "graph.nodes[].schedule.delayMs",
    "WP-1.1 does not compile delayed node starts.",
    "Use an explicit delay node or wait for WP-1.11 schedule support.",
    V2_BUILDER_FIXTURE,
  ),
  restricted(
    "WF-SCHEDULE-TIMESTAMP",
    "graph.nodes[].schedule.timestamp",
    "WP-1.1 does not compile timestamp node starts.",
    "Omit runAt until WP-1.11 validates the scheduling horizon.",
    V2_BUILDER_FIXTURE,
  ),
  restricted(
    "WF-PAYLOAD-MAX-INPUT",
    "graph.nodes[].payloadPolicy.maxInputBytes",
    "The bootstrap runner does not enforce pre-component input budgets.",
    "Keep the generated bounded value until WP-1.6 adds getConvexSize enforcement.",
    V2_GRAPH_FIXTURE,
  ),
  restricted(
    "WF-PAYLOAD-MAX-RESULT",
    "graph.nodes[].payloadPolicy.maxResultBytes",
    "The bootstrap runner does not enforce capability result budgets.",
    "Keep the generated bounded value until WP-1.6 adds pre-return enforcement.",
    V2_GRAPH_FIXTURE,
  ),
  restricted(
    "WF-PAYLOAD-RESULT-MODE",
    "graph.nodes[].payloadPolicy.resultMode",
    "Artifact projection is not compiled by the WP-1.1 bootstrap runner.",
    "Use inline generated defaults until the artifact-reference compiler lands.",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-TRANSACTION-KIND",
    "graph.nodes[].transaction.kind",
    "WorkflowIndependentTransaction | WorkflowInlineTransaction",
    "transaction.kind -> independent options or guarded inline options",
    INLINE_TRANSACTION_BUILDER_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-LIMITS",
    "graph.nodes[].transaction.limits",
    "inlineTransactionPreset | reviewedInlineTransaction",
    "validated limits -> step.runQuery/runMutation transactionLimits",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-BYTES-READ",
    "graph.nodes[].transaction.limits.bytesRead",
    "InlineTransactionLimits.bytesRead",
    "transaction.limits.bytesRead -> transactionLimits.bytesRead",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-BYTES-WRITTEN",
    "graph.nodes[].transaction.limits.bytesWritten",
    "InlineTransactionLimits.bytesWritten",
    "transaction.limits.bytesWritten -> transactionLimits.bytesWritten",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-DATABASE-QUERIES",
    "graph.nodes[].transaction.limits.databaseQueries",
    "InlineTransactionLimits.databaseQueries",
    "transaction.limits.databaseQueries -> transactionLimits.databaseQueries",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-DOCUMENTS-READ",
    "graph.nodes[].transaction.limits.documentsRead",
    "InlineTransactionLimits.documentsRead",
    "transaction.limits.documentsRead -> transactionLimits.documentsRead",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-DOCUMENTS-WRITTEN",
    "graph.nodes[].transaction.limits.documentsWritten",
    "InlineTransactionLimits.documentsWritten",
    "transaction.limits.documentsWritten -> transactionLimits.documentsWritten",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-FUNCTIONS-SCHEDULED",
    "graph.nodes[].transaction.limits.functionsScheduled",
    "InlineTransactionLimits.functionsScheduled",
    "transaction.limits.functionsScheduled -> transactionLimits.functionsScheduled",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-TRANSACTION-SCHEDULED-FUNCTION-ARGS-BYTES",
    "graph.nodes[].transaction.limits.scheduledFunctionArgsBytes",
    "InlineTransactionLimits.scheduledFunctionArgsBytes",
    "transaction.limits.scheduledFunctionArgsBytes -> transactionLimits.scheduledFunctionArgsBytes",
    GRAPH_FIXTURE,
    INLINE_TRANSACTION_GUARD,
  ),
  supported(
    "WF-KICKOFF-NAME",
    "graph.kickoffProfiles[].name",
    "kickoffProfile.name",
    "generated named start mutation",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-KICKOFF-MODE",
    "graph.kickoffProfiles[].mode",
    "eagerFirstPollProfile | queuedProfile",
    "generated fixed startAsync option",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-KICKOFF-DEFAULT",
    "graph.kickoffProfiles[].default",
    "kickoffProfile.default",
    "defineMaestroWorkflow exactly-one-default guard",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-UNSTABLE-ARGS-ENABLED",
    "graph.unstableArgs.enabled",
    "stableWorkflowArgs | unstableWorkflowArgs",
    "false default with ADR guard",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-UNSTABLE-ARGS-ADR",
    "graph.unstableArgs.adrRef",
    "unstableWorkflowArgs.adrRef",
    "non-empty approved ADR reference guard",
    V2_BUILDER_FIXTURE,
  ),
  supported(
    "WF-POLICY-KIND",
    "graph.policyPosture.kind",
    "policyPosture.none | policyPosture.pinned",
    "discriminated policy metadata binding",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-POLICY-NONE-REASON",
    "graph.policyPosture.reason",
    "policyPosture.none(reason)",
    "generated explicit no-policy reason",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-POLICY-SCHEMA",
    "graph.policyPosture.schemaName",
    "policyPosture.pinned.schemaName",
    "versioned policy schema binding",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-POLICY-VERSION",
    "graph.policyPosture.policyVersionId",
    "policyPosture.pinned.policyVersionId",
    "immutable policy version binding",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-POLICY-HASH",
    "graph.policyPosture.policyHash",
    "policyPosture.pinned.policyHash",
    "immutable policy fingerprint binding",
    V2_GRAPH_FIXTURE,
  ),
  supported(
    "WF-EDGE-ID",
    "graph.edges[].id",
    "WorkflowEdge.id",
    "edge validation and provenance",
  ),
  supported(
    "WF-EDGE-SOURCE",
    "graph.edges[].sourceNodeId",
    "WorkflowEdge.sourceNodeId",
    "ready-node traversal",
  ),
  supported(
    "WF-EDGE-TARGET",
    "graph.edges[].targetNodeId",
    "WorkflowEdge.targetNodeId",
    "ready-node traversal",
  ),
  supported(
    "WF-EDGE-CONDITION",
    "graph.edges[].condition",
    "WorkflowEdge.condition",
    "safe condition evaluator",
  ),
  supported(
    "WF-EDGE-EXPRESSION",
    "graph.edges[].condition.expression",
    "WorkflowCondition.expression",
    "evaluateSafeConditionExpression",
  ),
  supported(
    "WF-JOIN-NODE",
    "graph.joins[].nodeId",
    "WorkflowJoin.nodeId",
    "join readiness",
  ),
  supported(
    "WF-JOIN-STRATEGY",
    "graph.joins[].strategy",
    "WorkflowJoin.strategy",
    "all/any successful join evaluation",
  ),
  supported(
    "WF-JOIN-SOURCES",
    "graph.joins[].sourceNodeIds",
    "WorkflowJoin.sourceNodeIds",
    "join source validation",
  ),
  unsupported(
    "WF-WORKPOOL-DUPLICATE-COMPLETION",
    "compatibility.workpool.duplicateCompletion",
    "Workpool 0.4.7 and candidate 0.4.8 both behaviorally mutate the accepted attempt before checking for an existing pending completion.",
    "Keep production workflow support disabled until Agent B proves a runtime avoidance guard against the same behavioral fixture or the matrix adopts a tested fixed Workpool version.",
    WORKPOOL_SAFETY_FIXTURE,
  ),
  unsupported(
    "WF-WORKPOOL-CANCEL-RACE",
    "compatibility.workpool.duplicateCancellation",
    "Workpool 0.4.7 and candidate 0.4.8 both behaviorally process duplicate cancellations concurrently and can double-delete pending work.",
    "Use workflow-optional mode and reject production cancellation activation until Agent B proves serialized idempotent cancellation against the same fixture or the matrix adopts a tested fixed version.",
    WORKPOOL_SAFETY_FIXTURE,
  ),
  supported(
    "WF-DEFINE",
    "primitive.defineWorkflow",
    "defineMaestroWorkflow",
    "generated component runner",
    GENERATOR_FIXTURE,
    "raw import allowlist",
  ),
  supported(
    "WF-STEP-QUERY",
    "primitive.runQuery",
    "capabilityQueryStep",
    "step.runQuery(generated capability ref)",
  ),
  supported(
    "WF-STEP-MUTATION",
    "primitive.runMutation",
    "capabilityMutationStep",
    "step.runMutation(generated capability ref)",
  ),
  supported(
    "WF-STEP-ACTION",
    "primitive.runAction",
    "workflowNode.action with a generated WorkflowEffectContract",
    "step.runAction with stable name and exact retry after authority and effect admission",
    GRAPH_FIXTURE,
    "three explicit strategies, dedupe/restart horizon, ambiguity branch, key mapping, guard, and redaction enforcement",
  ),
  unsupported(
    "WF-CHILD-SCHEDULE",
    "primitive.runWorkflow",
    "Workflow 0.4.4 drops required scheduled-child option propagation.",
    "Use a named sleep followed by an unscheduled child as an explicitly non-equivalent repair, or adopt a tested compatible Workflow upgrade.",
  ),
  supported(
    "WF-STEP-SLEEP",
    "primitive.sleep",
    "delayNode",
    "step.sleep(delayMs, stable name)",
  ),
  supported(
    "WF-STEP-EVENT",
    "primitive.awaitEvent",
    "runRegisteredWorkflowEvent",
    "ID-bound generated event definition -> shared validator awaitEvent -> persisted consumed reconciliation",
    GRAPH_FIXTURE,
    "opaque ownership, generation, definition, instance, cancellation, and duplicate-consume rejection before awaitEvent",
  ),
  supported(
    "WF-START-EAGER",
    "primitive.start.eagerFirstPoll",
    "eagerFirstPollProfile",
    "WorkflowManager.start(startAsync false)",
  ),
  supported(
    "WF-START-QUEUED",
    "primitive.start.queued",
    "queuedProfile",
    "WorkflowManager.start(startAsync true)",
  ),
  supported(
    "WF-STATUS",
    "primitive.status",
    "workflow status contract",
    "getStatus projection",
  ),
  supported(
    "WF-CANCEL",
    "primitive.cancel",
    "workflow control contract",
    "component cancel",
  ),
  supported(
    "WF-RESTART",
    "primitive.restart",
    "workflow control contract",
    "component restart with stable step name",
  ),
  supported(
    "WF-CLEANUP",
    "primitive.cleanup",
    "workflow cleanup contract",
    "batched component cleanup with residual status",
  ),
  supported(
    "WF-LIST",
    "primitive.list",
    "workflow operator query",
    "component list pagination",
  ),
  supported(
    "WF-LIST-NAME",
    "primitive.listByName",
    "workflow operator query",
    "component listByName pagination",
  ),
  supported(
    "WF-LIST-STEPS",
    "primitive.listSteps",
    "workflow operator query",
    "component listSteps pagination",
  ),
  supported(
    "WF-SEND-EVENT",
    "primitive.sendEvent",
    "generated workflowContracts.sendEvent selector",
    "authenticated generated selector translation -> persisted ownership guard -> component-owned EventId delivery",
    GRAPH_FIXTURE,
    "shared validator plus terminal lifecycle and tenant rejection before component dispatch",
  ),
  restricted(
    "WF-CREATE-EVENT",
    "primitive.createEvent",
    "EventId creation remains internal to persisted generation; application-created raw EventIds bypass generated ownership.",
    "Use the generated send/await contract; allocate event instances only through the internal persisted generation path.",
  ),
  supported(
    "WF-HANDLER-DATE",
    "primitive.Date",
    "normalizedDate",
    "pinned runtime generation-state Date",
    "tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs",
    "workflow-handler-determinism",
  ),
  supported(
    "WF-HANDLER-RANDOM",
    "primitive.Math.random",
    "seededRandom",
    "pinned runtime workflow-seeded PRNG",
    "tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs",
    "workflow-handler-determinism",
  ),
  restricted(
    "WF-HANDLER-INTL",
    "primitive.Intl",
    "Pinned runtime does not normalize locale or timezone behavior.",
    "Format with explicit locale/timezone in a capability and journal the result.",
    "tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs",
  ),
  unsupported(
    "WF-HANDLER-CRYPTO",
    "primitive.crypto",
    "Cryptographic randomness is removed from replay handlers.",
    "Generate values in a capability step and journal the result.",
    "tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs",
  ),
] as const satisfies readonly WorkflowSemanticRule[];

export type WorkflowSemanticRuleId = (typeof WORKFLOW_SEMANTICS)[number]["id"];

export type WorkflowSemanticCoverageEvidence = {
  readonly posture: "generated" | "guarded-default";
  readonly constructor: string;
  readonly compiler: string;
  readonly fixture: string;
};

export const defineWorkflowSemanticCoverage = <
  const Coverage extends Partial<
    Record<WorkflowSemanticRuleId, WorkflowSemanticCoverageEvidence>
  >,
>(
  coverage: Coverage,
): Coverage => coverage;

export const validateWorkflowSemanticCoverage = (
  coverage: Readonly<Record<string, WorkflowSemanticCoverageEvidence>>,
): readonly string[] => {
  const rules = new Map<string, WorkflowSemanticRule>(
    WORKFLOW_SEMANTICS.map((rule) => [rule.id, rule]),
  );
  const findings: string[] = [];
  for (const [id, evidence] of Object.entries(coverage)) {
    const rule = rules.get(id);
    if (rule === undefined) {
      findings.push(`${id}: unknown semantic rule`);
      continue;
    }
    if (rule.status === "unsupported") {
      findings.push(`${id}: unsupported rule cannot be generated`);
    }
    if (
      rule.status === "intentionally-restricted" &&
      evidence.posture !== "guarded-default"
    ) {
      findings.push(`${id}: restricted rule requires guarded-default evidence`);
    }
    for (const [field, value] of Object.entries(evidence)) {
      if (value.trim().length === 0) findings.push(`${id}: missing ${field}`);
    }
  }
  return findings;
};

export const validateWorkflowSemantics = (
  rules: readonly WorkflowSemanticRule[],
): readonly string[] => {
  const findings: string[] = [];
  const ids = new Set<string>();
  const subjects = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) findings.push(`${rule.id}: duplicate rule id`);
    if (subjects.has(rule.subject))
      findings.push(`${rule.id}: duplicate subject`);
    ids.add(rule.id);
    subjects.add(rule.subject);
    for (const [field, value] of [
      ["reason", rule.reason],
      ["repair", rule.repair],
      ["fixture", rule.fixture],
      ["documentation", rule.documentation],
    ] as const) {
      if (value.trim().length === 0)
        findings.push(`${rule.id}: missing ${field}`);
    }
    if (rule.status === "supported") {
      for (const [field, value] of [
        ["typedConstructor", rule.typedConstructor],
        ["compilerMapping", rule.compilerMapping],
        ["runtimeGuard", rule.runtimeGuard],
      ] as const) {
        if (value.trim().length === 0)
          findings.push(`${rule.id}: missing ${field}`);
      }
    }
  }
  for (const field of WORKFLOW_GRAPH_FIELDS) {
    if (!subjects.has(`graph.${field}`))
      findings.push(`missing graph.${field}`);
  }
  for (const primitive of OFFICIAL_WORKFLOW_PRIMITIVES) {
    if (!subjects.has(`primitive.${primitive}`)) {
      findings.push(`missing primitive.${primitive}`);
    }
  }
  return findings;
};

export const renderWorkflowSemanticsMarkdown = (
  rules: readonly WorkflowSemanticRule[],
): string => {
  const rows = rules.map(
    (rule) =>
      `| ${rule.id} | \`${rule.subject}\` | ${rule.status} | ${rule.reason} | ${rule.repair} |`,
  );
  return [
    "# Generated Workflow Semantics",
    "",
    "Generated from `packages/template-core/src/workflow-semantics/contract.ts`. Do",
    "not edit by hand.",
    "",
    "<!-- prettier-ignore -->",
    "| Rule | Subject | Status | Reason | Repair |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
};
