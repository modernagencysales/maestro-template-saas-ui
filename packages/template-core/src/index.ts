export type Tone = "neutral" | "good" | "warn";

// actions.ts is Node-only (node:crypto) — import it by path, not through this
// browser-safe barrel.
export * from "./coediting";
export * from "./knowledge";
export * from "./productContract";
export * from "./productPlan";
export * from "./recipes";
export {
  checkPrimitiveContract,
  createPrimitiveContract,
  type PrimitiveContract,
  type PrimitiveContractFile,
  type PrimitiveContractFinding,
  type PrimitiveFileKind,
  type PrimitiveRuntime,
  type PrimitiveSurface,
} from "./primitiveContract";
export * from "./transforms";
export * from "./versioning";
export * from "./workPackage";

export type TemplateStat = {
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
};

export type BrainSource = {
  readonly title: string;
  readonly kind: "markdown" | "link set" | "note";
  readonly freshness: "fresh" | "review due";
  readonly evidence: string;
};

export type CapabilityExposure = "web + headless" | "workflow" | "API + CLI";

export type CapabilityDefinition = {
  readonly name: string;
  readonly exposure: CapabilityExposure;
  readonly policy: string;
  readonly description: string;
  readonly typedErrors: readonly string[];
};

export type AgentSeat = {
  readonly name: string;
  readonly grants: string;
  readonly guardrail: string;
};

export type HeadlessSurface = {
  readonly name: "Scalar API" | "CLI" | "MCP";
  readonly route: string;
  readonly contract: string;
};

export type ProviderAdapter = {
  readonly name: string;
  readonly mode: string;
  readonly status: "planned" | "guarded";
};

export type WorkflowNodeKind =
  "source" | "capability" | "agent" | "approval" | "output";

export type WorkflowTemplateNode = {
  readonly id: string;
  readonly label: string;
  readonly kind: WorkflowNodeKind;
  readonly x: number;
  readonly y: number;
};

export type WorkflowTemplateEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly label: string;
};

export type TemplateRegistry = {
  readonly stats: readonly TemplateStat[];
  readonly brainSources: readonly BrainSource[];
  readonly contextPacks: readonly string[];
  readonly capabilities: readonly CapabilityDefinition[];
  readonly agents: readonly AgentSeat[];
  readonly workflow: {
    readonly nodes: readonly WorkflowTemplateNode[];
    readonly edges: readonly WorkflowTemplateEdge[];
  };
  readonly headlessSurfaces: readonly HeadlessSurface[];
  readonly providerAdapters: readonly ProviderAdapter[];
  readonly safetyChecklist: readonly string[];
};

export type WorkflowRunStepStatus = "completed" | "waiting_for_approval";

export type WorkflowRunStep = {
  readonly id: string;
  readonly nodeId: string;
  readonly label: string;
  readonly kind: WorkflowNodeKind;
  readonly capability?: string;
  readonly agent?: string;
  readonly status: WorkflowRunStepStatus;
  readonly evidence: readonly string[];
};

export type TrustReceipt = {
  readonly receiptId: string;
  readonly workflowRunId: string;
  readonly claim: string;
  readonly sourceTitles: readonly string[];
  readonly policySnapshotId: string;
  readonly modelReceiptId: string;
  readonly trustClaim: "source-backed-no-default-rag";
  readonly policySnapshot: string;
  readonly model: string;
  readonly generatedAt: string;
};

export type WorkflowRunReceipt = {
  readonly runId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly workflowName: string;
  readonly workspaceSlug: string;
  readonly status: "completed";
  readonly trustReceiptId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly steps: readonly WorkflowRunStep[];
  readonly trustReceipt: TrustReceipt;
  readonly auditEvents: readonly string[];
};

