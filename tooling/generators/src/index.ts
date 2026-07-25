#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDataResourceCatalog,
  type DataDeleteMode,
  type DataExportMode,
  type DataResourceCatalog,
  type DataRetention,
  type DataSensitivity,
  type DataTenantScope,
} from "@maestro-template/template-core/dataResourceCatalog";
import {
  parseProductTopology,
  type ProductTopology,
} from "@maestro-template/template-core/productTopology";
import {
  canonicalSystemById,
  findCanonicalSystems,
  normalizeSystemLookup,
  parseSystemCatalog,
  type SystemCatalog,
} from "@maestro-template/template-core/systemCatalog";
import { gtmImplementationBlueprint } from "./blueprints/gtmImplementation";
import {
  buildSaasApplicationFiles,
  buildSaasApplicationHandoff,
  saasApplicationBlueprint,
} from "./blueprints/saasApplication";
export {
  buildSaasApplicationFiles,
  buildSaasApplicationTargetPlan,
} from "./blueprints/saasApplication";
import {
  renderGeneratedFailureRouteCompiler,
  renderGeneratedWorkflowPredeploySource,
} from "./workflow-predeploy";
import { isGeneratorDirectRun } from "./direct-run";
import { workflowGeneratorSemanticCoverage } from "./workflow-semantic-coverage";
import { bumpRelease, publishRelease } from "./workflow-release-commands";

export type ProviderMode = "fake" | "test" | "live";
export type SystemGeneratorDisposition = "reuse" | "extend";

export type BlueprintId =
  "source-grounded-gtm-brain" | "gtm-implementation" | "saas-application";

export type WorkflowBackedBlueprintId = Exclude<
  BlueprintId,
  "saas-application"
>;
export type WorkflowOptionalBlueprintId = "saas-application";

type TemplateBlueprintBase = {
  readonly label: string;
  readonly summary: string;
  readonly domainNouns: readonly string[];
  readonly sourceTypes: readonly string[];
  readonly providerPosture: "fake-first";
  readonly surfaces: readonly ("web" | "api" | "cli" | "mcp")[];
};

export type WorkflowBackedTemplateBlueprint = TemplateBlueprintBase & {
  readonly id: WorkflowBackedBlueprintId;
  readonly defaultCapability: string;
  readonly defaultWorkflow: string;
  readonly defaultAgent: string;
};

export type WorkflowOptionalTemplateBlueprint = TemplateBlueprintBase & {
  readonly id: WorkflowOptionalBlueprintId;
  readonly defaultCapability: null;
  readonly defaultWorkflow: null;
  readonly defaultAgent: null;
};

export type TemplateBlueprint =
  WorkflowBackedTemplateBlueprint | WorkflowOptionalTemplateBlueprint;

export type TemplateInstance = {
  readonly name: string;
  readonly slug: string;
  readonly packageScope: string;
  readonly workspaceName: string;
  readonly blueprint: BlueprintId;
  readonly providerMode: ProviderMode;
  readonly environments: readonly ["local", "preview", "production"];
  readonly deploymentTargets: readonly ["local", "cloudflare-pages", "convex"];
  readonly modules: readonly string[];
  readonly requiredSecretNames: readonly string[];
  readonly redactionStatus: "reviewer-safe-fake-data" | "requires-review";
  readonly sourcePosture: "synthetic-demo-data" | "client-data-review-required";
  readonly providers: {
    readonly convex: "fake" | "configured";
    readonly workos: "fake" | "configured";
    readonly posthog: "fake" | "configured";
    readonly dodo: "fake" | "configured";
    readonly email: "console" | "configured";
    readonly llm: "fake" | "configured";
    readonly storage: "local" | "configured";
  };
  readonly releaseState: {
    readonly stage: "local" | "preview" | "production";
    readonly promotedCommit: string | null;
    readonly lastHandoffAt: string | null;
  };
  readonly upgradeCompatibility: {
    readonly templateVersion: string;
    readonly lastCheckedTemplateVersion: string | null;
    readonly status: "not-checked" | "compatible" | "needs-review";
    readonly requiredChecks: readonly string[];
  };
  readonly privatePackages: {
    readonly enabled: boolean;
    readonly packages: readonly string[];
    readonly promotionPolicy: "contract-review-required";
  };
  readonly intake?: {
    readonly status: "draft" | "reviewed";
    readonly briefPath: string;
    readonly generatedAt: string;
    readonly blueprint: BlueprintId;
  };
  readonly generatedAt: string;
};

export type DoctorCheck = {
  readonly id: string;
  readonly label: string;
  readonly status: "pass" | "warn" | "fail";
  readonly detail: string;
};

export type DoctorReport = {
  readonly ok: boolean;
  readonly mode: ProviderMode;
  readonly summary: string;
  readonly warningCount: number;
  readonly failureCount: number;
  readonly instancePath: string;
  readonly manifestPath: string;
  readonly checks: readonly DoctorCheck[];
};

export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};

export type DemoSeedPlan = {
  readonly blueprint: BlueprintId;
  readonly workspaceSlug: string;
  readonly providerMode: ProviderMode;
  readonly sources: readonly {
    readonly id: string;
    readonly kind: "markdown" | "link" | "note";
    readonly title: string;
    readonly body: string;
  }[];
  readonly contextPack: {
    readonly id: string;
    readonly title: string;
    readonly sourceIds: readonly string[];
  };
  readonly workflowRun: {
    readonly workflow: string;
    readonly status: "ready";
    readonly firstCapability: string;
  };
  readonly trustReceipt: {
    readonly id: string;
    readonly evidenceCount: number;
    readonly posture: "source-backed-no-default-rag";
  };
};

export type HandoffPacket = {
  readonly blueprint: BlueprintId;
  readonly mode: ProviderMode;
  readonly sections: readonly {
    readonly id: string;
    readonly title: string;
  }[];
  readonly markdown: string;
};

type TemplateQuickstartBase = {
  readonly instance: TemplateInstance;
  readonly files: readonly GeneratedFile[];
  readonly nextCommands: readonly string[];
};

export type WorkflowBackedTemplateQuickstart = TemplateQuickstartBase & {
  readonly blueprint: WorkflowBackedBlueprintId;
  readonly firstCapability: string;
  readonly firstWorkflow: string;
  readonly firstAgent: string;
};

export type WorkflowOptionalTemplateQuickstart = TemplateQuickstartBase & {
  readonly blueprint: WorkflowOptionalBlueprintId;
  readonly workflowPosture: "optional-unavailable";
  readonly firstCapability: null;
  readonly firstWorkflow: null;
  readonly firstAgent: null;
  readonly targets: readonly string[];
  readonly collisions: readonly string[];
};

export type TemplateQuickstart =
  WorkflowBackedTemplateQuickstart | WorkflowOptionalTemplateQuickstart;

export type ClientIntake = {
  readonly instance: TemplateInstance;
  readonly files: readonly GeneratedFile[];
};

export type CapabilityGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly exposure?: "web" | "workflow" | "headless";
  readonly write?: boolean;
};

export type ClientDomainGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly write?: boolean;
};

export type ClientDomainGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly files: readonly GeneratedFile[];
};

export type CapabilityGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly exposure: "web" | "workflow" | "headless";
  readonly files: readonly GeneratedFile[];
};

export type FeatureGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly write?: boolean;
};

export type FeatureGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly route: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly files: readonly GeneratedFile[];
  readonly followUp: readonly string[];
};

export type WorkflowGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly write?: boolean;
};

export type WorkflowGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly files: readonly GeneratedFile[];
};

export type AgentGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly write?: boolean;
};

export type AgentGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly surfaces: readonly ["web"];
  readonly headlessExposure: false;
  readonly files: readonly GeneratedFile[];
  readonly followUp: readonly string[];
};

export type PromotionGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly write?: boolean;
};

export type PromotionGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly target: "capability" | "workflow";
  readonly files: readonly GeneratedFile[];
  readonly followUp: readonly string[];
};

export type PrototypeGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly hypothesis: string;
  readonly write?: boolean;
};

export type PrototypeGeneratorResult = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly files: readonly GeneratedFile[];
  readonly followUp: readonly string[];
};

export type TableGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly tenantScope: DataTenantScope;
  readonly sensitivity: DataSensitivity;
  readonly pii: readonly string[];
  readonly exportMode: DataExportMode;
  readonly deleteMode: DataDeleteMode;
  readonly retention: DataRetention;
  readonly appendOnly?: boolean;
  readonly description?: string;
  readonly write?: boolean;
};

export type TableGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: "extend";
  readonly files: readonly GeneratedFile[];
};

export type TemplateUpgradeReport = {
  readonly from: string;
  readonly to: string;
  readonly ok: boolean;
  readonly changedPackages: readonly string[];
  readonly envChanges: readonly string[];
  readonly migrations: readonly string[];
  readonly generatedContractDiffs: readonly string[];
  readonly privatePackageCompatibility: readonly string[];
  readonly manualReview: readonly string[];
  readonly commands: readonly string[];
};

export type PrivatePackagePlan = {
  readonly fixturePath: string;
  readonly mode: "dry-run" | "import";
  readonly ok: boolean;
  readonly packageName: string;
  readonly files: readonly GeneratedFile[];
  readonly checks: readonly DoctorCheck[];
};

const defaultModules = [
  "brain",
  "workflows",
  "capabilities",
  "agents",
  "api",
  "mcp",
  "integrations",
  "safety",
] as const;

const defaultEnvironments = ["local", "preview", "production"] as const;
const defaultDeploymentTargets = [
  "local",
  "cloudflare-pages",
  "convex",
] as const;
type TemplateProvider = keyof TemplateInstance["providers"];

type EnvManifestVariable = {
  readonly name: string;
  readonly group: string;
  readonly requiredFor: readonly string[];
};

type EnvManifest = {
  readonly variables: readonly EnvManifestVariable[];
};

const defaultRepoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const envManifestPath = (repoRoot = defaultRepoRoot): string =>
  resolve(repoRoot, "docs/template/env-manifest.json");

const systemCatalogPath = (repoRoot = defaultRepoRoot): string =>
  resolve(repoRoot, "docs/template/system-catalog.json");

const dataResourceCatalogPath = (repoRoot = defaultRepoRoot): string =>
  resolve(repoRoot, "docs/template/data-resources.json");

const productTopologyPath = (repoRoot = defaultRepoRoot): string =>
  resolve(repoRoot, "docs/template/product-topology.json");

export const readSystemCatalog = (repoRoot = defaultRepoRoot): SystemCatalog =>
  parseSystemCatalog(
    JSON.parse(readFileSync(systemCatalogPath(repoRoot), "utf8")) as unknown,
  );

export const readDataResourceCatalog = (
  repoRoot = defaultRepoRoot,
): DataResourceCatalog =>
  parseDataResourceCatalog(
    JSON.parse(
      readFileSync(dataResourceCatalogPath(repoRoot), "utf8"),
    ) as unknown,
  );

export const readProductTopology = (
  repoRoot = defaultRepoRoot,
): ProductTopology =>
  parseProductTopology(
    JSON.parse(readFileSync(productTopologyPath(repoRoot), "utf8")) as unknown,
  );

const readEnvManifest = (
  repoRoot = defaultRepoRoot,
): EnvManifest | undefined => {
  const path = envManifestPath(repoRoot);

  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8")) as EnvManifest;
};

const providerManifestGroup = {
  convex: "convex",
  workos: "workos",
  posthog: "posthog",
  dodo: "dodo",
  email: "mailersend",
  llm: "openrouter",
  storage: "storage",
} as const satisfies Record<TemplateProvider, string>;

export const requiredEnvNamesForProvider = (
  provider: TemplateProvider,
  options?: { readonly repoRoot?: string },
): readonly string[] => {
  const manifest = readEnvManifest(options?.repoRoot);
  const group = providerManifestGroup[provider];

  if (!manifest) {
    return [];
  }

  return [
    ...new Set(
      manifest.variables
        .filter((variable) => variable.group === group)
        .filter((variable) => variable.requiredFor.includes("live"))
        .map((variable) => variable.name),
    ),
  ].sort();
};

const defaultRequiredSecretNames = (): readonly string[] => [
  ...new Set(
    (Object.keys(providerManifestGroup) as TemplateProvider[]).flatMap(
      (provider) => requiredEnvNamesForProvider(provider),
    ),
  ),
];
const defaultUpgradeRequiredChecks = [
  "pnpm check:confect-contracts",
  "pnpm check:workflow-graph-boundary",
  "pnpm check:schema-migration-notes",
  "pnpm check:secret-canaries",
] as const;

const defaultBlueprintId: WorkflowBackedBlueprintId =
  "source-grounded-gtm-brain";
const plannedBlueprintIds = [
  "implementation-consulting-brain",
  "internal-ops-agent-workspace",
  "custom-domain-ai-app",
] as const;

const supportedBlueprintIds = (): readonly BlueprintId[] =>
  buildBlueprintCatalog().map((blueprint) => blueprint.id);

const supportedBlueprintList = (): string => supportedBlueprintIds().join(", ");

export const buildBlueprintCatalog = (): readonly TemplateBlueprint[] => [
  {
    id: defaultBlueprintId,
    label: "Source-Grounded GTM Brain",
    summary:
      "A source-backed GTM brain for B2B teams: ingest trusted context, compose a context pack, run a policy-pinned workflow, and emit a Trust Receipt.",
    domainNouns: [
      "workspace",
      "source",
      "context pack",
      "capability",
      "workflow",
      "agent",
      "trust receipt",
    ],
    sourceTypes: ["markdown", "link", "note"],
    defaultCapability: "summarizeSource",
    defaultWorkflow: "sourceGroundedPlan",
    defaultAgent: "gtmBrainPlanner",
    providerPosture: "fake-first",
    surfaces: ["web", "api", "cli", "mcp"],
  },
  gtmImplementationBlueprint,
  saasApplicationBlueprint,
];

const findBlueprint = (blueprint: BlueprintId): TemplateBlueprint => {
  const match = buildBlueprintCatalog().find((entry) => entry.id === blueprint);

  if (!match) {
    throw new Error(`Unknown blueprint: ${blueprint}`);
  }

  return match;
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const kebabCase = (value: string): string =>
  slugify(value.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));

const pascalCase = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

  return normalized || "GeneratedCapability";
};

const camelCase = (value: string): string => {
  const pascal = pascalCase(value);

  return `${pascal[0]?.toLowerCase() ?? "g"}${pascal.slice(1)}`;
};

const writeGeneratedFiles = (
  files: readonly GeneratedFile[],
  cwd: string,
): void => {
  for (const file of files) {
    const targetPath = resolve(cwd, file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content);
  }
};

const assertGeneratedPathsAreNew = (
  files: readonly GeneratedFile[],
  cwd: string,
): void => {
  const existing = files
    .map(({ path }) => path)
    .filter((path) => existsSync(resolve(cwd, path)));
  if (existing.length > 0) {
    throw new Error(
      `Refusing to overwrite existing paths: ${existing.join(", ")}. Reuse or extend the existing slice, or choose a new reviewed name.`,
    );
  }
};

const withGeneratorProvenance = (
  generator: string,
  name: string,
  files: readonly GeneratedFile[],
  ownership?: {
    readonly system: string;
    readonly disposition: SystemGeneratorDisposition;
  },
): readonly GeneratedFile[] => {
  const commandFamily =
    generator === "private-package"
      ? "template:private-package:import"
      : `template:${generator}`;

  return [
    ...files,
    {
      path: `docs/template/generated/provenance/${generator}/${name}.json`,
      content: `${JSON.stringify(
        {
          generator,
          commandFamily,
          name,
          ...(ownership === undefined ? {} : { ownership }),
          generatedPaths: files.map((file) => file.path),
        },
        null,
        2,
      )}\n`,
    },
  ];
};

const readOptionalJson = <T>(path: string): T | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8")) as T;
};

export const buildTemplateInstance = (options?: {
  readonly name?: string;
  readonly blueprint?: BlueprintId;
  readonly providerMode?: ProviderMode;
  readonly generatedAt?: string;
}): TemplateInstance => {
  const name = options?.name?.trim() || "Acme AI Operations";
  const blueprint = options?.blueprint ?? defaultBlueprintId;
  const providerMode = options?.providerMode ?? "fake";
  const fakeProviders = providerMode === "fake";
  const slug = slugify(name) || "acme-ai-operations";

  return {
    name,
    slug,
    packageScope: `@${slug}`,
    workspaceName: `${name} Workspace`,
    blueprint,
    providerMode,
    environments: defaultEnvironments,
    deploymentTargets: defaultDeploymentTargets,
    modules: defaultModules,
    requiredSecretNames: defaultRequiredSecretNames(),
    redactionStatus:
      providerMode === "fake" ? "reviewer-safe-fake-data" : "requires-review",
    sourcePosture:
      providerMode === "fake"
        ? "synthetic-demo-data"
        : "client-data-review-required",
    providers: {
      convex: fakeProviders ? "fake" : "configured",
      workos: fakeProviders ? "fake" : "configured",
      posthog: fakeProviders ? "fake" : "configured",
      dodo: fakeProviders ? "fake" : "configured",
      email: fakeProviders ? "console" : "configured",
      llm: fakeProviders ? "fake" : "configured",
      storage: fakeProviders ? "local" : "configured",
    },
    releaseState: {
      stage: "local",
      promotedCommit: null,
      lastHandoffAt: null,
    },
    upgradeCompatibility: {
      templateVersion: "unreleased",
      lastCheckedTemplateVersion: null,
      status: "not-checked",
      requiredChecks: defaultUpgradeRequiredChecks,
    },
    privatePackages: {
      enabled: false,
      packages: [],
      promotionPolicy: "contract-review-required",
    },
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
  };
};

export const parseTemplateInstance = (raw: string): TemplateInstance => {
  const parsed = JSON.parse(raw) as Partial<TemplateInstance>;

  if (!parsed.name || !parsed.slug || !parsed.providerMode) {
    throw new Error(
      "template-instance.json is missing name, slug, or providerMode",
    );
  }

  if (!["fake", "test", "live"].includes(parsed.providerMode)) {
    throw new Error(`Unknown providerMode: ${parsed.providerMode}`);
  }

  return {
    ...parsed,
    packageScope: parsed.packageScope ?? `@${parsed.slug}`,
    blueprint: parsed.blueprint ?? defaultBlueprintId,
    environments: parsed.environments ?? defaultEnvironments,
    deploymentTargets: parsed.deploymentTargets ?? defaultDeploymentTargets,
    requiredSecretNames:
      parsed.requiredSecretNames ?? defaultRequiredSecretNames(),
    redactionStatus:
      parsed.redactionStatus ??
      (parsed.providerMode === "fake"
        ? "reviewer-safe-fake-data"
        : "requires-review"),
    sourcePosture:
      parsed.sourcePosture ??
      (parsed.providerMode === "fake"
        ? "synthetic-demo-data"
        : "client-data-review-required"),
    releaseState: parsed.releaseState ?? {
      stage: "local",
      promotedCommit: null,
      lastHandoffAt: null,
    },
    upgradeCompatibility: parsed.upgradeCompatibility ?? {
      templateVersion: "unreleased",
      lastCheckedTemplateVersion: null,
      status: "not-checked",
      requiredChecks: defaultUpgradeRequiredChecks,
    },
    privatePackages: parsed.privatePackages ?? {
      enabled: false,
      packages: [],
      promotionPolicy: "contract-review-required",
    },
    ...(parsed.intake ? { intake: parsed.intake } : {}),
  } as TemplateInstance;
};

