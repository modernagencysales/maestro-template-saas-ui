import type { CompleteBuildPack } from "./buildPack";

export type MaestroBlueprintCatalogEntry = {
  readonly id:
    | "saas-application"
    | "source-grounded-gtm-brain"
    | "gtm-implementation"
    | "implementation-consulting-brain"
    | "internal-ops-agent-workspace"
    | "custom-domain-ai-app";
  readonly status: "implemented" | "planned";
  readonly label: string;
  readonly domainNouns: readonly string[];
  readonly generatorCommands: readonly string[];
  readonly followUpGates: readonly string[];
};

export const maestroBlueprintCatalog = [
  {
    id: "source-grounded-gtm-brain",
    status: "implemented",
    label: "Source-Grounded GTM Brain",
    domainNouns: ["source", "context pack", "workflow", "trust receipt"],
    generatorCommands: [
      "pnpm template:add-capability -- --name summarizeSource --write",
      "pnpm template:add-workflow -- --name sourceGroundedPlan --write",
    ],
    followUpGates: [
      "pnpm check:confect-contracts",
      "pnpm check:workflow-graph-boundary",
    ],
  },
  {
    id: "gtm-implementation",
    status: "implemented",
    label: "GTM implementation workspace",
    domainNouns: ["account", "person", "buying committee", "account brief"],
    generatorCommands: [
      "pnpm template:quickstart -- --blueprint gtm-implementation --write",
    ],
    followUpGates: [
      "pnpm check:confect-contracts",
      "pnpm check:workflow-graph-boundary",
    ],
  },
  {
    id: "saas-application",
    status: "implemented",
    label: "Opinionated SaaS baseline",
    domainNouns: ["organization", "member", "workflow", "subscription"],
    generatorCommands: [
      "pnpm template:add-client-domain -- --name product --write",
      "pnpm template:add-capability -- --name coreWorkflow --write",
    ],
    followUpGates: ["pnpm check:confect-contracts", "pnpm check:route-tree"],
  },
  {
    id: "implementation-consulting-brain",
    status: "planned",
    label: "Implementation consulting brain",
    domainNouns: ["client", "milestone", "risk", "deliverable"],
    generatorCommands: [],
    followUpGates: ["implementation blueprint acceptance"],
  },
  {
    id: "internal-ops-agent-workspace",
    status: "planned",
    label: "Internal operations agent workspace",
    domainNouns: ["ticket", "queue", "approval", "incident"],
    generatorCommands: [],
    followUpGates: ["operations blueprint acceptance"],
  },
  {
    id: "custom-domain-ai-app",
    status: "planned",
    label: "Custom-domain AI application",
    domainNouns: [],
    generatorCommands: [],
    followUpGates: ["custom-domain architecture acceptance"],
  },
] as const satisfies readonly MaestroBlueprintCatalogEntry[];

export type MaestroBlueprintSelection = {
  readonly blueprint: MaestroBlueprintCatalogEntry;
  readonly fit: "strong" | "partial" | "low";
  readonly fitScore: number;
  readonly gaps: readonly string[];
};

const searchablePackText = (pack: CompleteBuildPack): string =>
  [
    pack.productBrief,
    pack.customerAndProblem,
    pack.architecture,
    ...pack.scope,
    ...pack.requirements,
    ...pack.integrations,
  ]
    .join(" ")
    .toLowerCase();

const blueprint = (
  id: MaestroBlueprintCatalogEntry["id"],
): MaestroBlueprintCatalogEntry => {
  const match = maestroBlueprintCatalog.find((entry) => entry.id === id);
  if (!match) throw new Error(`Unknown Maestro blueprint: ${id}`);
  return match;
};

export const selectMaestroBlueprint = (
  pack: CompleteBuildPack,
): MaestroBlueprintSelection => {
  const text = searchablePackText(pack);
  if (/\b(native|ios|android|offline sync|desktop client)\b/u.test(text)) {
    return {
      blueprint: blueprint("custom-domain-ai-app"),
      fit: "low",
      fitScore: 30,
      gaps: ["native or offline application runtime"],
    };
  }
  if (
    /\b(account|pipeline|buying committee|sales|revenue operations)\b/u.test(
      text,
    )
  ) {
    return {
      blueprint: blueprint("gtm-implementation"),
      fit: "strong",
      fitScore: 86,
      gaps: [],
    };
  }
  if (
    /\b(source|citation|knowledge base|grounded|research corpus)\b/u.test(text)
  ) {
    return {
      blueprint: blueprint("source-grounded-gtm-brain"),
      fit: "strong",
      fitScore: 82,
      gaps: [],
    };
  }
  return {
    blueprint: blueprint("saas-application"),
    fit: "strong",
    fitScore: 76,
    gaps: [],
  };
};