export const templateRegistry = {
  stats: [
    { label: "Typed functions", value: "12", tone: "good" },
    { label: "Provider mode", value: "Fake/local", tone: "neutral" },
    { label: "Workflow gates", value: "Strict", tone: "good" },
    { label: "RAG default", value: "Off", tone: "warn" },
  ],
  brainSources: [
    {
      title: "Founder interview notes",
      kind: "markdown",
      freshness: "fresh",
      evidence: "12 grounded claims",
    },
    {
      title: "Product docs and policies",
      kind: "link set",
      freshness: "review due",
      evidence: "8 cited constraints",
    },
    {
      title: "Implementation preferences",
      kind: "note",
      freshness: "fresh",
      evidence: "5 reusable rules",
    },
  ],
  contextPacks: [
    "Customer-specific operating model",
    "Approved source quotes",
    "Policy snapshot and exclusions",
    "Output style and review criteria",
  ],
  capabilities: [
    {
      name: "resolveSourceSet",
      exposure: "web + headless",
      policy: "workspace member",
      description:
        "Turns markdown, links, and notes into a typed evidence view.",
      typedErrors: ["Unauthorized", "WorkspaceNotFound", "ValidationFailed"],
    },
    {
      name: "buildContextPack",
      exposure: "workflow",
      policy: "agent grant",
      description:
        "Builds a bounded prompt context with citations and freshness.",
      typedErrors: ["Forbidden", "NotFound", "FeatureDisabled"],
    },
    {
      name: "createTrustReceipt",
      exposure: "API + CLI",
      policy: "audited write",
      description:
        "Emits claim, source, model, policy, and workflow provenance.",
      typedErrors: ["Unauthorized", "ConfigInvalid", "ValidationFailed"],
    },
    {
      name: "sourceGroundedBrief",
      exposure: "API + CLI",
      policy: "workspace member",
      description:
        "Creates a source-grounded implementation brief with policy, model, and trust provenance.",
      typedErrors: [
        "Unauthenticated",
        "NoWorkspaceAccess",
        "ValidationFailed",
        "PolicyNotFound",
        "PromptNotFound",
        "LlmDisabled",
        "RateLimited",
        "SpendCapExceeded",
        "ProviderConfigInvalid",
      ],
    },
  ],
  agents: [
    {
      name: "Planner Agent",
      grants: "workflow.compose, capability.request",
      guardrail: "cannot publish or spend",
    },
    {
      name: "Research Agent",
      grants: "brain.read, source.resolve",
      guardrail: "source content is data, not instructions",
    },
    {
      name: "Operator Agent",
      grants: "run.inspect, notification.draft",
      guardrail: "approval required for external side effects",
    },
  ],
  workflow: {
    nodes: [
      { id: "source", label: "Source Set", kind: "source", x: 0, y: 80 },
      {
        id: "context",
        label: "Build Context Pack",
        kind: "capability",
        x: 260,
        y: 20,
      },
      { id: "agent", label: "Planner Agent", kind: "agent", x: 520, y: 80 },
      {
        id: "approval",
        label: "Policy Approval",
        kind: "approval",
        x: 780,
        y: 20,
      },
      {
        id: "output",
        label: "Trust Receipt",
        kind: "output",
        x: 1040,
        y: 80,
      },
    ],
    edges: [
      { id: "e1", source: "source", target: "context", label: "evidence" },
      {
        id: "e2",
        source: "context",
        target: "agent",
        label: "grounded pack",
      },
      { id: "e3", source: "agent", target: "approval", label: "agent choice" },
      {
        id: "e4",
        source: "approval",
        target: "output",
        label: "audited run",
      },
    ],
  },
  headlessSurfaces: [
    {
      name: "Scalar API",
      route: "/api/docs",
      contract: "Effect HTTP API with typed errors",
    },
    {
      name: "CLI",
      route: "maestro-template workflow run",
      contract: "@confect/js generated refs",
    },
    {
      name: "MCP",
      route: "template.workflow.describe",
      contract: "same headless registry as API",
    },
  ],
  providerAdapters: [
    { name: "WorkOS/AuthKit", mode: "fake + live", status: "planned" },
    { name: "PostHog", mode: "event contract", status: "guarded" },
    { name: "Dodo", mode: "billing fake first", status: "planned" },
    { name: "Email (Postmark)", mode: "fake + live", status: "planned" },
    { name: "OpenRouter", mode: "BYOK gateway", status: "planned" },
    { name: "Storage", mode: "signed URL policy", status: "guarded" },
  ],
  safetyChecklist: [
    "Tenant identity is server-derived, never caller-supplied.",
    "Runtime-authored capabilities are data, not arbitrary code.",
    "Provider/config errors are redacted before public boundaries.",
    "Generated Confect and Convex files are checked for drift.",
    "Source content cannot become agent instructions.",
    "Export/delete, support access, and billing changes are audited.",
  ],
} as const satisfies TemplateRegistry;