const providerChecks = (
  instance: TemplateInstance,
  mode: ProviderMode,
  options?: { readonly repoRoot?: string },
): readonly DoctorCheck[] => {
  const entries = Object.entries(instance.providers) as readonly [
    TemplateProvider,
    TemplateInstance["providers"][keyof TemplateInstance["providers"]],
  ][];

  return entries.map(([provider, status]) => {
    const readyForFake =
      mode === "fake" && ["fake", "console", "local"].includes(status);
    const readyForLive = mode !== "fake" && status === "configured";

    return {
      id: `provider:${provider}`,
      label: `${provider} provider`,
      status: readyForFake || readyForLive ? "pass" : "warn",
      detail:
        readyForFake || readyForLive
          ? `${provider} is valid for ${mode} mode`
          : `${provider} should be configured before ${mode} handoff. Required env names from env-manifest.json: ${requiredEnvNamesForProvider(provider, options).join(", ")}`,
    };
  });
};

export const doctorTemplateInstance = (
  instance: TemplateInstance,
  options?: {
    readonly mode?: ProviderMode;
    readonly instancePath?: string;
    readonly repoRoot?: string;
  },
): DoctorReport => {
  const mode = options?.mode ?? instance.providerMode;
  const requiredModules = ["brain", "workflows", "capabilities", "api", "mcp"];
  const checks: DoctorCheck[] = [
    {
      id: "instance:slug",
      label: "Instance slug",
      status: instance.slug === slugify(instance.name) ? "pass" : "warn",
      detail: `Slug is ${instance.slug}`,
    },
    {
      id: "modules:core",
      label: "Core modules",
      status: requiredModules.every((module) =>
        instance.modules.includes(module),
      )
        ? "pass"
        : "fail",
      detail: `Required modules: ${requiredModules.join(", ")}`,
    },
    ...providerChecks(
      instance,
      mode,
      options?.repoRoot ? { repoRoot: options.repoRoot } : undefined,
    ),
  ];
  const warningCount = checks.filter((check) => check.status === "warn").length;
  const failureCount = checks.filter((check) => check.status === "fail").length;
  const ok = failureCount === 0;

  return {
    ok,
    mode,
    summary: `mode=${mode} ok=${ok} warnings=${warningCount} failures=${failureCount}`,
    warningCount,
    failureCount,
    instancePath: options?.instancePath ?? "template-instance.json",
    manifestPath: envManifestPath(options?.repoRoot),
    checks,
  };
};

export const buildDemoSeedPlan = (options?: {
  readonly blueprint?: BlueprintId;
  readonly workspaceSlug?: string;
  readonly providerMode?: ProviderMode;
}): DemoSeedPlan => {
  const blueprint = options?.blueprint ?? defaultBlueprintId;
  const blueprintConfig = findBlueprint(blueprint);
  if (
    blueprintConfig.defaultWorkflow === null ||
    blueprintConfig.defaultCapability === null
  ) {
    throw new Error(
      `Blueprint ${blueprint} has no workflow demo seed; use its application seed instead.`,
    );
  }
  const workspaceSlug = options?.workspaceSlug ?? "acme-ai-operations";
  const sources = [
    {
      id: "source_markdown_positioning",
      kind: "markdown" as const,
      title: "Positioning Notes",
      body: "Synthetic markdown describing the company, target customers, current offer, and proof points.",
    },
    {
      id: "source_link_homepage",
      kind: "link" as const,
      title: "Company Homepage",
      body: "https://example.com acts as a reviewer-safe link source in fake mode.",
    },
    {
      id: "source_note_discovery",
      kind: "note" as const,
      title: "Discovery Call Notes",
      body: "Synthetic notes capturing buyer pains, objections, sales motion, and implementation constraints.",
    },
  ];

  return {
    blueprint,
    workspaceSlug,
    providerMode: options?.providerMode ?? "fake",
    sources,
    contextPack: {
      id: "context_pack_gtm_foundation",
      title: "GTM Foundation Context Pack",
      sourceIds: sources.map((source) => source.id),
    },
    workflowRun: {
      workflow: blueprintConfig.defaultWorkflow,
      status: "ready",
      firstCapability: blueprintConfig.defaultCapability,
    },
    trustReceipt: {
      id: "trust_receipt_demo",
      evidenceCount: sources.length,
      posture: "source-backed-no-default-rag",
    },
  };
};

const buildImplementationBrief = (
  instance: TemplateInstance,
  blueprint: TemplateBlueprint,
): string => `# ${instance.name} Implementation Brief

This fork starts from the ${blueprint.label} blueprint: a source-backed GTM brain for a typical B2B company.

## What This Gives Us

- A fake-first app that can demonstrate value without provider setup.
- A source-backed Brain built from markdown, links, and notes.
- A first capability, \`${blueprint.defaultCapability}\`, that can be replaced with client-specific logic.
- A first workflow, \`${blueprint.defaultWorkflow}\`, that connects context to a Trust Receipt.
- A first agent, \`${blueprint.defaultAgent}\`, with explicit grants instead of arbitrary backend access.
- Web, API, CLI, and MCP surfaces that share the same capability/workflow contracts.

## Domain Starting Point

Use these nouns as the first client discovery map: ${blueprint.domainNouns.join(", ")}.

## Extension Path

1. Replace synthetic sources with reviewed client context.
2. Add client-specific source types only when they have an owner, retention policy, and redaction posture.
3. Promote reviewed runtime capabilities and workflows into Confect/Effect source.
4. Keep client-specific prompts, integrations, and business logic in generated modules or private packages until reviewed.
`;

const buildProviderSetupChecklist = (
  instance: TemplateInstance,
  blueprint: TemplateBlueprint,
): string => `# ${instance.name} Provider Setup Checklist

Status: generated fake-mode checklist.

Use this checklist with [env-manifest.md](../env-manifest.md). Keep fake mode
until the client has approved the provider family, data map, and production
owner.

## Current Posture

- Blueprint: \`${blueprint.id}\`
- Provider mode: \`${instance.providerMode}\`
- App slug: \`${instance.slug}\`
- Workspace: \`${instance.workspaceName}\`

## Fake Mode

- WorkOS: use fake AuthKit IDs until production auth is approved.
- PostHog: keep analytics disabled or test-only until event capture is approved.
- Dodo: keep billing in test/fake mode until pricing, webhooks, and ledger reconciliation are reviewed.
- MailerSend: keep email disabled or console-only until the sender domain is verified.
- OpenRouter-compatible LLM: use deterministic fake completions until spend caps, model allowlist, and redaction posture are approved.
- Storage and search: use local/fake providers until source ownership, retention, export, and delete posture are documented.
- Cloudflare and Buildkite: use local commands first, then configure hosted smoke and CI promotion after the fork is stable.

## First Live-Ready Pass

1. Copy \`.env.example\` to the local/deployment secret store.
2. Replace non-secret names first: app name, public URL, storage bucket, search prefix, and provider project names.
3. Request live secrets only for approved provider families.
4. Run \`pnpm template:doctor -- --mode fake\`.
5. Configure test credentials for the first vertical.
6. Run \`pnpm template:doctor -- --mode live\` before claiming live-provider readiness.

## Required Secret Names

See [env-manifest.md](../env-manifest.md) for ownership, fake-mode behavior,
production requirements, and rotation notes. Generated handoff packets may list
these names, but must never include secret values.
`;

export const buildHandoffPacket = (options?: {
  readonly name?: string;
  readonly blueprint?: BlueprintId;
  readonly mode?: ProviderMode;
}): HandoffPacket => {
  const blueprint = options?.blueprint ?? defaultBlueprintId;
  const blueprintConfig = findBlueprint(blueprint);
  const name = options?.name?.trim() || "Acme AI Operations";
  const mode = options?.mode ?? "fake";
  const sections = [
    { id: "overview", title: "Overview" },
    { id: "status-labels", title: "Status Labels" },
    { id: "architecture", title: "Architecture" },
    { id: "quickstart", title: "Quickstart" },
    { id: "providers", title: "Providers" },
    { id: "verification", title: "Verification" },
    { id: "next-steps", title: "Next Steps" },
  ] as const;
  const liveProviderLine =
    mode === "fake"
      ? "No live secrets required. Providers run in fake, console, or local mode."
      : "Live provider credentials must be configured through typed provider adapters before handoff.";

  return {
    blueprint,
    mode,
    sections,
    markdown: `# ${name} Handoff Packet

## Overview

${name} is generated from the ${blueprintConfig.label} blueprint. It demonstrates the private app factory path for B2B AI/GTM implementation software.

## Status Labels

- \`real\`: implemented and verified in the template or this fork.
- \`fake\`: deterministic local behavior used for demos and tests.
- \`seam\`: provider boundary exists; live adapter setup is pending client approval.
- \`planned\`: documented but not implemented for this fork.

## Architecture

- Frontend: TanStack Start direction, Saas UI/shared block UI, React Flow for workflow interaction.
- Backend: Convex with Confect/Effect contracts, typed errors, and generated refs.
- Brain: source-backed markdown, links, notes, context packs, and Trust Receipts by default.
- Headless: API, CLI, and MCP surfaces share generated capability/workflow contracts.

## Quickstart

1. Run \`pnpm template:doctor -- --mode ${mode}\`.
2. Run \`pnpm template:seed-demo -- --blueprint ${blueprint} --write\`.
3. Start the app and inspect the seeded Brain, workflow, and Trust Receipt.

## Providers

${liveProviderLine}

## Verification

- \`pnpm template:doctor -- --mode ${mode}\`
- \`pnpm check:generators\`
- \`pnpm check:confect-contracts\`
- \`pnpm check:workflow-graph-boundary\`
- \`pnpm check:secret-canaries\`

## Next Steps

Use the implementation brief to capture client nouns, source inventory, provider shortlist, first workflow, and handoff risks.
`,
  };
};

