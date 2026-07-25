import type { WorkflowSemanticRule } from "./schema";

export const WORKFLOW_SCHEMA_FIELDS = {
  graph: ["id", "version", "startNodeId", "nodes", "edges", "joins"],
  node: ["id", "kind", "label", "capability", "agent", "delayMs", "retry"],
  retry: ["maxAttempts", "backoffMs"],
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

export const WORKFLOW_GRAPH_FIELDS = [
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
  restricted(
    "WF-NODE-RETRY",
    "graph.nodes[].retry",
    "Current graph retry metadata is validated but not faithfully mapped for actions.",
    "Use maxAttempts 1 until the Phase 1 action retry compiler and dedupe fixtures land.",
  ),
  restricted(
    "WF-RETRY-ATTEMPTS",
    "graph.nodes[].retry.maxAttempts",
    "Attempts above one are not yet compiled into step options.",
    "Set maxAttempts to 1 or wait for the Phase 1 retry mapping.",
  ),
  restricted(
    "WF-RETRY-BACKOFF",
    "graph.nodes[].retry.backoffMs",
    "Backoff is not yet compiled into action retry behavior.",
    "Set backoffMs to 0 or use a reviewed capability-owned retry seam.",
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
  restricted(
    "WF-STEP-ACTION",
    "primitive.runAction",
    "Actions require explicit retry and idempotency posture not yet compiled.",
    "Use a mutation/query capability or wait for the Phase 1 action strategy compiler.",
  ),
  unsupported(
    "WF-CHILD-SCHEDULE",
    "primitive.runWorkflow",
    "Workflow 0.4.4 drops required scheduled-child option propagation.",
    "Schedule a parent capability or use an unscheduled child only after Phase 1 support lands.",
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
    "approvalNode",
    "step.awaitEvent(generated event name)",
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
    "typed event contract",
    "component-owned EventId send",
  ),
  restricted(
    "WF-CREATE-EVENT",
    "primitive.createEvent",
    "Application-created raw EventIds bypass generated event ownership.",
    "Use the generated send/await event contract.",
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