export const getWorkflowNodeIds = (registry: TemplateRegistry): Set<string> =>
  new Set(registry.workflow.nodes.map((node) => node.id));

export const validateTemplateRegistry = (
  registry: TemplateRegistry,
): readonly string[] => {
  const errors: string[] = [];
  const nodeIds = getWorkflowNodeIds(registry);

  for (const edge of registry.workflow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Workflow edge ${edge.id} has missing source ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Workflow edge ${edge.id} has missing target ${edge.target}`);
    }
  }

  for (const capability of registry.capabilities) {
    if (capability.typedErrors.length === 0) {
      errors.push(`Capability ${capability.name} must declare typed errors`);
    }
  }

  if (
    !registry.headlessSurfaces.some((surface) => surface.name === "Scalar API")
  ) {
    errors.push("Registry must expose Scalar API metadata");
  }

  if (
    !registry.providerAdapters.some(
      (adapter) => adapter.name === "WorkOS/AuthKit",
    )
  ) {
    errors.push("Registry must include WorkOS/AuthKit adapter posture");
  }

  return errors;
};

export const createSampleWorkflowRunReceipt = (
  registry: TemplateRegistry = templateRegistry,
): WorkflowRunReceipt => {
  const sourceTitles = registry.brainSources.map((source) => source.title);
  const sourceNode = registry.workflow.nodes.find(
    (node) => node.id === "source",
  );
  const contextNode = registry.workflow.nodes.find(
    (node) => node.id === "context",
  );
  const agentNode = registry.workflow.nodes.find((node) => node.id === "agent");
  const approvalNode = registry.workflow.nodes.find(
    (node) => node.id === "approval",
  );
  const outputNode = registry.workflow.nodes.find(
    (node) => node.id === "output",
  );

  if (
    !sourceNode ||
    !contextNode ||
    !agentNode ||
    !approvalNode ||
    !outputNode
  ) {
    throw new Error("Sample workflow graph is missing required receipt nodes");
  }

  return {
    runId: "run_template_001",
    workflowRunId: "run_template_001",
    workflowId: "workflow_source_grounded_plan",
    workflowVersion: 1,
    workflowName: "Source-grounded planning workflow",
    workspaceSlug: "acme-demo",
    status: "completed",
    trustReceiptId: "trust_run_template_001",
    startedAt: "2026-07-01T14:00:00.000Z",
    completedAt: "2026-07-01T14:03:12.000Z",
    steps: [
      {
        id: "step_source",
        nodeId: sourceNode.id,
        label: sourceNode.label,
        kind: sourceNode.kind,
        capability: "resolveSourceSet",
        status: "completed",
        evidence: sourceTitles,
      },
      {
        id: "step_context",
        nodeId: contextNode.id,
        label: contextNode.label,
        kind: contextNode.kind,
        capability: "buildContextPack",
        status: "completed",
        evidence: registry.contextPacks,
      },
      {
        id: "step_agent",
        nodeId: agentNode.id,
        label: agentNode.label,
        kind: agentNode.kind,
        agent: "Planner Agent",
        status: "completed",
        evidence: ["agent grant: workflow.compose", "policy snapshot: default"],
      },
      {
        id: "step_approval",
        nodeId: approvalNode.id,
        label: approvalNode.label,
        kind: approvalNode.kind,
        status: "completed",
        evidence: ["approval: synthetic reviewer-safe policy check"],
      },
      {
        id: "step_output",
        nodeId: outputNode.id,
        label: outputNode.label,
        kind: outputNode.kind,
        capability: "createTrustReceipt",
        status: "completed",
        evidence: ["trust receipt: trust_run_template_001"],
      },
    ],
    trustReceipt: {
      receiptId: "trust_run_template_001",
      workflowRunId: "run_template_001",
      claim:
        "The generated plan used only approved source sets, context packs, and audited capability grants.",
      sourceTitles,
      policySnapshotId: "policy_snapshot_template_default",
      modelReceiptId: "model_receipt_template_fake_local",
      trustClaim: "source-backed-no-default-rag",
      policySnapshot: "default-template-policy@2026-07-01",
      model: "fake/local deterministic model",
      generatedAt: "2026-07-01T14:03:12.000Z",
    },
    auditEvents: [
      "workflow.started",
      "source_set.resolved",
      "context_pack.created",
      "agent.grant_checked",
      "approval.recorded",
      "trust_receipt.created",
      "workflow.completed",
    ],
  };
};