const buildBlueprintQuickstartFiles = (
  blueprint: BlueprintId,
): readonly GeneratedFile[] => {
  if (blueprint !== "gtm-implementation") {
    return [];
  }

  return [
    {
      path: "generated/blueprints/gtm-implementation/provider-seams.json",
      content: `${JSON.stringify(
        {
          blueprint,
          seams: [
            {
              id: "crm",
              mode: "fake/test/live-ready",
              purpose: "Account, person, opportunity, and activity sync.",
            },
            {
              id: "drive",
              mode: "fake/test/live-ready",
              purpose: "Client source documents and approved exports.",
            },
            {
              id: "notion",
              mode: "fake/test/live-ready",
              purpose:
                "Workspace notes, implementation docs, and handoff pages.",
            },
          ],
          liveSdkPolicy:
            "Generated provider seams are descriptors until a client fork adds reviewed SDK adapters.",
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "generated/blueprints/gtm-implementation/reporting-surfaces.json",
      content: `${JSON.stringify(
        {
          blueprint,
          surfaces: [
            {
              id: "accountBrief",
              label: "Account brief",
              source: "source-backed account context",
            },
            {
              id: "pipelineFunnel",
              label: "Pipeline funnel",
              source: "demo-safe account stage fixtures",
            },
            {
              id: "activityBoard",
              label: "Activity board",
              source: "fake/test connector events",
            },
          ],
          promotionPath:
            "generated reporting seams stay outside template core until reviewed",
        },
        null,
        2,
      )}\n`,
    },
  ];
};

type TemplateQuickstartOptions = {
  readonly name?: string;
  readonly blueprint?: BlueprintId;
  readonly providerMode?: ProviderMode;
  readonly generatedAt?: string;
  readonly cwd?: string;
};

export function buildTemplateQuickstart(
  options: TemplateQuickstartOptions & {
    readonly blueprint: WorkflowOptionalBlueprintId;
  },
): WorkflowOptionalTemplateQuickstart;
export function buildTemplateQuickstart(
  options?: TemplateQuickstartOptions & {
    readonly blueprint?: WorkflowBackedBlueprintId;
  },
): WorkflowBackedTemplateQuickstart;
export function buildTemplateQuickstart(
  options?: TemplateQuickstartOptions,
): TemplateQuickstart;
export function buildTemplateQuickstart(
  options?: TemplateQuickstartOptions,
): TemplateQuickstart {
  const blueprint = options?.blueprint ?? defaultBlueprintId;
  const blueprintConfig = findBlueprint(blueprint);
  const baseInstance = buildTemplateInstance({
    ...(options?.name ? { name: options.name } : {}),
    blueprint,
    providerMode: options?.providerMode ?? "fake",
    ...(options?.generatedAt ? { generatedAt: options.generatedAt } : {}),
  });
  const instance: TemplateInstance =
    blueprint === "saas-application"
      ? {
          ...baseInstance,
          modules: ["workspace", "records", "web", "api", "cli"],
          requiredSecretNames: [],
        }
      : baseInstance;
  if (blueprint === "saas-application") {
    const files = withGeneratorProvenance("quickstart", instance.slug, [
      {
        path: "template-instance.json",
        content: `${JSON.stringify(instance, null, 2)}\n`,
      },
      ...buildSaasApplicationFiles({ name: instance.name }),
      {
        path: "docs/template/generated/handoff-packet.md",
        content: buildSaasApplicationHandoff(instance.name),
      },
    ]);
    const targets = files.map(({ path }) => path);
    const targetCwd = options?.cwd;
    const collisions = targetCwd
      ? targets.filter((path) => existsSync(resolve(targetCwd, path)))
      : [];

    return {
      blueprint,
      instance,
      workflowPosture: "optional-unavailable",
      firstCapability: null,
      firstWorkflow: null,
      firstAgent: null,
      files,
      targets,
      collisions,
      nextCommands: [
        `pnpm maestro -- create ../${instance.slug} --name ${JSON.stringify(instance.name)} --outcome "Create and review records" --write`,
        `pnpm --dir ../${instance.slug} maestro -- start --mode fake`,
      ],
    };
  }
  const seed = buildDemoSeedPlan({
    blueprint,
    workspaceSlug: instance.slug,
    providerMode: instance.providerMode,
  });
  const handoff = buildHandoffPacket({
    name: instance.name,
    blueprint,
    mode: instance.providerMode,
  });
  const dayZeroLoop = {
    blueprint,
    firstDomainNoun: "customerContext",
    firstCapability: blueprintConfig.defaultCapability,
    firstWorkflow: blueprintConfig.defaultWorkflow,
    firstAgent: blueprintConfig.defaultAgent,
    sourceTypes: blueprintConfig.sourceTypes,
    surfaces: blueprintConfig.surfaces,
    verification: [
      "pnpm template:doctor -- --mode fake",
      "pnpm --dir tooling/generators test",
      "pnpm check:generators",
    ],
  };
  const files: readonly GeneratedFile[] = [
    {
      path: "template-instance.json",
      content: `${JSON.stringify(instance, null, 2)}\n`,
    },
    {
      path: "docs/template/generated/implementation-brief.md",
      content: buildImplementationBrief(instance, blueprintConfig),
    },
    {
      path: "docs/template/generated/provider-setup-checklist.md",
      content: buildProviderSetupChecklist(instance, blueprintConfig),
    },
    {
      path: "generated/app-factory/day-0-loop.json",
      content: `${JSON.stringify(dayZeroLoop, null, 2)}\n`,
    },
    {
      path: `examples/demo-seed/${blueprint}/demo-seed.json`,
      content: `${JSON.stringify(seed, null, 2)}\n`,
    },
    {
      path: "docs/template/generated/handoff-packet.md",
      content: handoff.markdown,
    },
    ...buildBlueprintQuickstartFiles(blueprint),
  ];

  const generatedFiles = withGeneratorProvenance(
    "quickstart",
    instance.slug,
    files,
  );
  if (
    blueprintConfig.defaultCapability === null ||
    blueprintConfig.defaultWorkflow === null ||
    blueprintConfig.defaultAgent === null
  ) {
    throw new Error(`Blueprint ${blueprint} is missing its workflow contract.`);
  }

  return {
    blueprint: blueprint as WorkflowBackedBlueprintId,
    instance,
    firstCapability: blueprintConfig.defaultCapability,
    firstWorkflow: blueprintConfig.defaultWorkflow,
    firstAgent: blueprintConfig.defaultAgent,
    files: generatedFiles,
    nextCommands: [
      "pnpm template:doctor -- --mode fake",
      "review docs/template/generated/provider-setup-checklist.md",
      `pnpm template:seed-demo -- --blueprint ${blueprint} --write`,
      "pnpm template:add-client-domain -- --name customerContext --system knowledge-brain --disposition extend --write",
      `pnpm template:add-capability -- --name ${blueprintConfig.defaultCapability} --system knowledge-brain --disposition extend --write`,
      `pnpm template:add-workflow -- --name ${blueprintConfig.defaultWorkflow} --system knowledge-brain --disposition extend --write`,
      "pnpm template:handoff -- --mode fake --write",
    ],
  };
}

export const buildClientIntake = (options?: {
  readonly name?: string;
  readonly blueprint?: BlueprintId;
  readonly providerMode?: ProviderMode;
  readonly generatedAt?: string;
}): ClientIntake => {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const blueprint = options?.blueprint ?? defaultBlueprintId;
  const blueprintConfig = findBlueprint(blueprint);
  const baseInstance = buildTemplateInstance({
    ...(options?.name ? { name: options.name } : {}),
    blueprint,
    providerMode: options?.providerMode ?? "fake",
    generatedAt,
  });
  const briefPath = "docs/template/generated/client-intake.md";
  const instance: TemplateInstance = {
    ...baseInstance,
    intake: {
      status: "draft",
      briefPath,
      generatedAt,
      blueprint,
    },
  };
  const markdown = `# ${instance.name} Client Intake

Generated: ${generatedAt}
Blueprint: \`${blueprintConfig.id}\`
Provider mode: \`${instance.providerMode}\`

This intake turns a client conversation into a structured implementation brief
for a source-backed B2B AI/GTM app. No live secrets required in fake mode.

## Business Outcome

- What business outcome should the first prototype prove?
- Who will use the app weekly, and what job are they trying to finish?
- What output would make the buyer say the system understands their business?

## Source Inventory

- Which sources are authoritative: markdown, links, notes, calls, CRM exports,
  enablement docs, product docs, or other systems?
- Who owns each source, and can it be exported, deleted, or retained?
- What should never be sent to an LLM provider?

## Domain Map

- Starting nouns: ${blueprintConfig.domainNouns.join(", ")}.
- Which nouns should be renamed for the client?
- Which nouns require new tables, policies, or provider integrations?

## First Workflow

- Default workflow: \`${blueprintConfig.defaultWorkflow}\`.
- What source set enters the workflow?
- What capability transforms it?
- What approval, Trust Receipt, or human review is required before output?

## Agents And Capabilities

- Default agent: \`${blueprintConfig.defaultAgent}\`.
- Default capability: \`${blueprintConfig.defaultCapability}\`.
- Which tools may the agent call?
- Which actions require approval before publish, send, spend, or delete?

## Provider Posture

- WorkOS: fake until auth ownership and domains are approved.
- PostHog: fake/test until event capture is approved.
- Dodo: fake/test until pricing and reconciliation are approved.
- MailerSend: console/fake until sender domain and templates are approved.
- LLM: deterministic fake until spend caps, model allowlist, and redaction are
  approved.

## Handoff Risks

- Client data not yet reviewed.
- Provider secrets not yet configured.
- RAG remains optional; source-backed context and Trust Receipts are the default.
- Client-specific business logic belongs in generated modules or private
  packages until contract review.
`;

  const files: readonly GeneratedFile[] = [
    {
      path: "template-instance.json",
      content: `${JSON.stringify(instance, null, 2)}\n`,
    },
    {
      path: briefPath,
      content: markdown,
    },
  ];

  return {
    instance,
    files: withGeneratorProvenance("intake", instance.slug, files),
  };
};

export const buildClientDomainFiles = (
  options: ClientDomainGeneratorOptions,
): ClientDomainGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const description =
    options.description ??
    `Client-specific ${name} domain scaffold. Keep business logic outside template core until reviewed.`;
  const basePath = `generated/domains/${name}`;
  const metadata = {
    domain: name,
    system: options.system,
    disposition: options.disposition,
    description,
    extensionBoundary: "generated-or-private-package",
    sourceTypes: ["markdown", "link", "note"],
    surfaces: ["web", "api", "cli", "mcp"],
    requiredFollowUp: [
      "Map client nouns to source ownership and retention.",
      "Identify first capability, workflow, and agent grants.",
      "Decide fake, test, or live-ready provider posture.",
      "Promote reviewed contracts through Confect/Effect generators.",
    ],
  };
  const files: readonly GeneratedFile[] = [
    {
      path: `${basePath}/${name}.domain.json`,
      content: `${JSON.stringify(metadata, null, 2)}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalName} Domain

${description}

Canonical system: \`${options.system}\` (\`${options.disposition}\`).

## Purpose

Use this generated domain as the client-specific boundary for nouns, source
types, capabilities, workflows, agents, and provider posture. Keep reusable
mechanics in template core and client-specific decisions here or in a private
package until reviewed.

## Follow-Up

1. Map client nouns to source ownership and retention.
2. Identify first capability, workflow, and agent grants.
3. Decide fake, test, or live-ready provider posture.
4. Promote reviewed contracts through Confect/Effect generators.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    files: withGeneratorProvenance("add-client-domain", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
  };
};

export const buildCapabilityFiles = (
  options: CapabilityGeneratorOptions,
): CapabilityGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const exposure = options.exposure ?? "headless";
  const description =
    options.description ??
    `Generated ${name} capability. Replace the domain logic while preserving the contract shape.`;
  const basePath = `packages/convex/confect/capabilities/${name}`;
  const typedErrors = ["Unauthorized", "ValidationFailed", "Forbidden"];
  const files: readonly GeneratedFile[] = [
    {
      path: `${basePath}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Forbidden, Unauthorized, ValidationFailed } from "../errors";

export const ${name}Args = Schema.Struct({
  workspaceSlug: Schema.String,
  input: Schema.String,
});

export const ${name}Returns = Schema.Struct({
  status: Schema.Literal("accepted"),
  summary: Schema.String,
});

export const ${name} = FunctionSpec.publicMutation({
  name: "${name}",
  args: () => ${name}Args,
  returns: () => ${name}Returns,
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export default GroupSpec.make().addFunction(${name});
`,
    },
    {
      path: `${basePath}.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import ${name}Group from "./${name}.spec";

const ${name}Impl = FunctionImpl.make(databaseSchema, ${name}Group, "${name}", () =>
  Effect.succeed({
    status: "accepted" as const,
    summary: "${description}",
  }),
);

export default GroupImpl.make(databaseSchema, ${name}Group).pipe(
  Layer.provide(${name}Impl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `${basePath}.domain.ts`,
      content: `// Pure domain seam for ${name}. Specialize these starter fields with
// reviewed capability input, keep normalize/validate pure, and keep provider
// calls out of this file (they belong in the impl behind services).
export type ${pascalName}Input = {
  readonly workspaceSlug: string;
  readonly input: string;
};

export const normalize${pascalName}Input = (
  input: ${pascalName}Input,
): ${pascalName}Input => ({
  workspaceSlug: input.workspaceSlug.trim(),
  input: input.input.trim(),
});

export const validate${pascalName}Input = (
  input: ${pascalName}Input,
): readonly string[] => {
  const errors: string[] = [];

  if (input.workspaceSlug.length === 0) {
    errors.push("workspaceSlug must not be blank.");
  }

  if (input.input.length === 0) {
    errors.push("input must not be blank.");
  }

  return errors;
};
`,
    },
    {
      path: `${basePath}.test.ts`,
      content: `import fc from "fast-check";
import { describe, expect, it } from "vitest";
import metadata from "./${name}.headless.json";
import {
  normalize${pascalName}Input,
  validate${pascalName}Input,
} from "./${name}.domain";

describe("${name} generated capability domain", () => {
  it("normalization is idempotent for any input", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (workspaceSlug, input) => {
        const once = normalize${pascalName}Input({ workspaceSlug, input });
        expect(normalize${pascalName}Input(once)).toEqual(once);
      }),
    );
  });

  it("rejects blank fields after normalization", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\\s*$/), (blank) => {
        const normalized = normalize${pascalName}Input({
          workspaceSlug: blank,
          input: blank,
        });
        expect(validate${pascalName}Input(normalized)).toHaveLength(2);
      }),
    );
  });

  it("accepts trimmed non-blank input", () => {
    const normalized = normalize${pascalName}Input({
      workspaceSlug: "  acme-demo  ",
      input: "  summarize the approved sources  ",
    });

    expect(normalized.workspaceSlug).toBe("acme-demo");
    expect(validate${pascalName}Input(normalized)).toEqual([]);
  });

  it("declares the required typed errors", () => {
    expect(metadata.typedErrors).toEqual(
      expect.arrayContaining(["Unauthorized", "ValidationFailed", "Forbidden"]),
    );
    expect(metadata.schemas).toEqual({
      args: "${name}Args",
      returns: "${name}Returns",
    });
  });
});
`,
    },
    {
      path: `${basePath}.headless.json`,
      content: `${JSON.stringify(
        {
          capability: name,
          system: options.system,
          disposition: options.disposition,
          description,
          exposure,
          authScope: "workspace member",
          typedErrors,
          schemas: {
            args: `${name}Args`,
            returns: `${name}Returns`,
          },
          surfaces:
            exposure === "headless" ? ["api", "cli", "mcp"] : [exposure],
          requiredFiles: [
            "Confect spec/impl",
            "tests",
            "headless registry entry",
            "docs",
          ],
          migrationNotes: [
            "Run Confect codegen before wiring generated refs.",
            "Add migration notes when the capability writes durable tables.",
          ],
          frontendAdapter: "required when exposure is web",
        },
        null,
        2,
      )}
`,
    },
    {
      path: `docs/template/generated/capabilities/${name}.md`,
      content: `# ${pascalName} Capability

${description}

## Contract

- Canonical system: \`${options.system}\` (\`${options.disposition}\`)
- Args: \`${name}Args\`
- Returns: \`${name}Returns\`
- Typed errors: ${typedErrors.join(", ")}
- Exposure: ${exposure}

## Required Follow-Up

1. Review the flat files in \`packages/convex/confect/capabilities/\`.
2. Run \`pnpm confect:codegen\`.
3. Add generated refs to the web/API/CLI/MCP surfaces selected in \`${name}.headless.json\`.
4. Specialize the starter implementation with domain logic behind capability checks.
5. Run \`pnpm check:confect-contracts\` and focused capability tests.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    exposure,
    files: withGeneratorProvenance("add-capability", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
  };
};

export const buildFeatureFiles = (
  options: FeatureGeneratorOptions,
): FeatureGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const route = kebabCase(options.name);
  const description =
    options.description ??
    `Generated ${name} vertical slice. Replace fake fixtures through the typed Confect adapter.`;
  const featurePath = `apps/web/src/features/${name}`;
  const capability = buildCapabilityFiles({
    name,
    system: options.system,
    disposition: options.disposition,
    description,
    exposure: "web",
  });
  const capabilityFiles = capability.files.filter(
    ({ path }) =>
      path !== `docs/template/generated/provenance/add-capability/${name}.json`,
  );
  const files: readonly GeneratedFile[] = [
    ...capabilityFiles,
    {
      path: `${featurePath}/contract.ts`,
      content: `export const ${name}FeatureContract = {
  ownership: {
    system: "${options.system}",
    disposition: "${options.disposition}",
  },
  capability: "${name}",
  tenantScope: "workspace",
  auth: "workspace-member",
  typedErrors: ["Unauthorized", "ValidationFailed", "Forbidden"],
  audit: {
    readEvent: "${name}.viewed",
    writeEvent: "${name}.changed",
    actorAndWorkspaceRequired: true,
  },
  observability: {
    operation: "${options.system}.${name}",
    redactInput: true,
    captureLatency: true,
  },
  featureFlag: {
    key: "${options.system}.${route}",
    default: "off-until-reviewed",
    killSwitch: true,
  },
  entitlement: {
    posture: "explicit-plan-or-none",
    default: "not-entitled",
  },
  dataLifecycle: {
    durableResources: [] as const,
    instruction: "Use template:add-table before adding durable state.",
  },
} as const;
`,
    },
    {
      path: `${featurePath}/model.ts`,
      content: `export type ${pascalName}Item = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
};

export type ${pascalName}FeatureState =
  | { readonly status: "loading" }
  | { readonly status: "empty" }
  | { readonly status: "ready"; readonly items: readonly ${pascalName}Item[] }
  | { readonly status: "edit"; readonly draft: ${pascalName}Item }
  | { readonly status: "skipped"; readonly reason: string }
  | {
      readonly status: "typed-error";
      readonly error: "Unauthorized" | "ValidationFailed" | "Forbidden";
    }
  | { readonly status: "transport-error"; readonly message: string }
  | { readonly status: "success"; readonly item: ${pascalName}Item };

export type ${pascalName}ViewModel = {
  readonly title: string;
  readonly status: ${pascalName}FeatureState["status"];
  readonly notice: string;
  readonly items: readonly ${pascalName}Item[];
  readonly canEdit: boolean;
};

export const present${pascalName} = (
  state: ${pascalName}FeatureState,
): ${pascalName}ViewModel => {
  const base = {
    title: ${JSON.stringify(description)},
    status: state.status,
    items: [] as readonly ${pascalName}Item[],
    canEdit: false,
  };

  switch (state.status) {
    case "loading":
      return { ...base, notice: "Loading…" };
    case "empty":
      return { ...base, notice: "Nothing here yet.", canEdit: true };
    case "ready":
      return { ...base, notice: "Ready", items: state.items, canEdit: true };
    case "edit":
      return { ...base, notice: "Editing", items: [state.draft], canEdit: true };
    case "skipped":
      return { ...base, notice: state.reason };
    case "typed-error":
      return { ...base, notice: \`Request failed: \${state.error}\` };
    case "transport-error":
      return { ...base, notice: \`Connection failed: \${state.message}\` };
    case "success":
      return { ...base, notice: "Saved", items: [state.item], canEdit: true };
  }
};
`,
    },
    {
      path: `${featurePath}/fixtures.ts`,
      content: `import type { ${pascalName}FeatureState, ${pascalName}Item } from "./model";

export const fake${pascalName}Items: readonly ${pascalName}Item[] = [
  {
    id: "${name}-demo-1",
    label: "Example account",
    detail: "Synthetic fixture for customer.example; never use customer data here.",
  },
];

export const fake${pascalName}States = {
  loading: { status: "loading" },
  empty: { status: "empty" },
  ready: { status: "ready", items: fake${pascalName}Items },
  edit: { status: "edit", draft: fake${pascalName}Items[0]! },
  skipped: { status: "skipped", reason: "Feature flag is disabled." },
  typedError: { status: "typed-error", error: "Forbidden" },
  transportError: { status: "transport-error", message: "Demo transport unavailable." },
  success: { status: "success", item: fake${pascalName}Items[0]! },
} as const satisfies Record<string, ${pascalName}FeatureState>;
`,
    },
    {
      path: `${featurePath}/${route}-feature.tsx`,
      content: `import { Button, Card, Heading, Stack, Text } from "@saas-ui/react";
import { fake${pascalName}States } from "./fixtures";
import { present${pascalName}, type ${pascalName}FeatureState } from "./model";

export function ${pascalName}Feature({
  state = fake${pascalName}States.ready,
}: {
  readonly state?: ${pascalName}FeatureState;
}) {
  const view = present${pascalName}(state);

  return (
    <Card.Root aria-label="${description}">
      <Card.Header>
        <Heading size="md">{view.title}</Heading>
        <Text>{view.notice}</Text>
      </Card.Header>
      <Card.Body>
        <Stack gap="3">
          {view.items.map((item) => (
            <Card.Root key={item.id} variant="outline">
              <Card.Body>
                <Heading size="sm">{item.label}</Heading>
                <Text>{item.detail}</Text>
              </Card.Body>
            </Card.Root>
          ))}
          {view.canEdit ? <Button alignSelf="start">Edit</Button> : null}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
`,
    },
    {
      path: `${featurePath}/model.test.ts`,
      content: `import { describe, expect, it } from "vitest";
import { fake${pascalName}States } from "./fixtures";
import { present${pascalName} } from "./model";

describe("${name} feature presenter", () => {
  it.each(Object.entries(fake${pascalName}States))(
    "presents the %s state without throwing",
    (_name, state) => {
      const view = present${pascalName}(state);
      expect(view.status).toBe(state.status);
      expect(view.notice.length).toBeGreaterThan(0);
    },
  );

  it("keeps fixtures synthetic and fake-safe", () => {
    expect(JSON.stringify(fake${pascalName}States)).toContain("customer.example");
  });
});
`,
    },
    {
      path: `apps/web/src/screens/${route}-screen.tsx`,
      content: `import { Page } from "@saas-ui/react";
import { ${pascalName}Feature } from "../features/${name}/${route}-feature";

export function ${pascalName}Screen() {
  return (
    <Page.Root>
      <Page.Header title="${pascalName}" description={${JSON.stringify(description)}} />
      <Page.Body>
        <${pascalName}Feature />
      </Page.Body>
    </Page.Root>
  );
}
`,
    },
    {
      path: `apps/web/src/routes/_workspace.${route}.tsx`,
      content: `import { createFileRoute } from "@tanstack/react-router";
import { ${pascalName}Screen } from "../screens/${route}-screen";

export const Route = createFileRoute("/_workspace/${route}")({
  component: ${pascalName}Screen,
});
`,
    },
    {
      path: `docs/template/generated/features/${name}.md`,
      content: `# ${pascalName} Feature

${description}

- Owner: \`${options.system}\` (\`${options.disposition}\`)
- Capability: \`${name}\`
- Route: \`/_workspace/${route}\`
- Auth and tenancy: authenticated workspace member
- Rollout: flag off and not entitled until reviewed
- Data lifecycle: no durable data; use \`template:add-table\` before adding any
- Audit: read/write event names are declared in the feature contract
- Observability: operation name, redaction, and latency posture are declared

Run the model and capability tests, Confect codegen, route generation, and the
topology/promotion/data-resource gates before opening the production PR.
`,
    },
  ];

  return {
    name,
    pascalName,
    route,
    system: options.system,
    disposition: options.disposition,
    files: withGeneratorProvenance("add-feature", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    followUp: [
      "Specialize the generated capability contract and keep typed failures reachable.",
      "Replace fake fixtures through a thin Confect React adapter.",
      "Register navigation only after flag, entitlement, auth, and audit review.",
      "Run pnpm confect:codegen, pnpm build, focused tests, and just verify.",
    ],
  };
};

const tenantOwnerField = (
  tenantScope: DataTenantScope,
): {
  readonly field: string;
  readonly table: string;
  readonly index: string;
} => {
  if (tenantScope === "workspace") {
    return { field: "workspaceId", table: "workspaces", index: "by_workspace" };
  }
  if (tenantScope === "organization") {
    return {
      field: "organizationId",
      table: "organizations",
      index: "by_organization",
    };
  }
  if (tenantScope === "user") {
    return { field: "userId", table: "users", index: "by_user" };
  }
  return { field: "key", table: "", index: "by_key" };
};

export const buildTableFiles = (
  options: TableGeneratorOptions,
  catalogs?: {
    readonly systems?: SystemCatalog;
    readonly dataResources?: DataResourceCatalog;
  },
): TableGeneratorResult => {
  if (options.disposition !== "extend") {
    throw new RangeError("New durable tables must use --disposition extend");
  }

  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const systems = catalogs?.systems ?? readSystemCatalog();
  const dataResources = catalogs?.dataResources ?? readDataResourceCatalog();
  const system = canonicalSystemById(systems, options.system);
  if (system.lifecycle !== "active") {
    throw new RangeError(
      `Canonical system ${system.id} is ${system.lifecycle} and cannot receive a durable table`,
    );
  }
  if (
    systems.systems.some(({ tables }) => tables.includes(name)) ||
    dataResources.resources.some(({ id }) => id === name)
  ) {
    throw new RangeError(`Durable table ${name} is already registered`);
  }

  const owner = tenantOwnerField(options.tenantScope);
  const writeAuthority = system.canonicalEntrypoints[0];
  if (writeAuthority === undefined) {
    throw new RangeError(
      `Canonical system ${system.id} has no write authority entrypoint`,
    );
  }
  const ownerField =
    options.tenantScope === "global"
      ? "    key: Schema.String,"
      : `    ${owner.field}: Id("${owner.table}"),`;
  const idImport =
    options.tenantScope === "global"
      ? ""
      : 'import { Id } from "../_generated/id";\n';
  const description =
    options.description ??
    `Durable ${name} state owned by the ${system.id} canonical system.`;
  const decisionPath = `docs/template/schema-decisions/${name}.md`;
  const tablePath = `packages/convex/confect/tables/${name}.ts`;
  const nextSystems: SystemCatalog = {
    ...systems,
    systems: systems.systems.map((candidate) =>
      candidate.id === system.id
        ? {
            ...candidate,
            tables: [...candidate.tables, name].sort(),
          }
        : candidate,
    ),
  };
  const nextDataResources = parseDataResourceCatalog({
    ...dataResources,
    resources: [
      ...dataResources.resources,
      {
        id: name,
        system: system.id,
        sourcePath: tablePath,
        tenantScope: options.tenantScope,
        sensitivity: options.sensitivity,
        pii: [...options.pii],
        exportMode: options.exportMode,
        deleteMode: options.deleteMode,
        retention: options.retention,
        appendOnly: options.appendOnly ?? false,
        workspaceLifecycle:
          options.tenantScope === "workspace" ? "managed" : "excluded",
        writeAuthority,
        migrationRef: decisionPath,
        detail: description,
      },
    ].sort((left, right) => left.id.localeCompare(right.id)),
  });
  const files: readonly GeneratedFile[] = [
    {
      path: tablePath,
      content: `import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
${idImport}
// ${description}
export default Table.make(() =>
  Schema.Struct({
${ownerField}
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
).index("${owner.index}", ["${owner.field}"]);
`,
    },
    {
      path: decisionPath,
      content: `# ${pascalName} Schema Decision

Canonical system: \`${system.id}\`
Disposition: \`extend\`
Status: proposed

## Purpose

${description}

## Data Contract

- Tenant scope: \`${options.tenantScope}\`
- Sensitivity: \`${options.sensitivity}\`
- PII categories: ${options.pii.length === 0 ? "none" : options.pii.map((value) => `\`${value}\``).join(", ")}
- Export: \`${options.exportMode}\`
- Delete/redaction: \`${options.deleteMode}\`
- Retention: \`${options.retention}\`
- Append-only: \`${String(options.appendOnly ?? false)}\`
- Write authority: \`${writeAuthority}\`

## Migration And Rollback

Document indexes, backfill, compatibility window, rollback behavior, and the
query that proves the table is necessary before approving this decision.
`,
    },
    {
      path: "docs/template/system-catalog.json",
      content: `${JSON.stringify(nextSystems, null, 2)}\n`,
    },
    {
      path: "docs/template/data-resources.json",
      content: `${JSON.stringify(nextDataResources, null, 2)}\n`,
    },
  ];

  return {
    name,
    pascalName,
    system: system.id,
    disposition: "extend",
    files: withGeneratorProvenance("add-table", name, files, {
      system: system.id,
      disposition: "extend",
    }),
  };
};

export const buildAgentFiles = (
  options: AgentGeneratorOptions,
): AgentGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const description =
    options.description ??
    `Generated ${name} agent seat. Keep the default web surface deterministic until tool grants are reviewed.`;
  const manifestName = `${name}AgentManifest`;
  const messageName = `${pascalName}AgentMessage`;
  const startArgsName = `${pascalName}StartThreadArgs`;
  const continueArgsName = `${pascalName}ContinueThreadArgs`;
  const listArgsName = `${pascalName}ListThreadMessagesArgs`;
  const startReturnName = `${pascalName}StartThreadReturn`;
  const continueReturnName = `${pascalName}ContinueThreadReturn`;
  const toolsName = `${name}Tools`;
  const followUp = [
    "Wire the generated web agent seat into the app route or feature module.",
    "Review tool grants before adding model-call or provider-backed behavior.",
    "Run Confect codegen before importing generated refs from runtime surfaces.",
  ] as const;
  const files: readonly GeneratedFile[] = [
    {
      path: `packages/convex/confect/agents/${name}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

export const ${manifestName} = {
  agent: "${name}",
  system: "${options.system}",
  systemDisposition: "${options.disposition}",
  displayName: "${pascalName}",
  description: ${JSON.stringify(description)},
  surfaces: ["web"],
  agentSeat: "web-facing",
  headlessExposure: false,
  toolGrantPolicy: "none-by-default",
} as const;

export const ${startArgsName} = S.Struct({
  workspaceId: S.String.pipe(S.minLength(1)),
  userId: S.String.pipe(S.minLength(1)),
  firstMessage: S.String.pipe(S.minLength(1)),
});

export const ${continueArgsName} = S.Struct({
  workspaceId: S.String.pipe(S.minLength(1)),
  userId: S.String.pipe(S.minLength(1)),
  threadId: S.String.pipe(S.minLength(1)),
  message: S.String.pipe(S.minLength(1)),
  idempotencyKey: S.String.pipe(S.minLength(1)),
});

export const ${listArgsName} = S.Struct({
  workspaceId: S.String.pipe(S.minLength(1)),
  userId: S.String.pipe(S.minLength(1)),
  threadId: S.String.pipe(S.minLength(1)),
});

export const ${messageName} = S.Struct({
  id: S.String,
  role: S.Literal("user", "assistant", "tool"),
  content: S.String,
  createdAt: S.Number,
});

export const ${startReturnName} = S.Struct({
  threadId: S.String,
  agent: S.Literal("${name}"),
  surface: S.Literal("web"),
  messages: S.Array(${messageName}),
});

export const ${continueReturnName} = S.Struct({
  threadId: S.String,
  agent: S.Literal("${name}"),
  surface: S.Literal("web"),
  messages: S.Array(${messageName}),
  toolCallCount: S.Number,
});

export namespace ${pascalName}AgentError {
  export class NoWorkspaceAccess extends S.TaggedError<NoWorkspaceAccess>()(
    "NoWorkspaceAccess",
    {
      workspaceId: S.String,
      userId: S.String,
    },
  ) {}

  export class ValidationFailed extends S.TaggedError<ValidationFailed>()(
    "ValidationFailed",
    {
      field: S.String,
      message: S.String,
    },
  ) {}

  export const Schema = S.Union(NoWorkspaceAccess, ValidationFailed);
}

const startThread = FunctionSpec.publicMutation({
  name: "startThread",
  args: () => ${startArgsName},
  returns: () => ${startReturnName},
  error: () => ${pascalName}AgentError.Schema,
});

const continueThread = FunctionSpec.publicMutation({
  name: "continueThread",
  args: () => ${continueArgsName},
  returns: () => ${continueReturnName},
  error: () => ${pascalName}AgentError.Schema,
});

const listThreadMessages = FunctionSpec.publicQuery({
  name: "listThreadMessages",
  args: () => ${listArgsName},
  returns: () => S.Array(${messageName}),
  error: () => ${pascalName}AgentError.Schema,
});

export default GroupSpec.make()
  .addFunction(startThread)
  .addFunction(continueThread)
  .addFunction(listThreadMessages);
`,
    },
    {
      path: `packages/convex/confect/agents/${name}.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import ${name}Agent, {
  ${pascalName}AgentError,
  ${manifestName},
} from "./${name}.spec";
import { ${toolsName} } from "./${name}.tools";

const fakeMemberships = [
  {
    workspaceId: "workspace_123",
    userId: "user_123",
    status: "active",
  },
] as const;

const hasWorkspaceAccess = (input: {
  readonly workspaceId: string;
  readonly userId: string;
}): boolean =>
  fakeMemberships.some(
    (membership) =>
      membership.workspaceId === input.workspaceId &&
      membership.userId === input.userId &&
      membership.status === "active",
  );

const requireWorkspaceAccess = (input: {
  readonly workspaceId: string;
  readonly userId: string;
}) =>
  hasWorkspaceAccess(input)
    ? undefined
    : new ${pascalName}AgentError.NoWorkspaceAccess(input);

const startThread = FunctionImpl.make(
  databaseSchema,
  ${name}Agent,
  "startThread",
  ({ workspaceId, userId, firstMessage }) => {
    const accessError = requireWorkspaceAccess({ workspaceId, userId });

    if (accessError) {
      return Effect.fail(accessError);
    }

    return Effect.succeed({
      threadId: \`thread_\${workspaceId}_\${userId}_${name}\`,
      agent: ${manifestName}.agent,
      surface: "web" as const,
      messages: [
        {
          id: "msg_user_001",
          role: "user" as const,
          content: firstMessage,
          createdAt: 1,
        },
        {
          id: "msg_agent_001",
          role: "assistant" as const,
          content:
            "${pascalName} is ready in fake mode. Review web UX and tool grants before adding provider calls.",
          createdAt: 2,
        },
      ],
    });
  },
);

const continueThread = FunctionImpl.make(
  databaseSchema,
  ${name}Agent,
  "continueThread",
  ({ workspaceId, userId, threadId, message }) => {
    const accessError = requireWorkspaceAccess({ workspaceId, userId });

    if (accessError) {
      return Effect.fail(accessError);
    }

    return Effect.succeed({
      threadId,
      agent: ${manifestName}.agent,
      surface: "web" as const,
      messages: [
        {
          id: "msg_user_continue",
          role: "user" as const,
          content: message,
          createdAt: 3,
        },
        {
          id: "msg_agent_continue",
          role: "assistant" as const,
          content:
            "Deterministic scaffold response. No model provider or external tool was called.",
          createdAt: 4,
        },
      ],
      toolCallCount: ${toolsName}.length,
    });
  },
);

const listThreadMessages = FunctionImpl.make(
  databaseSchema,
  ${name}Agent,
  "listThreadMessages",
  ({ workspaceId, userId, threadId }) => {
    const accessError = requireWorkspaceAccess({ workspaceId, userId });

    if (accessError) {
      return Effect.fail(accessError);
    }

    return Effect.succeed([
      {
        id: \`\${threadId}_summary\`,
        role: "assistant" as const,
        content:
          "This generated web-facing agent seat uses fake-safe local behavior by default.",
        createdAt: 1,
      },
    ]);
  },
);

export default GroupImpl.make(databaseSchema, ${name}Agent).pipe(
  Layer.provide(startThread),
  Layer.provide(continueThread),
  Layer.provide(listThreadMessages),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `packages/convex/confect/agents/${name}.tools.ts`,
      content: `export type ${pascalName}Tool = {
  readonly name: string;
  readonly grantId: string;
  readonly description: string;
};

export const ${toolsName}: readonly ${pascalName}Tool[] = [];

export const list${pascalName}ToolNames = (): readonly string[] =>
  ${toolsName}.map((tool) => tool.name);
`,
    },
    {
      path: `packages/convex/test/${name}.agent.test.ts`,
      content: `import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import ${name}AgentImpl from "../confect/agents/${name}.impl";
import ${name}Agent, {
  ${messageName},
  ${continueArgsName},
  ${manifestName},
  ${startArgsName},
} from "../confect/agents/${name}.spec";
import { ${toolsName}, list${pascalName}ToolNames } from "../confect/agents/${name}.tools";

describe("${name} generated agent seat", () => {
  it("declares web-only agent metadata", () => {
    expect(${manifestName}).toMatchObject({
      agent: "${name}",
      surfaces: ["web"],
      agentSeat: "web-facing",
      headlessExposure: false,
      toolGrantPolicy: "none-by-default",
    });
  });

  it("declares thread contracts and validates message shapes", () => {
    expect(JSON.stringify(${name}Agent)).toContain("startThread");
    expect(JSON.stringify(${name}Agent)).toContain("continueThread");
    expect(JSON.stringify(${name}Agent)).toContain("listThreadMessages");
    expect(
      Schema.decodeUnknownSync(${startArgsName})({
        workspaceId: "workspace_123",
        userId: "user_123",
        firstMessage: "Start the web-facing agent seat.",
      }),
    ).toMatchObject({ workspaceId: "workspace_123" });
    expect(
      Schema.decodeUnknownSync(${continueArgsName})({
        workspaceId: "workspace_123",
        userId: "user_123",
        threadId: "thread_123",
        message: "Continue.",
        idempotencyKey: "turn-001",
      }),
    ).toMatchObject({ threadId: "thread_123" });
    expect(
      Schema.decodeUnknownSync(${messageName})({
        id: "msg_1",
        role: "assistant",
        content: "Done.",
        createdAt: 1,
      }),
    ).toMatchObject({ role: "assistant" });
  });

  it("starts with no provider-backed tools", () => {
    expect(${toolsName}).toEqual([]);
    expect(list${pascalName}ToolNames()).toEqual([]);
  });

  it("exports a finalized Confect implementation", () => {
    expect(${name}AgentImpl).toMatchObject({
      _op_layer: "Fold",
    });
  });
});
`,
    },
    {
      path: `docs/template/generated/agents/${name}.md`,
      content: `# ${pascalName} Agent Seat

${description}

## Generated Contract

- Canonical system: \`${options.system}\` (\`${options.disposition}\`)
- Agent: \`${name}\`
- Surfaces: \`["web"]\`
- Agent seat: web-facing
- Headless exposure: none. This generator does not create API, CLI, MCP, \`.headless.json\`, or headless registry entries.
- Tool grants: none by default.

## Files

- \`packages/convex/confect/agents/${name}.spec.ts\`
- \`packages/convex/confect/agents/${name}.impl.ts\`
- \`packages/convex/confect/agents/${name}.tools.ts\`
- \`packages/convex/test/${name}.agent.test.ts\`

## Required Follow-Up

1. Wire the generated web agent seat into the app route or feature module.
2. Review tool grants before adding model-call or provider-backed behavior.
3. Run \`pnpm confect:codegen\` before importing generated refs from runtime surfaces.
4. Keep API, CLI, and MCP exposure out until a separate headless contract review approves it.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    surfaces: ["web"],
    headlessExposure: false,
    files: withGeneratorProvenance("add-agent", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    followUp,
  };
};

export const buildWorkflowFiles = (
  options: WorkflowGeneratorOptions,
): WorkflowGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const description =
    options.description ??
    `Generated ${name} workflow. Replace the source-to-receipt graph after review.`;
  const files: readonly GeneratedFile[] = [
    {
      path: `packages/convex/confect/workflowContracts/${name}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "../capabilities/_kit/capability";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { Id } from "../_generated/id";
import { ProductWorkflowEventId } from "../workflows/_kit/events";
import { DurableWorkflowPrincipal } from "../workflows/_kit/principal";
import { WorkflowCurrentAuthorityReceipt } from "../workflows/_kit/principalAuthorization";
import { WorkflowStatusResult } from "../workflows/_kit/status";
import {
  WorkflowLifecycleRunProjection,
  WorkflowLifecycleStepProjection,
} from "../workflows/lifecycle.spec";

const WorkflowErrors = Schema.Union(
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
);

const StartArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  idempotencyKey: Schema.String,
});

const StartReturns = Schema.Struct({
  status: Schema.Literal("queued"),
  workflow: Schema.Literal("${name}"),
  workflowRunId: Id("workflowRuns"),
  componentWorkflowId: Schema.String,
});

const StatusArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  componentWorkflowId: Schema.String,
});

const LifecycleControlArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  reasonCode: Schema.Literal(
    "operator-request",
    "recovery",
    "policy-change",
    "retention-sweep",
  ),
  occurredAt: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});
const Pagination = {
  cursor: Schema.NullOr(Schema.String),
  limit: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
    Schema.lessThanOrEqualTo(100),
  ),
} as const;
const LifecycleRunPage = Schema.Struct({
  page: Schema.Array(WorkflowLifecycleRunProjection),
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
});
const LifecycleStepPage = Schema.Struct({
  page: Schema.Array(WorkflowLifecycleStepProjection),
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
});

const SendEventArgs = Schema.Struct({
  selector: Schema.Union(
    Schema.Struct({
      kind: Schema.Literal("id"),
      eventId: ProductWorkflowEventId,
    }),
    Schema.Struct({
      kind: Schema.Literal("definition"),
      componentWorkflowId: Schema.NonEmptyString,
      event: Schema.Literal("approvalDecision"),
      eventInstanceKey: Schema.NonEmptyString,
    }),
  ),
  delivery: Schema.Union(
    Schema.Struct({
      kind: Schema.Literal("value"),
      value: Schema.Struct({ approved: Schema.Boolean }),
    }),
    Schema.Struct({
      kind: Schema.Literal("error"),
      error: Schema.NonEmptyString,
    }),
  ),
});

const SendEventReturns = Schema.Struct({
  eventId: ProductWorkflowEventId,
  status: Schema.Literal("sent"),
});

export const authorizeConsequential = FunctionSpec.internalQuery({
  name: "authorizeConsequential",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      principal: DurableWorkflowPrincipal,
      requiredGrants: Schema.Array(Schema.NonEmptyString),
      capability: Schema.NonEmptyString,
      workflowId: Schema.NonEmptyString,
      workflowVersion: Schema.Number.pipe(
        Schema.int(),
        Schema.greaterThanOrEqualTo(1),
      ),
    }),
  returns: () => WorkflowCurrentAuthorityReceipt,
  error: () => MemberNotInWorkspace,
});

export const startInteractive = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "startInteractive",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.${name}",
    name: "startInteractive",
    operationId: "workflows.${name}.startInteractive",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.${name}.startInteractive.args",
    returnsSchemaName: "workflows.${name}.startInteractive.returns",
    argsSchema: StartArgs,
    returnsSchema: StartReturns,
  },
);

export const startQueued = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "startQueued",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.${name}",
    name: "startQueued",
    operationId: "workflows.${name}.startQueued",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.${name}.startQueued.args",
    returnsSchemaName: "workflows.${name}.startQueued.returns",
    argsSchema: StartArgs,
    returnsSchema: StartReturns,
  },
);

export const status = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "status",
    args: () => StatusArgs,
    returns: () => WorkflowStatusResult,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.${name}",
    name: "status",
    operationId: "workflows.${name}.status",
    kind: "query",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: true,
    argsSchemaName: "workflows.${name}.status.args",
    returnsSchemaName: "workflows.${name}.status.returns",
    argsSchema: StatusArgs,
    returnsSchema: WorkflowStatusResult,
  },
);

const lifecycleContract = <Spec>(
  spec: Spec,
  name: string,
  kind: "query" | "mutation",
  argsSchema: Schema.Schema.Any,
  returnsSchema: Schema.Schema.Any,
  idempotent: boolean,
) =>
  defineContractFunction(spec, {
    namespace: "workflows.${name}",
    name,
    operationId: "workflows.${name}." + name,
    kind,
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent,
    argsSchemaName: "workflows.${name}." + name + ".args",
    returnsSchemaName: "workflows.${name}." + name + ".returns",
    argsSchema,
    returnsSchema,
  });

const CancelReturns = Schema.Struct({
  status: Schema.Literal("canceled"),
  actionMayFinish: Schema.Literal(true),
});
export const cancel = lifecycleContract(
  FunctionSpec.publicMutation({
    name: "cancel",
    args: () => LifecycleControlArgs,
    returns: () => CancelReturns,
    error: () => WorkflowErrors,
  }),
  "cancel",
  "mutation",
  LifecycleControlArgs,
  CancelReturns,
  false,
);

const RestartArgs = Schema.Struct({
  ...LifecycleControlArgs.fields,
  restartAnchor: Schema.NonEmptyString,
});
const RestartReturns = Schema.Struct({
  generation: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  discardedSteps: Schema.Array(Schema.NonEmptyString),
});
export const restart = lifecycleContract(
  FunctionSpec.publicMutation({
    name: "restart",
    args: () => RestartArgs,
    returns: () => RestartReturns,
    error: () => WorkflowErrors,
  }),
  "restart",
  "mutation",
  RestartArgs,
  RestartReturns,
  false,
);

const ListArgs = Schema.Struct({ workspaceId: Id("workspaces"), ...Pagination });
export const list = lifecycleContract(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => ListArgs,
    returns: () => LifecycleRunPage,
    error: () => WorkflowErrors,
  }),
  "list",
  "query",
  ListArgs,
  LifecycleRunPage,
  true,
);

const ListByNameArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowName: Schema.NonEmptyString,
  ...Pagination,
});
export const listByName = lifecycleContract(
  FunctionSpec.publicQuery({
    name: "listByName",
    args: () => ListByNameArgs,
    returns: () => LifecycleRunPage,
    error: () => WorkflowErrors,
  }),
  "listByName",
  "query",
  ListByNameArgs,
  LifecycleRunPage,
  true,
);

const ListStepsArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  ...Pagination,
});
export const listSteps = lifecycleContract(
  FunctionSpec.publicQuery({
    name: "listSteps",
    args: () => ListStepsArgs,
    returns: () => LifecycleStepPage,
    error: () => WorkflowErrors,
  }),
  "listSteps",
  "query",
  ListStepsArgs,
  LifecycleStepPage,
  true,
);

const CleanupReturns = Schema.Struct({
  status: Schema.Literal("component-cleanup-requested"),
  fullDeletionProven: Schema.Literal(false),
});
export const cleanup = lifecycleContract(
  FunctionSpec.publicMutation({
    name: "cleanup",
    args: () => LifecycleControlArgs,
    returns: () => CleanupReturns,
    error: () => WorkflowErrors,
  }),
  "cleanup",
  "mutation",
  LifecycleControlArgs,
  CleanupReturns,
  false,
);

export const sendEvent = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "sendEvent",
    args: () => SendEventArgs,
    returns: () => SendEventReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.${name}",
    name: "sendEvent",
    operationId: "workflows.${name}.sendEvent",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.${name}.sendEvent.args",
    returnsSchemaName: "workflows.${name}.sendEvent.returns",
    argsSchema: SendEventArgs,
    returnsSchema: SendEventReturns,
  },
);

const contractFunctions = [
  startInteractive,
  startQueued,
  status,
  cancel,
  restart,
  list,
  listByName,
  listSteps,
  cleanup,
  sendEvent,
] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(authorizeConsequential)
  .addFunction(startInteractive.spec)
  .addFunction(startQueued.spec)
  .addFunction(status.spec)
  .addFunction(cancel.spec)
  .addFunction(restart.spec)
  .addFunction(list.spec)
  .addFunction(listByName.spec)
  .addFunction(listSteps.spec)
  .addFunction(cleanup.spec)
  .addFunction(sendEvent.spec);
`,
    },
    {
      path: `packages/convex/confect/workflowContracts/${name}.impl.ts`,
      content: `import type { GenericId } from "convex/values";
import {
  getStatus,
  type WorkflowComponent,
  type WorkflowId,
} from "@convex-dev/workflow";
import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  componentsGeneric,
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  MutationRunner,
  QueryRunner,
  QueryCtx,
} from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { startWorkflowAndRecordOwnership } from "../workflows/_kit/ownership";
import {
  createWorkflowUserPrincipal,
  type DurableWorkflowPrincipal,
} from "../workflows/_kit/principal";
import {
  resolveWorkflowPolicySnapshotForRun,
  type WorkflowPolicySnapshot,
} from "../workflows/_kit/policySnapshot";
import type {
  WorkflowCompletionResult,
  WorkflowOnCompleteContext,
} from "../workflows/lifecycleReconciliation";
import {
  projectWorkflowStatus,
  type WorkflowStatusRunProjection,
} from "../workflows/_kit/status";
import { ${name}Graph } from "../workflows/${name}/v1.graph";
import { validateWorkflowEventDelivery } from "../workflows/_kit/events";
import { ${name}ApprovalDecisionEvent } from "../workflows/${name}/v1.registry";
import {
  ${name}CurrentGrantPolicy,
} from "../workflows/${name}/v1.registry";
import { requireConsequentialWorkflowAuthority } from "../workflows/_kit/principalAuthorization";
import ${name} from "./${name}.spec";

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const workflowComponent =
  componentsGeneric().workflow as unknown as WorkflowComponent;

type WorkflowRunFunctionArgs = {
  readonly args: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly idempotencyKey: string;
    readonly principal: DurableWorkflowPrincipal;
    readonly policySnapshot: WorkflowPolicySnapshot;
  };
  readonly startAsync?: boolean;
};

const ${name}RunRef = makeFunctionReference<
  "mutation",
  WorkflowRunFunctionArgs,
  WorkflowId
>("workflowRunners/${name}/v1:run") as unknown as FunctionReference<
  "mutation",
  "internal",
  WorkflowRunFunctionArgs,
  WorkflowId
>;

type WorkflowCompletionArgs = {
  readonly workflowId: string;
  readonly context: WorkflowOnCompleteContext;
  readonly result: WorkflowCompletionResult;
};

const ${name}OnCompleteRef = makeFunctionReference<
  "mutation",
  WorkflowCompletionArgs,
  null
>("workflowRunners/${name}/v1:onComplete") as unknown as FunctionReference<
  "mutation",
  "internal",
  WorkflowCompletionArgs,
  null
>;

const errorMessage = (error: unknown): string | null => {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
};

const toWorkflowValidationFailed = (error: unknown): ValidationFailed =>
  new ValidationFailed({
    field: "workflow",
    message: errorMessage(error) ?? "Unable to start workflow.",
  });

type WorkflowError =
  | Unauthorized
  | MemberNotInWorkspace
  | WorkspaceNotFound
  | NotFound
  | ValidationFailed;

const toWorkflowError = (error: unknown): WorkflowError => {
  if (
    error instanceof Unauthorized ||
    error instanceof MemberNotInWorkspace ||
    error instanceof WorkspaceNotFound ||
    error instanceof NotFound ||
    error instanceof ValidationFailed
  ) {
    return error;
  }

  return toWorkflowValidationFailed(error);
};

const findWorkflowRun = (
  workspaceId: GenericId<"workspaces">,
  componentWorkflowId: string,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const run = yield* reader
      .table("workflowRuns")
      .index("by_workspace_component_workflow", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("componentWorkflowId", componentWorkflowId),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);

    if (!run) {
      return yield* Effect.fail(
        new NotFound({
          resource: "workflowRuns",
          id: componentWorkflowId,
        }),
      );
    }

    return run;
  });

const startWithProfile = (
  kickoffProfile: "interactive" | "queued",
  { workspaceId, idempotencyKey }: {
    readonly workspaceId: GenericId<"workspaces">;
    readonly idempotencyKey: string;
  },
) =>
  Effect.gen(function* () {
      const access = yield* withConfectClock(
        requireWorkspaceAccess(workspaceId, "editor"),
      );
      const startedAt = yield* withConfectClock(Clock.currentTimeMillis);
      const principal = createWorkflowUserPrincipal({
        workspaceId,
        actorId: access.userId,
        role: access.role,
        grants: ["workflow:start"],
        authEpoch: access.authEpoch,
        kickoffAt: startedAt,
      });
      const policySnapshot = yield* resolveWorkflowPolicySnapshotForRun(
        ${name}Graph.policyPosture,
        { workspaceId, resolvedAt: startedAt },
      ).pipe(Effect.mapError(toWorkflowValidationFailed));
      const componentWorkflowId = yield* startWorkflowAndRecordOwnership({
        workflowRef: ${name}RunRef,
        onCompleteRef: ${name}OnCompleteRef,
        buildWorkflowArgs: (workflowRunId) => ({
          workspaceId,
          workflowRunId,
          idempotencyKey,
          principal,
          policySnapshot,
        }),
        workspaceId,
        workflowId: ${name}Graph.id,
        workflowVersion: ${name}Graph.version,
        graphJson: JSON.stringify(${name}Graph),
        idempotencyKey,
        startedByUserId: access.userId,
        startedAt: startedAt,
        principalSnapshot: principal,
        policySnapshot,
        workflowKind: "workflow.${name}",
        kickoffProfile:
          kickoffProfile === "interactive" ? "eager-first-poll" : "queued",
      }).pipe(Effect.mapError(toWorkflowValidationFailed));
      const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);

      return {
        status: "queued" as const,
        workflow: "${name}" as const,
        workflowRunId: run._id,
        componentWorkflowId,
      };
  }).pipe(Effect.mapError(toWorkflowError));

const startInteractiveImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "startInteractive",
  (args) => startWithProfile("interactive", args),
);

const authorizeConsequentialImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "authorizeConsequential",
  (args) =>
    Effect.gen(function* () {
      if (args.principal.workspaceId !== args.workspaceId) {
        return yield* new MemberNotInWorkspace({
          membershipId: "workflow-actor",
        });
      }
      const access = yield* requireConsequentialWorkflowAuthority(
        args.principal,
        args.requiredGrants,
        ${name}CurrentGrantPolicy,
      );
      return {
        kind: "workflow-current-authority" as const,
        version: 1 as const,
        workspaceId: access.workspaceId,
        actorId: access.userId,
        authEpoch: access.authEpoch,
        capability: args.capability,
        workflowId: args.workflowId,
        workflowVersion: args.workflowVersion,
        requiredGrants: args.requiredGrants,
      };
    }),
);

const startQueuedImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "startQueued",
  (args) => startWithProfile("queued", args),
);

const statusImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "status",
  ({ workspaceId, componentWorkflowId }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);
      const ctx = yield* QueryCtx;
      const rawStatus = yield* Effect.promise(() =>
        getStatus(ctx, workflowComponent, componentWorkflowId as WorkflowId),
      ).pipe(Effect.mapError(toWorkflowValidationFailed));
      const runProjection = {
        ...(run.status !== undefined ? { status: run.status } : {}),
        ...(run.deadlineAt !== undefined ? { deadlineAt: run.deadlineAt } : {}),
        ...(run.timedOutAt !== undefined ? { timedOutAt: run.timedOutAt } : {}),
        ...(run.timeoutErrorCode !== undefined
          ? { timeoutErrorCode: run.timeoutErrorCode }
          : {}),
        ...(run.timeoutSummary !== undefined
          ? { timeoutSummary: run.timeoutSummary }
          : {}),
        ...(run.lifecycleExecution !== undefined
          ? { lifecycleExecution: run.lifecycleExecution }
          : {}),
        ...(run.lifecycleGeneration !== undefined
          ? { lifecycleGeneration: run.lifecycleGeneration }
          : {}),
        ...(run.priorGenerationQuiescence !== undefined
          ? { priorGenerationQuiescence: run.priorGenerationQuiescence }
          : {}),
        ...(run.cleanupState !== undefined
          ? { cleanupState: run.cleanupState }
          : {}),
        ...(run.componentCleanupState !== undefined
          ? { componentCleanupState: run.componentCleanupState }
          : {}),
        ...(run.componentResidualState !== undefined
          ? { componentResidualState: run.componentResidualState }
          : {}),
      } satisfies WorkflowStatusRunProjection;

      return projectWorkflowStatus(rawStatus, runProjection);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const sendEventImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "sendEvent",
  ({ selector, delivery }) =>
    Effect.gen(function* () {
      const validated = validateWorkflowEventDelivery(
        ${name}ApprovalDecisionEvent,
        delivery,
      );
      const occurredAt = yield* withConfectClock(Clock.currentTimeMillis);
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.eventInstances.send, {
        selector:
          selector.kind === "id"
            ? selector
            : {
                kind: "definition" as const,
                componentWorkflowId: selector.componentWorkflowId,
                eventDefinition: ${name}ApprovalDecisionEvent.reference,
                eventInstanceKey: selector.eventInstanceKey,
              },
        delivery: validated,
        occurredAt,
      });
    }).pipe(Effect.mapError(toWorkflowError)),
);

const cancelImpl = FunctionImpl.make(databaseSchema, ${name}, "cancel", (args) =>
  Effect.gen(function* () {
    const runMutation = yield* MutationRunner;
    return yield* runMutation(refs.internal.workflows.lifecycle.cancel, args);
  }).pipe(Effect.mapError(toWorkflowError)),
);

const restartImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "restart",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.lifecycle.restart, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listImpl = FunctionImpl.make(databaseSchema, ${name}, "list", (args) =>
  Effect.gen(function* () {
    const runQuery = yield* QueryRunner;
    return yield* runQuery(refs.internal.workflows.lifecycle.list, args);
  }).pipe(Effect.mapError(toWorkflowError)),
);

const listByNameImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "listByName",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(refs.internal.workflows.lifecycle.listByName, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listStepsImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "listSteps",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(refs.internal.workflows.lifecycle.listSteps, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const cleanupImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "cleanup",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.lifecycle.cleanup, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

export default GroupImpl.make(databaseSchema, ${name}).pipe(
  Layer.provide(authorizeConsequentialImpl),
  Layer.provide(startInteractiveImpl),
  Layer.provide(startQueuedImpl),
  Layer.provide(statusImpl),
  Layer.provide(cancelImpl),
  Layer.provide(restartImpl),
  Layer.provide(listImpl),
  Layer.provide(listByNameImpl),
  Layer.provide(listStepsImpl),
  Layer.provide(cleanupImpl),
  Layer.provide(sendEventImpl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `packages/convex/confect/workflows/${name}/v1.graph.ts`,
      content: `import * as Either from "effect/Either";
import { defineWorkflowGraphV2 } from "../_kit/workflowBuilder";
import { defineWorkflowReferenceRegistry } from "../_kit/workflowReferences";

export const ${name}References = defineWorkflowReferenceRegistry({
  capabilities: { eventControl: "capability.workflowEventControl.v1" },
  workflows: { self: "workflow.${name}.v2" },
  events: { approvalDecision: "event.approvalDecision.v1" },
});

export const ${name}Graph = Either.getOrThrow(defineWorkflowGraphV2({
  id: "workflow_${name}",
  version: 2,
  startNodeId: "start",
  argsSchemaName: "${name}.v2.args",
  returnSchemaName: "${name}.v2.return",
  principalSchemaName: "workflowPrincipal.v2",
  policyPosture: {
    kind: "none",
    reason: "Generated source-to-receipt workflow has no policy decisions.",
  },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
    { name: "queued", mode: "queued", default: false },
  ],
  nodes: [
    {
      id: "start",
      kind: "source",
      label: "${name} start",
      stepName: "start.v2",
      payloadPolicy: {
        maxInputBytes: 64000,
        maxResultBytes: 64000,
        resultMode: "inline",
      },
      semanticRuleIds: ["WF-NODE-KIND"],
    },
    {
      id: "receipt",
      kind: "output",
      label: "Trust Receipt",
      stepName: "receipt.v2",
      payloadPolicy: {
        maxInputBytes: 64000,
        maxResultBytes: 64000,
        resultMode: "inline",
      },
      semanticRuleIds: ["WF-NODE-KIND"],
    },
  ],
  edges: [
    {
      id: "edge_start_receipt",
      sourceNodeId: "start",
      targetNodeId: "receipt",
    },
  ],
  joins: [],
}));
`,
    },
    {
      path: `packages/convex/confect/workflows/${name}/v1.registry.ts`,
      content: `import refs from "../../_generated/refs";
import * as Ref from "@confect/core/Ref";
import { components } from "../../../convex/_generated/api";
import { v } from "convex/values";
import * as Schema from "effect/Schema";
import {
  buildWorkflowCapabilityArgs,
  defineWorkflowCapabilityRegistry,
} from "../_kit/graphRunnerV2";
import { runWorkflowCapabilityBoundary } from "../_kit/workflowCapabilityBoundary";
import {
  defineWorkflowRoleGrantPolicy,
  requireConsequentialWorkflowAuthority,
} from "../_kit/principalAuthorization";
import {
  defineWorkflowEvent,
  defineWorkflowV2EventRegistry,
} from "../_kit/events";
import { defineWorkflowV2SubworkflowRegistry } from "../_kit/subworkflows";
import { generatedWorkflowSubworkflowPolicy } from "../_kit/workpoolConfig";
import { ${name}References } from "./v1.graph";

/**
 * Generated typed capability registry. Add entries only through generated
 * internal refs. External actions must declare effect strategy, effect class,
 * logical instance-key mapping, dedupe/restart horizons, guard postures,
 * redaction policy, and provider/reconciliation fixture evidence.
 * Query and mutation nodes use an independent Workpool transaction by default.
 * Inline nodes must be authored with a named generated preset.
 * External actions declare only consequential metadata. The generated runner,
 * not an entry or caller, owns the fixed current-authority query ref that reloads
 * membership and applies this workflow's role-to-grants policy before admission.
 */
export const ${name}CapabilityRegistry = defineWorkflowCapabilityRegistry({});

/** Every generated buildArgs mapper delegates here to append pinned authority. */
export const ${name}CapabilityArgs = buildWorkflowCapabilityArgs;

/** Generated capabilities must cross this boundary before Workpool returns. */
export const ${name}CapabilityBoundary = runWorkflowCapabilityBoundary;
export const ${name}ConsequentialAuthority =
  requireConsequentialWorkflowAuthority;

export const ${name}CurrentGrantPolicy = defineWorkflowRoleGrantPolicy({
  viewer: [],
  editor: ["workflow:start"],
  admin: ["workflow:start"],
  owner: ["workflow:start"],
});

export const ${name}ArtifactRefs = {
  put: Ref.getFunctionReference(refs.internal.workflows.artifacts.put),
  getOwned: Ref.getFunctionReference(refs.internal.workflows.artifacts.getOwned),
} as const;

export const ${name}SubworkflowLinkRefs = {
  reserveRef: refs.internal.workflows.subworkflowLinks.reserve,
  reconcileRef: refs.internal.workflows.subworkflowLinks.reconcile,
} as const;

export const ${name}EventInstanceRefs = {
  loadGeneration: components.workflow.journal.load,
  createComponentEvent: components.workflow.event.create,
  allocate: Ref.getFunctionReference(
    refs.internal.workflows.eventInstances.allocate,
  ),
  reconcile: Ref.getFunctionReference(
    refs.internal.workflows.eventInstances.reconcile,
  ),
} as const;

export const ${name}ApprovalDecisionEvent = defineWorkflowEvent({
  reference: ${name}References.events.approvalDecision,
  name: "${kebabCase(name)}-approval-decision.v1",
  schemaName: "workflows.${name}.approvalDecision.v1",
  schema: Schema.Struct({ approved: Schema.Boolean }),
  validator: v.object({ approved: v.boolean() }),
});

/** Generated typed event entries bind component and persisted internal refs. */
export const ${name}EventRegistry = defineWorkflowV2EventRegistry({
  [${name}ApprovalDecisionEvent.reference]: {
    definition: ${name}ApprovalDecisionEvent,
    creatorCapability: ${name}References.capabilities.eventControl,
    refs: ${name}EventInstanceRefs,
  },
});

/**
 * Generated immutable child registry. Every entry declares its exact version,
 * typed Args/Result mapping, transitive children, principal narrowing, and the
 * shared typed workflowRunLinks reserve/reconcile refs above.
 */
export const ${name}SubworkflowRegistry =
  defineWorkflowV2SubworkflowRegistry({});

export const ${name}SubworkflowPolicy = generatedWorkflowSubworkflowPolicy;
`,
    },
    {
      path: `packages/convex/confect/workflows/${name}.predeploy.ts`,
      content: renderGeneratedWorkflowPredeploySource(pascalName),
    },
    {
      path: `packages/convex/confect/workflowRunners/${name}/v1.ts`,
      content: `import { Ref } from "@confect/core";
import {
  defineMaestroWorkflow,
  MaestroWorkflowIdValidator,
  MaestroWorkflowResultValidator,
} from "../../workflows/_kit/defineMaestroWorkflow";
import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";
import refs from "../../_generated/refs";
import { components } from "../../../convex/_generated/api";
import {
  runDurableGraphWorkflowV2,
  type RunDurableGraphStep,
} from "../../workflows/_kit/graphRunner";
import { defineGeneratedCurrentAuthorityRef } from "../../workflows/_kit/graphRunnerV2";
import { loadObservedWorkflowExecutionIdentity } from "../../workflows/_kit/observedStage";
import { reconcileObservedWorkflowCompletion } from "../../workflows/_kit/lifecycleCompletion";
import { WorkflowOnCompleteContextValidator } from "../../workflows/_kit/lifecycleState";
import { DurableWorkflowPrincipalValidator } from "../../workflows/_kit/principal";
import { WorkflowPolicySnapshotValidator } from "../../workflows/_kit/policySnapshot";
import type { RunDurableGraphV2CompilerInput } from "../../workflows/_kit/graphRunnerV2";
import { ${name}Graph } from "../../workflows/${name}/v1.graph";
import {
  ${name}EventRegistry,
  ${name}SubworkflowPolicy,
  ${name}SubworkflowRegistry,
} from "../../workflows/${name}/v1.registry";

const executionIdentityRef = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.executionIdentity,
);
const recordStageFinished = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.recordFinished,
);
const recordStageStarted = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.recordStarted,
);
const reconcileCompletionRef = Ref.getFunctionReference(
  refs.internal.workflows.lifecycle.reconcileCompletion,
);
const currentAuthority = defineGeneratedCurrentAuthorityRef(
  Ref.getFunctionReference(
    refs.internal.workflowContracts.${name}.authorizeConsequential,
  ),
);

const WorkflowReceiptValidator = v.object({
  workflowId: v.string(),
  status: v.literal("completed"),
});

type WorkflowReceipt = {
  readonly workflowId: string;
  readonly status: "completed";
};

export const onComplete = internalMutationGeneric({
  args: {
    workflowId: MaestroWorkflowIdValidator,
    context: WorkflowOnCompleteContextValidator,
    result: MaestroWorkflowResultValidator,
  },
  returns: v.null(),
  handler: async (context, input): Promise<null> => {
    await reconcileObservedWorkflowCompletion(
      context,
      reconcileCompletionRef,
      input,
    );
    return null;
  },
});

${renderGeneratedFailureRouteCompiler(`${name}Graph`)}
const metadata = {
  workflowId: ${name}Graph.id,
  workflowVersion: ${name}Graph.version,
  runtimeVersion: "maestro-graph-v2",
  argsSchemaName: ${name}Graph.argsSchemaName,
  returnSchemaName: ${name}Graph.returnSchemaName,
  principalSchemaName: ${name}Graph.principalSchemaName,
  policyPosture: ${name}Graph.policyPosture,
  kickoffProfiles: ${name}Graph.kickoffProfiles,
  semanticRuleIds: ["WF-DEFINE", "WF-START-EAGER", "WF-START-QUEUED"],
  semanticCoverage: {
    "WF-DEFINE": {
      posture: "generated",
      constructor: "defineMaestroWorkflow",
      compiler: "WorkflowManager.define",
      fixture: "${name}.workflow.test.ts",
    },
    "WF-START-EAGER": {
      posture: "generated",
      constructor: "startInteractive",
      compiler: "startAsync false",
      fixture: "${name}.workflow.test.ts",
    },
    "WF-START-QUEUED": {
      posture: "generated",
      constructor: "startQueued",
      compiler: "startAsync true",
      fixture: "${name}.workflow.test.ts",
    },
  },
} as const;

export const run = defineMaestroWorkflow(components.workflow, {
  args: {
    workspaceId: v.string(),
    workflowRunId: v.string(),
    idempotencyKey: v.string(),
    principal: DurableWorkflowPrincipalValidator,
    policySnapshot: WorkflowPolicySnapshotValidator,
  },
  returns: WorkflowReceiptValidator,
}, metadata).handler(async (step, args): Promise<WorkflowReceipt> => {
  const executionIdentity = await loadObservedWorkflowExecutionIdentity(
    step,
    executionIdentityRef,
    {
    workspaceId: args.workspaceId,
    workflowRunId: args.workflowRunId,
    },
  );
  return runDurableGraphWorkflowV2(step as RunDurableGraphStep, {
    graph: ${name}Graph,
    inputs: args,
    principal: args.principal,
    policySnapshot: args.policySnapshot,
    currentAuthority,
    effectIdentity: {
      workspaceId: args.workspaceId,
      workflowRunId: args.workflowRunId,
      generation: executionIdentity.generation,
      occurredAt: executionIdentity.observedAt,
    },
    observability: { recordStageStarted, recordStageFinished },
    workflowRegistry: ${name}SubworkflowRegistry,
    eventRegistry: ${name}EventRegistry,
    subworkflowPolicy: ${name}SubworkflowPolicy,
    failureRoutes,
    projectOutput: () => ({ workflowId: ${name}Graph.id, status: "completed" as const }),
  });
});
`,
    },
    {
      path: `packages/convex/confect/workflowRunners/${name}/v1.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import type { onComplete, run } from "./v1";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexInternalMutation<typeof run>()("run"))
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof onComplete>()("onComplete"),
  );
`,
    },
    {
      path: `packages/convex/confect/workflowRunners/${name}/v1.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "../../_generated/schema";
import { onComplete, run } from "./v1";
import ${name} from "./v1.spec";

const runImpl = FunctionImpl.make(databaseSchema, ${name}, "run", run);
const onCompleteImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "onComplete",
  onComplete,
);

export default GroupImpl.make(databaseSchema, ${name}).pipe(
  Layer.provide(runImpl),
  Layer.provide(onCompleteImpl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `packages/convex/test/${name}.workflow.test.ts`,
      content: `import { describe, expect, it } from "vitest";
import { ${name}Graph } from "../confect/workflows/${name}/v1.graph";
import {
  runDurableGraphWorkflowV2,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunner";

describe("${name} durable workflow scaffold", () => {
  it("runs the generated source-to-output graph", async () => {
    const step: RunDurableGraphStep = {
      runQuery: async () => {
        throw new Error("Generated source/output graph should not run queries.");
      },
      runMutation: async () => {
        throw new Error("Generated source/output graph should not run mutations.");
      },
      runAction: async () => {
        throw new Error("Generated source/output graph should not run actions.");
      },
      sleep: async () => {},
      awaitEvent: async () => {
        throw new Error("Generated source/output graph should not await events.");
      },
    };

    const inputs = {
      workspaceId: "workspace_123",
      idempotencyKey: "workflow-test-1",
    };

    const result = await runDurableGraphWorkflowV2(step, {
      graph: ${name}Graph,
      inputs,
      principal: {
        version: 2,
        kind: "system",
        workspaceId: inputs.workspaceId,
        systemId: "workflow-test",
        reason: "fixture",
        grants: [],
        kickoffAt: 1,
        provenance: "scheduled-system-workflow",
      },
      policySnapshot: { version: 1, kind: "none", reason: "fixture" },
      projectOutput: () => ({
        workflowId: ${name}Graph.id,
        status: "completed" as const,
      }),
    });

    expect(result).toEqual({
      workflowId: ${name}Graph.id,
      status: "completed",
    });
  });
});
`,
    },
    {
      path: `docs/template/generated/workflows/${name}.semantics.json`,
      content: `${JSON.stringify(workflowGeneratorSemanticCoverage, null, 2)}\n`,
    },
    {
      path: `docs/template/generated/workflows/${name}.md`,
      content: `# ${pascalName} Workflow

${description}

Canonical system: \`${options.system}\` (\`${options.disposition}\`).

## Generated Files

- \`packages/convex/confect/workflowRunners/${name}/v1.ts\`: immutable-version Confect-owned runner source.
- \`packages/convex/convex/workflowRunners/${name}/v1.ts\`: reproducible versioned Confect projection; never edit it by hand.
- \`docs/template/generated/workflows/${name}.semantics.json\`: semantic coverage keyed by executable rule id.
- \`packages/convex/confect/workflowContracts/${name}.spec.ts\`: typed start, status, event, cancel, restart, list, step-list, and cleanup contract.
- \`packages/convex/confect/workflowContracts/${name}.impl.ts\`: Confect implementation that records workflow ownership and projects component status.
- \`packages/convex/confect/workflows/${name}/v1.graph.ts\`: versioned durable graph data, initially source to Trust Receipt output only.
- \`packages/convex/confect/workflows/${name}/v1.registry.ts\`: exact versioned capability, event, child-workflow, and internal-ref bindings.
- \`packages/convex/confect/workflows/${name}.predeploy.ts\`: collected workflow-component Workpool declarations and the injected canonical predeploy findings gate.
- \`packages/convex/test/${name}.workflow.test.ts\`: focused runner scaffold for the default graph.

## Required Follow-Up

1. Keep the generated \`startInteractive\` and \`startQueued\` mutations as the only kickoff-mode selectors; callers never supply the mode or principal.
2. Run \`pnpm confect:codegen\`, then \`pnpm --dir packages/convex exec convex codegen\`, so Confect reproduces \`workflowRunners/${name}/v1:run\` before typecheck.
3. Preserve the authenticated handler's server-derived principal projection when specializing start behavior.
4. Keep React Flow as a projection of \`${name}/v1.graph.ts\`; do not persist canvas node state as the workflow contract.
5. Generated event nodes require \`workflowContracts.${name}.sendEvent\`; callers select an owned opaque ID or generated definition key and never provide workspace, principal, or raw component names.
6. Generated capability nodes require registry entries with generated internal refs, concrete \`buildArgs\` and logical instance-key mappers, and complete effect/guard/redaction/evidence contracts.
7. Generated subworkflow entries require an immutable child version, typed Args/Result schemas, declared transitive children, principal posture, and \`${name}SubworkflowLinkRefs\`; cycle, depth, and fan-out checks run before child dispatch.
8. Workflow 0.4.4 scheduled children remain rejected; use a named sleep plus an unscheduled child only as a deliberately non-equivalent alternative.
9. Query and mutation capabilities use independent Workpool transactions by default. Inline is restricted to declared small atomic work: novice authors choose \`tiny\` or \`small-atomic\`; raw counters require the reviewed advanced constructor. Actions and scheduled steps cannot be inline.
10. Cancel is cooperative: an already-running action may finish, and compensation is a separate explicit workflow. Restart refuses unstable anchors, active Workpool/exposed work, and downstream external actions without generation-scoped dedupe evidence.
11. Cleanup is retention-gated and never claims full component deletion. Schedule bounded calls to \`workflows.lifecycle.sweepRetention\`; pinned Workflow 0.4.4 may leave never-awaited events or failed completion records as explicitly unverifiable residuals.
12. Run \`pnpm check:workflow:fast\`, \`pnpm check:confect-contracts\`, and focused workflow tests.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    files: withGeneratorProvenance("add-workflow", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
  };
};

export const buildCapabilityPromotionFiles = (
  options: PromotionGeneratorOptions,
): PromotionGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const description =
    options.description ??
    `Promoted ${name} capability. Replace the deterministic template body with client-specific domain logic.`;
  const basePath = `packages/convex/confect/capabilities/${name}`;
  const files: readonly GeneratedFile[] = [
    {
      path: `${basePath}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Forbidden, Unauthorized, ValidationFailed } from "../errors";

export const ${name}Args = Schema.Struct({
  workspaceSlug: Schema.String,
  input: Schema.String,
  idempotencyKey: Schema.String,
});

export const ${name}Returns = Schema.Struct({
  status: Schema.Literal("accepted"),
  summary: Schema.String,
});

export const ${name} = FunctionSpec.publicMutation({
  name: "${name}",
  args: () => ${name}Args,
  returns: () => ${name}Returns,
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export default GroupSpec.make().addFunction(${name});
`,
    },
    {
      path: `${basePath}.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import ${name}Group from "./${name}.spec";

const ${name}Impl = FunctionImpl.make(
  databaseSchema,
  ${name}Group,
  "${name}",
  ({ workspaceSlug, input }) =>
    Effect.succeed({
      status: "accepted" as const,
      summary: \`${description} Workspace: \${workspaceSlug}. Input: \${input}.\`,
    }),
);

export default GroupImpl.make(databaseSchema, ${name}Group).pipe(
  Layer.provide(${name}Impl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `${basePath}.domain.ts`,
      content: `// Pure domain helpers for promoted ${name}. Specialize these starter fields with
// reviewed capability input, keep normalize/validate pure, and keep provider
// calls out of this file (they belong in the impl behind services).
export type ${pascalName}Input = {
  readonly workspaceSlug: string;
  readonly input: string;
};

export const normalize${pascalName}Input = (
  input: ${pascalName}Input,
): ${pascalName}Input => ({
  workspaceSlug: input.workspaceSlug.trim(),
  input: input.input.trim(),
});

export const validate${pascalName}Input = (
  input: ${pascalName}Input,
): readonly string[] => {
  const errors: string[] = [];

  if (input.workspaceSlug.length === 0) {
    errors.push("workspaceSlug must not be blank.");
  }

  if (input.input.length === 0) {
    errors.push("input must not be blank.");
  }

  return errors;
};
`,
    },
    {
      path: `${basePath}.test.ts`,
      content: `import fc from "fast-check";
import { describe, expect, it } from "vitest";
import metadata from "./${name}.headless.json";
import {
  normalize${pascalName}Input,
  validate${pascalName}Input,
} from "./${name}.domain";

describe("${name} promoted capability domain", () => {
  it("normalization is idempotent for any input", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (workspaceSlug, input) => {
        const once = normalize${pascalName}Input({ workspaceSlug, input });
        expect(normalize${pascalName}Input(once)).toEqual(once);
      }),
    );
  });

  it("rejects blank fields after normalization", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\\s*$/), (blank) => {
        const normalized = normalize${pascalName}Input({
          workspaceSlug: blank,
          input: blank,
        });
        expect(validate${pascalName}Input(normalized)).toHaveLength(2);
      }),
    );
  });

  it("accepts trimmed non-blank input", () => {
    const normalized = normalize${pascalName}Input({
      workspaceSlug: "  acme-demo  ",
      input: "  summarize the approved sources  ",
    });

    expect(normalized.workspaceSlug).toBe("acme-demo");
    expect(validate${pascalName}Input(normalized)).toEqual([]);
  });

  it("declares the required typed errors", () => {
    expect(metadata.typedErrors).toEqual(
      expect.arrayContaining(["Unauthorized", "ValidationFailed", "Forbidden"]),
    );
    expect(metadata.schemas).toEqual({
      args: "${name}Args",
      returns: "${name}Returns",
    });
  });
});
`,
    },
    {
      path: `${basePath}.headless.json`,
      content: `${JSON.stringify(
        {
          capability: name,
          system: options.system,
          disposition: options.disposition,
          promoted: true,
          targetGroup: `capabilities/${name}`,
          authScope: "workspace member",
          typedErrors: ["Unauthorized", "ValidationFailed", "Forbidden"],
          schemas: {
            args: `${name}Args`,
            returns: `${name}Returns`,
          },
          surfaces: ["api", "cli", "mcp"],
          migrationNotes: [
            "Run Confect codegen before wiring generated refs.",
            "Document durable schema changes before promotion.",
          ],
          frontendAdapter: "required when exposed in web",
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `docs/template/generated/capabilities/${name}.md`,
      content: `# ${pascalName} Promoted Capability

${description}

## Promotion Contract

- Canonical system: \`${options.system}\` (\`${options.disposition}\`)
- Confect spec: \`${name}.spec.ts\`
- Confect impl: \`${name}.impl.ts\`
- Typed errors: Unauthorized, ValidationFailed, Forbidden
- Headless surfaces: API, CLI, MCP

## Required Follow-Up

1. Add this group to the Confect spec tree.
2. Run \`pnpm confect:codegen\`.
3. Wire generated refs into web/API/CLI/MCP surfaces.
4. Replace the deterministic implementation with client-specific domain logic.
5. Run \`pnpm check:confect-contracts\` and focused capability tests.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    target: "capability",
    files: withGeneratorProvenance("promote-capability", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    followUp: [
      "Add promoted group to the Confect spec tree.",
      "Run pnpm confect:codegen and inspect generated refs.",
      "Wire generated refs into selected headless and web surfaces.",
      "Run pnpm check:confect-contracts and focused capability tests.",
    ],
  };
};

export const buildWorkflowPromotionFiles = (
  options: PromotionGeneratorOptions,
): PromotionGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const description =
    options.description ??
    `Promoted ${name} workflow. Replace sample capability refs with client-specific steps.`;
  const basePath = `packages/convex/confect/workflows/${name}`;
  const files: readonly GeneratedFile[] = [
    {
      path: `${basePath}/${name}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Unauthorized, ValidationFailed } from "../../errors";

export const ${name}RunArgs = Schema.Struct({
  workspaceSlug: Schema.String,
  sourceSetId: Schema.String,
  idempotencyKey: Schema.String,
});

export const ${name}RunReturns = Schema.Struct({
  status: Schema.Literal("queued"),
  workflow: Schema.Literal("${name}"),
  runId: Schema.String,
});

export const run = FunctionSpec.publicMutation({
  name: "run",
  args: () => ${name}RunArgs,
  returns: () => ${name}RunReturns,
  error: () => Schema.Union(Unauthorized, ValidationFailed),
});

export default GroupSpec.make().addFunction(run);
`,
    },
    {
      path: `${basePath}/${name}.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../../_generated/schema";
import ${name}Group, { run } from "./${name}.spec";

const runImpl = FunctionImpl.make(
  databaseSchema,
  ${name}Group,
  "run",
  ({ workspaceSlug, idempotencyKey }) =>
    Effect.succeed({
      status: "queued" as const,
      workflow: "${name}" as const,
      runId: \`${name}_\${workspaceSlug}_\${idempotencyKey}\`,
    }),
);

export default GroupImpl.make(databaseSchema, ${name}Group).pipe(
  Layer.provide(runImpl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `${basePath}/${name}.workflow.json`,
      content: `${JSON.stringify(
        {
          id: name,
          name: pascalName,
          system: options.system,
          disposition: options.disposition,
          description,
          promoted: true,
          nodes: [
            { id: "source", kind: "source", label: "Source Set" },
            {
              id: "capability",
              kind: "capability",
              label: "Generated Capability",
              capability: "summarizeSource",
            },
            { id: "approval", kind: "approval", label: "Policy Approval" },
            { id: "receipt", kind: "output", label: "Trust Receipt" },
          ],
          edges: [
            { id: "e1", source: "source", target: "capability" },
            { id: "e2", source: "capability", target: "approval" },
            { id: "e3", source: "approval", target: "receipt" },
          ],
          migrationNotes: [
            "Keep React Flow view data derived from this durable graph.",
            "Document workflow run/event schema changes before promotion.",
          ],
          frontendAdapter: "packages/workflow-ui derived graph adapter",
          headlessRegistry: "required",
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalName} Promoted Workflow

${description}

## Promotion Contract

- Canonical system: \`${options.system}\` (\`${options.disposition}\`)
- Confect run spec: \`${name}.spec.ts\`
- Confect run impl: \`${name}.impl.ts\`
- Durable graph seed: \`${name}.workflow.json\`

## Required Follow-Up

1. Add this group to the Confect spec tree.
2. Wire the graph into \`packages/workflow-ui\` and the headless registry.
3. Replace sample capability refs with promoted capability names.
4. Add replay, retry, idempotency, approval, and Trust Receipt tests.
5. Run \`pnpm confect:codegen\`, \`pnpm check:workflow-graph-boundary\`, and focused workflow tests.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    target: "workflow",
    files: withGeneratorProvenance("promote-workflow", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    followUp: [
      "Add promoted workflow group to the Confect spec tree.",
      "Wire the durable graph into workflow UI and headless registry surfaces.",
      "Run pnpm confect:codegen and inspect generated refs.",
      "Run pnpm check:workflow-graph-boundary and focused workflow tests.",
    ],
  };
};

export const buildTemplateUpgradeReport = (options: {
  readonly from: string;
  readonly to: string;
}): TemplateUpgradeReport => {
  const changedPackages = [
    "packages/convex",
    "packages/template-core",
    "packages/workflow-ui",
    "packages/integrations",
    "tooling/generators",
  ];
  const envChanges = [
    "Review WorkOS, PostHog, Dodo, MailerSend, LLM, storage, and search env names.",
    "Confirm fake/test/live provider mode still matches template-instance.json.",
  ];
  const migrations = [
    "Run schema migration notes before promoting durable Convex table changes.",
    "Run Confect codegen and inspect generated refs before merging.",
  ];
  const generatedContractDiffs = [
    "Compare Confect specs, generated refs, OpenAPI, CLI, MCP, and workflow metadata.",
    "Re-run capability/workflow generators for client-owned extensions if contracts changed.",
  ];
  const privatePackageCompatibility = [
    "Review private-packages/* for template API compatibility before upgrade.",
    "Keep client-specific code under private-packages until contract review passes.",
  ];
  const manualReview = [
    "Move client-specific edits out of template core into private packages before upgrade.",
    "Review provider adapter substitutions and redaction rules.",
    "Verify hosted reference app, executable API handler, and headless CLI/MCP behavior.",
  ];
  const commands = [
    "pnpm review:readiness",
    "pnpm template:doctor -- --mode fake",
    "pnpm check:confect-contracts",
    "pnpm check:workflow-graph-boundary",
    "pnpm check:secret-canaries",
    "pnpm check:schema-migration-notes",
    "pnpm build",
    "pnpm smoke:web-static",
  ];

  return {
    from: options.from,
    to: options.to,
    ok: Boolean(options.from.trim() && options.to.trim()),
    changedPackages,
    envChanges,
    migrations,
    generatedContractDiffs,
    privatePackageCompatibility,
    manualReview,
    commands,
  };
};

type PrivatePackageManifest = {
  readonly name?: string;
  readonly capabilities?: readonly string[];
  readonly workflows?: readonly string[];
  readonly agents?: readonly string[];
  readonly docs?: readonly string[];
};

const privatePackageName = (
  fixturePath: string,
  manifest?: PrivatePackageManifest,
): string =>
  manifest?.name?.trim() || slugify(basename(fixturePath)) || "client-package";

const privatePackageCapabilityFiles = (
  packageName: string,
  capabilityName: string,
  ownership: {
    readonly system: string;
    readonly disposition: SystemGeneratorDisposition;
  },
): readonly GeneratedFile[] => {
  const name = camelCase(capabilityName);
  const pascalName = pascalCase(capabilityName);
  const basePath = `private-packages/${packageName}/src/capabilities/${name}`;

  return [
    {
      path: `${basePath}/${name}.contract.json`,
      content: `${JSON.stringify(
        {
          capability: name,
          packageName,
          authScope: "workspace member",
          typedErrors: ["Unauthorized", "ValidationFailed", "Forbidden"],
          surfaces: ["api", "cli", "mcp"],
          promotionCommand: `pnpm template:promote-capability -- --name ${name} --system ${ownership.system} --disposition ${ownership.disposition} --write`,
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalName} Capability Module

Private package capability module for \`${packageName}\`.

## Import Checklist

1. Review fixture redaction and source ownership.
2. Promote with \`pnpm template:promote-capability -- --name ${name} --system ${ownership.system} --disposition ${ownership.disposition} --write\`.
3. Replace deterministic implementation with client-specific domain logic.
4. Run \`pnpm check:confect-contracts\` and focused capability tests.
`,
    },
  ];
};

const privatePackageWorkflowFiles = (
  packageName: string,
  workflowName: string,
  ownership: {
    readonly system: string;
    readonly disposition: SystemGeneratorDisposition;
  },
): readonly GeneratedFile[] => {
  const name = camelCase(workflowName);
  const pascalName = pascalCase(workflowName);
  const basePath = `private-packages/${packageName}/src/workflows/${name}`;

  return [
    {
      path: `${basePath}/${name}.workflow.json`,
      content: `${JSON.stringify(
        {
          workflow: name,
          packageName,
          promoted: false,
          nodes: [
            { id: "source", kind: "source", label: "Source Set" },
            {
              id: "capability",
              kind: "capability",
              label: "Private Capability",
            },
            { id: "approval", kind: "approval", label: "Policy Approval" },
            { id: "receipt", kind: "output", label: "Trust Receipt" },
          ],
          edges: [
            { id: "e1", source: "source", target: "capability" },
            { id: "e2", source: "capability", target: "approval" },
            { id: "e3", source: "approval", target: "receipt" },
          ],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalName} Workflow Module

Private package workflow module for \`${packageName}\`.

## Import Checklist

1. Review graph nodes, approvals, idempotency, and Trust Receipt policy.
2. Promote with \`pnpm template:promote-workflow -- --name ${name} --system ${ownership.system} --disposition ${ownership.disposition} --write\`.
3. Connect reviewed capability refs to reviewed capability modules.
4. Run \`pnpm check:workflow-graph-boundary\` and focused workflow tests.
`,
    },
  ];
};

const privatePackageIndexFile = (
  packageName: string,
  capabilities: readonly string[],
  workflows: readonly string[],
  docs: readonly string[],
): GeneratedFile => ({
  path: `private-packages/${packageName}/src/index.ts`,
  content: `export const privatePackage = ${JSON.stringify(
    {
      packageName,
      capabilities: capabilities.map(camelCase),
      workflows: workflows.map(camelCase),
      docs,
      requiredChecks: [
        "pnpm check:confect-contracts",
        "pnpm check:workflow-graph-boundary",
        "pnpm check:schema-migration-notes",
        "pnpm check:secret-canaries",
      ],
    },
    null,
    2,
  )} as const;
`,
});

export const buildPrivatePackagePlan = (options: {
  readonly fixturePath: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly mode?: "dry-run" | "import";
}): PrivatePackagePlan => {
  const mode = options.mode ?? "dry-run";
  const manifestPath = resolve(options.fixturePath, "template-package.json");
  const manifest = readOptionalJson<PrivatePackageManifest>(manifestPath);
  const packageName = privatePackageName(options.fixturePath, manifest);
  const capabilities = manifest?.capabilities?.length
    ? manifest.capabilities
    : ["summarizeSource"];
  const workflows = manifest?.workflows?.length
    ? manifest.workflows
    : ["sourceGroundedPlan"];
  const docs = manifest?.docs?.length ? manifest.docs : ["README.md"];
  const checks: DoctorCheck[] = [
    {
      id: "fixture:manifest",
      label: "Package manifest",
      status: manifest ? "pass" : "warn",
      detail: manifest
        ? `Found ${manifestPath}`
        : "No template-package.json found; using safe default package plan",
    },
    {
      id: "fixture:redaction",
      label: "Fixture redaction",
      status: "pass",
      detail: "Generated plan contains no raw customer data or secret values.",
    },
    {
      id: "fixture:contracts",
      label: "Generated contracts",
      status: "pass",
      detail: "Capabilities and workflows require Confect contract checks.",
    },
  ];
  const files: GeneratedFile[] = [
    {
      path: `private-packages/${packageName}/package-plan.json`,
      content: `${JSON.stringify(
        {
          packageName,
          reviewBoundary: "private-packages-first",
          contractReview: "required-before-promotion",
          system: options.system,
          disposition: options.disposition,
          productionRegistrations: false,
          capabilities,
          workflows,
          agents: manifest?.agents ?? [],
          docs,
          ownershipNotes: [
            "Assign a client/package owner before promotion.",
            "Confirm source ownership, retention, and redaction posture.",
          ],
          migrationNotes: [
            "Do not promote directly into template core.",
            "Promote reviewed contracts through template:promote-* commands.",
          ],
          requiredChecks: [
            "pnpm check:confect-contracts",
            "pnpm check:schema-migration-notes",
            "pnpm check:secret-canaries",
          ],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `private-packages/${packageName}/README.md`,
      content: `# ${packageName} Private Package

This package plan is generated from \`${options.fixturePath}\`.

## Contents

- Capabilities: ${capabilities.join(", ")}
- Workflows: ${workflows.join(", ")}
- Docs: ${docs.join(", ")}

## Required Checks

- \`pnpm check:confect-contracts\`
- \`pnpm check:schema-migration-notes\`
- \`pnpm check:secret-canaries\`
`,
    },
    privatePackageIndexFile(packageName, capabilities, workflows, docs),
    ...capabilities.flatMap((capability) =>
      privatePackageCapabilityFiles(packageName, capability, options),
    ),
    ...workflows.flatMap((workflow) =>
      privatePackageWorkflowFiles(packageName, workflow, options),
    ),
  ];

  return {
    fixturePath: options.fixturePath,
    mode,
    ok: checks.every((check) => check.status !== "fail"),
    packageName,
    files: withGeneratorProvenance("private-package", packageName, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    checks,
  };
};

export const buildPrototypeFiles = (
  options: PrototypeGeneratorOptions,
): PrototypeGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const basePath = `experiments/${options.system}/${name}`;
  const promotionCommand = `pnpm template:add-feature -- --name ${name} --system ${options.system} --disposition ${options.disposition} --write`;
  const files: readonly GeneratedFile[] = [
    {
      path: `${basePath}/experiment.json`,
      content: `${JSON.stringify(
        {
          schemaVersion: 1,
          id: name,
          system: options.system,
          disposition: options.disposition,
          hypothesis: options.hypothesis.trim(),
          productionRegistrations: false,
          promotionCommand,
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalName} Experiment

Hypothesis: ${options.hypothesis.trim()}

This code is sandbox-only. It may use fake fixtures and local adapters, but it
must not register production tables, routes, headless operations, jobs, or
providers. Production code must not import it.

When the behavior is worth keeping, re-scaffold the vertical slice with:

\`\`\`bash
${promotionCommand}
\`\`\`
`,
    },
    {
      path: `${basePath}/src/index.ts`,
      content: `/** Sandbox-only prototype for ${options.hypothesis.trim()} */
export const experiment = {
  id: "${name}",
  system: "${options.system}",
  hypothesis: ${JSON.stringify(options.hypothesis.trim())},
} as const;
`,
    },
  ];

  return {
    name,
    system: options.system,
    disposition: options.disposition,
    files: withGeneratorProvenance("prototype", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    followUp: [
      "Prototype with fake-safe data inside the experiment directory.",
      "Record what was learned in the experiment README.",
      `Promote only by re-scaffolding: ${promotionCommand}`,
    ],
  };
};

const parseArgs = (
  argv: readonly string[],
): {
  readonly command: string | undefined;
  readonly name: string | undefined;
  readonly blueprint: BlueprintId;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly version: string | undefined;
  readonly fixture: string | undefined;
  readonly mode: ProviderMode;
  readonly exposure: "web" | "workflow" | "headless";
  readonly description: string | undefined;
  readonly hypothesis: string | undefined;
  readonly system: string | undefined;
  readonly disposition: SystemGeneratorDisposition | undefined;
  readonly query: string | undefined;
  readonly tenantScope: DataTenantScope | undefined;
  readonly sensitivity: DataSensitivity | undefined;
  readonly pii: readonly string[] | undefined;
  readonly exportMode: DataExportMode | undefined;
  readonly deleteMode: DataDeleteMode | undefined;
  readonly retention: DataRetention | undefined;
  readonly appendOnly: boolean;
  readonly write: boolean;
  readonly path: string;
} => {
  const [command] = argv;
  const nameIndex = argv.indexOf("--name");
  const blueprintIndex = argv.indexOf("--blueprint");
  const modeIndex = argv.indexOf("--mode");
  const pathIndex = argv.indexOf("--path");
  const exposureIndex = argv.indexOf("--exposure");
  const descriptionIndex = argv.indexOf("--description");
  const hypothesisIndex = argv.indexOf("--hypothesis");
  const systemIndex = argv.indexOf("--system");
  const dispositionIndex = argv.indexOf("--disposition");
  const queryIndex = argv.indexOf("--query");
  const tenantScopeIndex = argv.indexOf("--tenant-scope");
  const sensitivityIndex = argv.indexOf("--sensitivity");
  const piiIndex = argv.indexOf("--pii");
  const exportModeIndex = argv.indexOf("--export-mode");
  const deleteModeIndex = argv.indexOf("--delete-mode");
  const retentionIndex = argv.indexOf("--retention");
  const fromIndex = argv.indexOf("--from");
  const toIndex = argv.indexOf("--to");
  const versionIndex = argv.indexOf("--version");
  const fixtureIndex = argv.indexOf("--fixture");
  const mode = modeIndex >= 0 ? argv[modeIndex + 1] : undefined;
  const blueprint =
    blueprintIndex >= 0 ? argv[blueprintIndex + 1] : defaultBlueprintId;
  const exposure =
    exposureIndex >= 0 ? (argv[exposureIndex + 1] ?? "headless") : "headless";

  if (
    plannedBlueprintIds.includes(
      blueprint as (typeof plannedBlueprintIds)[number],
    )
  ) {
    throw new Error(
      `Blueprint ${blueprint} is planned, not generator-supported. Supported blueprints: ${supportedBlueprintList()}`,
    );
  }

  if (!buildBlueprintCatalog().some((entry) => entry.id === blueprint)) {
    throw new Error(`Unknown blueprint: ${blueprint}`);
  }

  if (mode && !["fake", "test", "live"].includes(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  if (!["web", "workflow", "headless"].includes(exposure)) {
    throw new Error(`Unknown exposure: ${exposure}`);
  }

  const path = pathIndex >= 0 ? argv[pathIndex + 1] : undefined;
  const disposition =
    dispositionIndex >= 0 ? argv[dispositionIndex + 1] : undefined;
  if (disposition && !["reuse", "extend"].includes(disposition)) {
    throw new Error(`Unknown system disposition: ${disposition}`);
  }
  const tenantScope =
    tenantScopeIndex >= 0 ? argv[tenantScopeIndex + 1] : undefined;
  if (
    tenantScope &&
    !["global", "organization", "workspace", "user"].includes(tenantScope)
  ) {
    throw new Error(`Unknown tenant scope: ${tenantScope}`);
  }
  const sensitivity =
    sensitivityIndex >= 0 ? argv[sensitivityIndex + 1] : undefined;
  if (
    sensitivity &&
    !["public", "internal", "confidential", "restricted"].includes(sensitivity)
  ) {
    throw new Error(`Unknown data sensitivity: ${sensitivity}`);
  }
  const exportMode =
    exportModeIndex >= 0 ? argv[exportModeIndex + 1] : undefined;
  if (
    exportMode &&
    !["markdown", "json", "redacted-json", "not-applicable"].includes(
      exportMode,
    )
  ) {
    throw new Error(`Unknown export mode: ${exportMode}`);
  }
  const deleteMode =
    deleteModeIndex >= 0 ? argv[deleteModeIndex + 1] : undefined;
  if (
    deleteMode &&
    !["delete", "redact", "retain-audit", "not-applicable"].includes(deleteMode)
  ) {
    throw new Error(`Unknown delete mode: ${deleteMode}`);
  }
  const retention = retentionIndex >= 0 ? argv[retentionIndex + 1] : undefined;
  if (
    retention &&
    ![
      "retain-until-workspace-delete",
      "retain-audit-window",
      "hash-or-redact-on-export",
      "retain-until-account-delete",
      "retain-until-organization-delete",
      "retain-configuration",
    ].includes(retention)
  ) {
    throw new Error(`Unknown retention action: ${retention}`);
  }

  return {
    command,
    name: nameIndex >= 0 ? argv[nameIndex + 1] : undefined,
    blueprint: blueprint as BlueprintId,
    from: fromIndex >= 0 ? argv[fromIndex + 1] : undefined,
    to: toIndex >= 0 ? argv[toIndex + 1] : undefined,
    version: versionIndex >= 0 ? argv[versionIndex + 1] : undefined,
    fixture: fixtureIndex >= 0 ? argv[fixtureIndex + 1] : undefined,
    mode: (mode ?? "fake") as ProviderMode,
    exposure: exposure as "web" | "workflow" | "headless",
    description: descriptionIndex >= 0 ? argv[descriptionIndex + 1] : undefined,
    hypothesis: hypothesisIndex >= 0 ? argv[hypothesisIndex + 1] : undefined,
    system: systemIndex >= 0 ? argv[systemIndex + 1] : undefined,
    disposition: disposition as SystemGeneratorDisposition | undefined,
    query: queryIndex >= 0 ? argv[queryIndex + 1] : undefined,
    tenantScope: tenantScope as DataTenantScope | undefined,
    sensitivity: sensitivity as DataSensitivity | undefined,
    pii:
      piiIndex >= 0
        ? (argv[piiIndex + 1] ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0 && value !== "none")
        : undefined,
    exportMode: exportMode as DataExportMode | undefined,
    deleteMode: deleteMode as DataDeleteMode | undefined,
    retention: retention as DataRetention | undefined,
    appendOnly: argv.includes("--append-only"),
    write: argv.includes("--write"),
    path: path || "template-instance.json",
  };
};

export const runGeneratorCli = (
  argv: readonly string[],
  cwd = process.cwd(),
): {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
} => {
  try {
    const args = parseArgs(argv);
    const outputPath = resolve(cwd, args.path);
    const catalogRoot = existsSync(systemCatalogPath(cwd))
      ? cwd
      : defaultRepoRoot;
    const requireOwnership = (): {
      readonly system: string;
      readonly disposition: SystemGeneratorDisposition;
    } => {
      if (!args.system) {
        throw new Error(
          `Missing required --system for ${args.command}. Run pnpm template:systems to inspect canonical owners before scaffolding.`,
        );
      }
      const system = canonicalSystemById(
        readSystemCatalog(catalogRoot),
        args.system,
      );
      if (system.lifecycle !== "active") {
        throw new Error(
          `Canonical system ${system.id} is ${system.lifecycle} and cannot receive new generated ownership.`,
        );
      }
      if (!args.disposition) {
        throw new Error(
          `Missing required --disposition reuse|extend for ${args.command}. Record whether the generated slice delegates to or expands ${system.id}.`,
        );
      }
      return { system: system.id, disposition: args.disposition };
    };

    if (!args.command || args.command === "help" || args.command === "--help") {
      return {
        exitCode: 0,
        stdout:
          [
            `Supported blueprints: ${supportedBlueprintList()}`,
            `Planned blueprints: ${plannedBlueprintIds.join(", ")}`,
            "template:init [--name <name>] [--mode fake|test|live] [--write] [--path <file>]",
            "template:doctor [--mode fake|test|live] [--path <file>]",
            "template:quickstart [--blueprint <supported-blueprint>] [--name <name>] [--mode fake|test|live] [--write]",
            "template:intake [--blueprint <supported-blueprint>] [--name <name>] [--mode fake|test|live] [--write]",
            "template:seed-demo [--blueprint <supported-blueprint>] [--mode fake|test|live] [--write]",
            "template:handoff [--blueprint <supported-blueprint>] [--name <name>] [--mode fake|test|live] [--write]",
            "template:systems [--query <exact-id-alias-responsibility-or-table>]",
            "template:prototype --name <name> --system <canonical-id> --disposition reuse|extend --hypothesis <text> [--write]",
            "template:add-client-domain --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:add-feature --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:add-capability --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--exposure web|workflow|headless] [--write]",
            "template:add-table --name <name> --system <canonical-id> --disposition extend --tenant-scope global|organization|workspace|user --sensitivity public|internal|confidential|restricted --pii <comma-list|none> --export-mode markdown|json|redacted-json|not-applicable --delete-mode delete|redact|retain-audit|not-applicable --retention <action> [--append-only] [--description <text>] [--write]",
            "template:add-workflow --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:bump-workflow --name <name> --from <N> --to <N+1> [--write]",
            "template:bump-capability --name <name> --from <N> --to <N+1> [--write]",
            "template:publish-workflow --name <name> --version <N>",
            "template:publish-capability --name <name> --version <N>",
            "template:add-agent --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:add-agent-seat --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:promote-capability --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:promote-workflow --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
            "template:upgrade --from <client-version> --to <template-version>",
            "template:private-package:dry-run --fixture <path> --system <canonical-id> --disposition reuse|extend",
            "template:private-package:import --fixture <path> --system <canonical-id> --disposition reuse|extend [--write]",
          ].join("\n") + "\n",
        stderr: "",
      };
    }

    if (args.command === "systems") {
      const catalog = readSystemCatalog(catalogRoot);
      const topology = readProductTopology(catalogRoot);
      const catalogMatches = args.query
        ? findCanonicalSystems(catalog, args.query)
        : catalog.systems;
      const normalizedQuery = normalizeSystemLookup(args.query ?? "");
      const resourceMatches = args.query
        ? topology.resources.filter((resource) =>
            [resource.id, resource.path, resource.responsibility].some(
              (value) => normalizeSystemLookup(value) === normalizedQuery,
            ),
          )
        : topology.resources;
      const matchedSystemIds = new Set([
        ...catalogMatches.map(({ id }) => id),
        ...resourceMatches.map(({ system }) => system),
      ]);
      const systems = catalog.systems.filter(({ id }) =>
        matchedSystemIds.has(id),
      );

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(
          {
            query: args.query ?? null,
            matches: systems,
            resources: resourceMatches,
            guidance:
              systems.length === 0
                ? "No exact catalog match. Review the full catalog before proposing an introduce decision."
                : "Use the canonical id with --system and reuse or extend this owner.",
          },
          null,
          2,
        )}\n`,
        stderr: "",
      };
    }

    if (args.command === "prototype") {
      if (!args.name) throw new Error("Missing required --name for prototype");
      if (!args.hypothesis?.trim()) {
        throw new Error("Missing required --hypothesis for prototype");
      }
      const result = buildPrototypeFiles({
        name: args.name,
        ...requireOwnership(),
        hypothesis: args.hypothesis,
      });

      if (args.write) {
        assertGeneratedPathsAreNew(result.files, cwd);
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "init") {
      const instance = buildTemplateInstance(
        args.name
          ? {
              name: args.name,
              blueprint: args.blueprint,
              providerMode: args.mode,
            }
          : { blueprint: args.blueprint, providerMode: args.mode },
      );
      const json = `${JSON.stringify(instance, null, 2)}\n`;

      if (args.write) {
        writeFileSync(outputPath, json);
      }

      return {
        exitCode: 0,
        stdout: json,
        stderr: "",
      };
    }

    if (args.command === "doctor") {
      if (!existsSync(outputPath)) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Missing template instance: ${outputPath}\n`,
        };
      }

      const instance = parseTemplateInstance(readFileSync(outputPath, "utf8"));
      const report = doctorTemplateInstance(instance, {
        mode: args.mode,
        instancePath: outputPath,
      });

      return {
        exitCode: report.ok ? 0 : 1,
        stdout: `${JSON.stringify(report, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "quickstart") {
      const quickstart = buildTemplateQuickstart({
        ...(args.name ? { name: args.name } : {}),
        blueprint: args.blueprint,
        providerMode: args.mode,
        cwd,
      });

      if (args.write) {
        if (quickstart.blueprint === "saas-application") {
          assertGeneratedPathsAreNew(quickstart.files, cwd);
        }
        writeGeneratedFiles(quickstart.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(quickstart, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "intake") {
      const intake = buildClientIntake({
        ...(args.name ? { name: args.name } : {}),
        blueprint: args.blueprint,
        providerMode: args.mode,
      });

      if (args.write) {
        writeGeneratedFiles(intake.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(intake, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "seed-demo") {
      const instance = existsSync(outputPath)
        ? parseTemplateInstance(readFileSync(outputPath, "utf8"))
        : buildTemplateInstance({
            ...(args.name ? { name: args.name } : {}),
            blueprint: args.blueprint,
            providerMode: args.mode,
          });
      const seed = buildDemoSeedPlan({
        blueprint: args.blueprint,
        workspaceSlug: instance.slug,
        providerMode: args.mode,
      });
      const file: GeneratedFile = {
        path: `examples/demo-seed/${args.blueprint}/demo-seed.json`,
        content: `${JSON.stringify(seed, null, 2)}\n`,
      };
      const files = withGeneratorProvenance("seed-demo", instance.slug, [file]);

      if (args.write) {
        writeGeneratedFiles(files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(seed, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "handoff") {
      const instance = existsSync(outputPath)
        ? parseTemplateInstance(readFileSync(outputPath, "utf8"))
        : buildTemplateInstance({
            ...(args.name ? { name: args.name } : {}),
            blueprint: args.blueprint,
            providerMode: args.mode,
          });
      const packet = buildHandoffPacket({
        name: args.name ?? instance.name,
        blueprint: args.blueprint,
        mode: args.mode,
      });
      const file: GeneratedFile = {
        path: "docs/template/generated/handoff-packet.md",
        content: packet.markdown,
      };
      const files = withGeneratorProvenance("handoff", instance.slug, [file]);

      if (args.write) {
        writeGeneratedFiles(files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(packet, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "add-client-domain") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --name for add-client-domain\n",
        };
      }

      const result = buildClientDomainFiles({
        name: args.name,
        ...requireOwnership(),
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "add-feature") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --name for add-feature\n",
        };
      }
      const result = buildFeatureFiles({
        name: args.name,
        ...requireOwnership(),
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        assertGeneratedPathsAreNew(result.files, cwd);
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "add-capability") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --name for add-capability\n",
        };
      }

      const result = buildCapabilityFiles({
        name: args.name,
        ...requireOwnership(),
        exposure: args.exposure,
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "add-table") {
      if (!args.name) {
        throw new Error("Missing required --name for add-table");
      }
      if (!args.tenantScope) {
        throw new Error("Missing required --tenant-scope for add-table");
      }
      if (!args.sensitivity) {
        throw new Error("Missing required --sensitivity for add-table");
      }
      if (args.pii === undefined) {
        throw new Error(
          "Missing required --pii <comma-list|none> for add-table",
        );
      }
      if (!args.exportMode) {
        throw new Error("Missing required --export-mode for add-table");
      }
      if (!args.deleteMode) {
        throw new Error("Missing required --delete-mode for add-table");
      }
      if (!args.retention) {
        throw new Error("Missing required --retention for add-table");
      }
      const ownership = requireOwnership();
      if (ownership.disposition !== "extend") {
        throw new Error("New durable tables must use --disposition extend");
      }
      const result = buildTableFiles(
        {
          name: args.name,
          system: ownership.system,
          disposition: "extend",
          tenantScope: args.tenantScope,
          sensitivity: args.sensitivity,
          pii: args.pii,
          exportMode: args.exportMode,
          deleteMode: args.deleteMode,
          retention: args.retention,
          appendOnly: args.appendOnly,
          ...(args.description ? { description: args.description } : {}),
        },
        {
          systems: readSystemCatalog(catalogRoot),
          dataResources: readDataResourceCatalog(catalogRoot),
        },
      );

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "add-workflow") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --name for add-workflow\n",
        };
      }

      const result = buildWorkflowFiles({
        name: args.name,
        ...requireOwnership(),
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "add-agent" || args.command === "add-agent-seat") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Missing required --name for ${args.command}\n`,
        };
      }

      const result = buildAgentFiles({
        name: args.name,
        ...requireOwnership(),
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "promote-capability") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --name for promote-capability\n",
        };
      }

      const result = buildCapabilityPromotionFiles({
        name: args.name,
        ...requireOwnership(),
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "promote-workflow") {
      if (!args.name) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --name for promote-workflow\n",
        };
      }

      const result = buildWorkflowPromotionFiles({
        name: args.name,
        ...requireOwnership(),
        ...(args.description ? { description: args.description } : {}),
      });

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (
      args.command === "bump-workflow" ||
      args.command === "bump-capability"
    ) {
      if (!args.name) {
        throw new Error(`Missing required --name for ${args.command}`);
      }
      const result = bumpRelease({
        cwd,
        kind: args.command === "bump-workflow" ? "workflow" : "capability",
        name: camelCase(args.name),
        from: args.from,
        to: args.to,
        write: args.write,
      });
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (
      args.command === "publish-workflow" ||
      args.command === "publish-capability"
    ) {
      if (!args.name) {
        throw new Error(`Missing required --name for ${args.command}`);
      }
      const result = publishRelease({
        cwd,
        kind: args.command === "publish-workflow" ? "workflow" : "capability",
        name: camelCase(args.name),
        version: args.version,
      });
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    if (args.command === "upgrade") {
      if (!args.from || !args.to) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Missing required --from or --to for upgrade\n",
        };
      }

      const report = buildTemplateUpgradeReport({
        from: args.from,
        to: args.to,
      });

      return {
        exitCode: report.ok ? 0 : 1,
        stdout: `${JSON.stringify(report, null, 2)}\n`,
        stderr: "",
      };
    }

    if (
      args.command === "private-package:dry-run" ||
      args.command === "private-package:import"
    ) {
      if (!args.fixture) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Missing required --fixture for ${args.command}\n`,
        };
      }

      const plan = buildPrivatePackagePlan({
        fixturePath: resolve(cwd, args.fixture),
        ...requireOwnership(),
        mode: args.command === "private-package:import" ? "import" : "dry-run",
      });

      if (args.command === "private-package:import" && args.write) {
        writeGeneratedFiles(plan.files, cwd);
      }

      return {
        exitCode: plan.ok ? 0 : 1,
        stdout: `${JSON.stringify(plan, null, 2)}\n`,
        stderr: "",
      };
    }

    return {
      exitCode: 1,
      stdout: "",
      stderr: `Unknown generator command: ${args.command}\n`,
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
};

export type ReviewedGeneratorDescriptor = {
  readonly generatorId:
    | "add-client-domain"
    | "add-feature"
    | "add-capability"
    | "add-table"
    | "add-workflow"
    | "add-agent";
  readonly recipe: string;
  readonly command: `pnpm template:${string}`;
  readonly argumentNames: readonly string[];
  readonly codegen: readonly string[];
  readonly focusedGates: readonly string[];
};

const backendCodegen = ["pnpm confect:codegen", "pnpm confect:manifest"];
const backendGates = ["pnpm check:confect-contracts"];

export const REVIEWED_GENERATOR_DESCRIPTORS = [
  {
    generatorId: "add-client-domain",
    recipe: "docs/template/app-factory-guide.md",
    command: "pnpm template:add-client-domain",
    argumentNames: ["name", "system", "disposition", "description"],
    codegen: backendCodegen,
    focusedGates: backendGates,
  },
  {
    generatorId: "add-feature",
    recipe: "docs/template/app-factory-guide.md",
    command: "pnpm template:add-feature",
    argumentNames: ["name", "system", "disposition", "description"],
    codegen: backendCodegen,
    focusedGates: [...backendGates, "pnpm --dir apps/web typecheck"],
  },
  {
    generatorId: "add-capability",
    recipe: "docs/template/how-to-add-capability.md",
    command: "pnpm template:add-capability",
    argumentNames: ["name", "system", "disposition", "description", "exposure"],
    codegen: backendCodegen,
    focusedGates: backendGates,
  },
  {
    generatorId: "add-table",
    recipe: "docs/template/how-to-add-data-lifecycle-resource.md",
    command: "pnpm template:add-table",
    argumentNames: [
      "name",
      "system",
      "disposition",
      "tenantScope",
      "sensitivity",
      "pii",
      "exportMode",
      "deleteMode",
      "retention",
      "appendOnly",
      "description",
    ],
    codegen: backendCodegen,
    focusedGates: [
      ...backendGates,
      "pnpm check:data-resources",
      "pnpm check:schema-migration-notes",
    ],
  },
  {
    generatorId: "add-workflow",
    recipe: "docs/template/how-to-add-workflow.md",
    command: "pnpm template:add-workflow",
    argumentNames: ["name", "system", "disposition", "description"],
    codegen: backendCodegen,
    focusedGates: [...backendGates, "pnpm check:workflow-graph-boundary"],
  },
  {
    generatorId: "add-agent",
    recipe: "docs/template/how-to-add-agent.md",
    command: "pnpm template:add-agent",
    argumentNames: ["name", "system", "disposition", "description"],
    codegen: backendCodegen,
    focusedGates: backendGates,
  },
] as const satisfies readonly ReviewedGeneratorDescriptor[];

export type ReviewedGeneratorRequest = {
  readonly generatorId: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly write: boolean;
  readonly cwd: string;
};

export type ReviewedGeneratorOutput = {
  readonly files: readonly GeneratedFile[];
  readonly provenancePaths: readonly string[];
  readonly collisions: readonly string[];
  readonly semanticRuleIds: readonly string[];
  readonly manualFollowUp: readonly string[];
  readonly codegen: readonly string[];
  readonly focusedGates: readonly string[];
};

export type ReviewedGeneratorRunResult =
  | { readonly ok: true; readonly output: ReviewedGeneratorOutput }
  | { readonly ok: false; readonly message: string };

export function resolveReviewedGenerator(generatorId: string):
  | { readonly supported: true }
  | {
      readonly supported: false;
      readonly nearest: readonly ReviewedGeneratorDescriptor[];
    } {
  return REVIEWED_GENERATOR_DESCRIPTORS.some(
    (descriptor) => descriptor.generatorId === generatorId,
  )
    ? { supported: true }
    : { supported: false, nearest: REVIEWED_GENERATOR_DESCRIPTORS.slice(0, 1) };
}

export function runReviewedGenerator(
  request: ReviewedGeneratorRequest,
): ReviewedGeneratorRunResult {
  const descriptor = REVIEWED_GENERATOR_DESCRIPTORS.find(
    (candidate) => candidate.generatorId === request.generatorId,
  );
  if (descriptor === undefined) {
    return {
      ok: false,
      message: `Unsupported generator: ${request.generatorId}`,
    };
  }
  const argv = generatorArgv(descriptor, request.args);
  if (!argv.ok) return argv;
  const preview = runGeneratorCli(argv.value, request.cwd);
  if (preview.exitCode !== 0) {
    return { ok: false, message: preview.stderr.trim() };
  }
  const parsed = parseReviewedGeneratorResult(preview.stdout);
  if (!parsed.ok) return parsed;
  const collisions = parsed.files
    .map(({ path }) => path)
    .filter((path) => existsSync(resolve(request.cwd, path)));
  const output = projectReviewedOutput(parsed.value, descriptor, collisions);
  if (!request.write) return { ok: true, output };
  if (collisions.length > 0) {
    return {
      ok: false,
      message: `Refusing to overwrite existing paths: ${collisions.join(", ")}.`,
    };
  }
  const written = runGeneratorCli([...argv.value, "--write"], request.cwd);
  return written.exitCode === 0
    ? { ok: true, output }
    : { ok: false, message: written.stderr.trim() };
}

function generatorArgv(
  descriptor: ReviewedGeneratorDescriptor,
  args: Readonly<Record<string, unknown>>,
):
  | { readonly ok: true; readonly value: readonly string[] }
  | {
      readonly ok: false;
      readonly message: string;
    } {
  const unknown = Object.keys(args).filter(
    (name) => !descriptor.argumentNames.includes(name),
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unknown generator arguments: ${unknown.join(", ")}`,
    };
  }
  const argv: string[] = [descriptor.generatorId];
  for (const name of descriptor.argumentNames) {
    const value = args[name];
    if (value === undefined || value === false) continue;
    const flag = `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    if (value === true) argv.push(flag);
    else if (typeof value === "string") argv.push(flag, value);
    else if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      argv.push(flag, value.length === 0 ? "none" : value.join(","));
    } else {
      return {
        ok: false,
        message: `Generator argument ${name} has an invalid value.`,
      };
    }
  }
  return { ok: true, value: argv };
}

function parseReviewedGeneratorResult(stdout: string):
  | {
      readonly ok: true;
      readonly value: Record<string, unknown>;
      readonly files: readonly GeneratedFile[];
    }
  | { readonly ok: false; readonly message: string } {
  try {
    const value: unknown = JSON.parse(stdout);
    if (value === null || typeof value !== "object" || !("files" in value)) {
      return { ok: false, message: "Generator returned an invalid result." };
    }
    const files = (value as { readonly files: unknown }).files;
    if (!Array.isArray(files) || !files.every(isGeneratedFile)) {
      return { ok: false, message: "Generator returned invalid files." };
    }
    return { ok: true, value: value as Record<string, unknown>, files };
  } catch {
    return { ok: false, message: "Generator returned invalid JSON." };
  }
}

function projectReviewedOutput(
  value: Record<string, unknown>,
  descriptor: ReviewedGeneratorDescriptor,
  collisions: readonly string[],
): ReviewedGeneratorOutput {
  const files = value.files as readonly GeneratedFile[];
  return {
    files,
    provenancePaths: files
      .map(({ path }) => path)
      .filter((path) => path.includes("/provenance/")),
    collisions,
    semanticRuleIds: collectStringArrayField(value, "semanticRuleIds"),
    manualFollowUp: stringArray(value.followUp),
    codegen: descriptor.codegen,
    focusedGates: descriptor.focusedGates,
  };
}

function collectStringArrayField(
  value: unknown,
  field: string,
): readonly string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(value.flatMap((item) => collectStringArrayField(item, field))),
    ];
  }
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [
    ...stringArray(record[field]),
    ...Object.values(record).flatMap((item) =>
      collectStringArrayField(item, field),
    ),
  ].filter((item, index, all) => all.indexOf(item) === index);
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function isGeneratedFile(value: unknown): value is GeneratedFile {
  return (
    value !== null &&
    typeof value === "object" &&
    "path" in value &&
    typeof value.path === "string" &&
    "content" in value &&
    typeof value.content === "string"
  );
}

if (isGeneratorDirectRun(import.meta.url)) {
  const result = runGeneratorCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
