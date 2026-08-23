#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
import { planUpgrade } from "@maestro-template/release-tooling/upgrade";
import { gtmImplementationBlueprint } from "./blueprints/gtmImplementation";
import {
  buildSaasApplicationFiles,
  buildSaasApplicationHandoff,
  saasApplicationBlueprint,
} from "./blueprints/saasApplication";
export {
  buildSaasApplicationAlpha1TargetPlan,
  buildSaasApplicationFiles,
  buildSaasApplicationTargetPlan,
} from "./blueprints/saasApplication";
export {
  isRecordsOnlyWorkflowProvenancePath,
  isWorkflowAutomationPath,
} from "./blueprints/saasApplicationPatterns";
export { buildSaasApplicationAlpha2TargetPlan } from "./blueprints/alpha2SaasApplicationPlan";
import { buildWorkflowFiles } from "./workflow-files";
export { buildWorkflowFiles } from "./workflow-files";
import { bumpRelease, publishRelease } from "./workflow-release-commands";
import { isGeneratorDirectRun } from "./direct-run";
import { buildCrudFeatureFiles } from "./feature-crud";
import { selectStarterScreen } from "./screen-selection";
import { executePrivatePackagePlan } from "./private-package";
export {
  buildPrivatePackagePlan,
  executePrivatePackagePlan,
  type PrivatePackagePlan,
} from "./private-package";
export { parseCustomerTemplateInstance } from "./customer-runtime";
export { createTemplateInstanceMigration } from "./templateInstanceMigration";

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
  readonly screenCatalogId: string;
  readonly catalogRoot?: string;
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
  readonly surfaces: readonly [];
  readonly headlessExposure: false;
  readonly files: readonly GeneratedFile[];
  readonly followUp: readonly string[];
};

export type AgentSeatGeneratorResult = Omit<
  AgentGeneratorResult,
  "surfaces"
> & {
  readonly surfaces: readonly ["web"];
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
  readonly businessEntity?: boolean;
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
  email: "email",
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

const reviewedTransitionMatches = (
  candidate: unknown,
  from: string,
  to: string,
): boolean => {
  if (typeof candidate !== "object" || candidate === null) return false;
  const manifest = Reflect.get(candidate, "manifest") as unknown;
  if (typeof manifest !== "object" || manifest === null) return false;
  const transition = Reflect.get(manifest, "transition") as unknown;
  if (typeof transition !== "object" || transition === null) return false;
  return (
    Reflect.get(transition, "fromVersion") === from &&
    Reflect.get(transition, "toVersion") === to
  );
};

export const buildTemplateInstance = (options?: {
  readonly name?: string;
  readonly blueprint?: BlueprintId;
  readonly providerMode?: ProviderMode;
  readonly generatedAt?: string;
  // eslint-disable-next-line complexity -- AP-008 tracks consolidating duplicated factory/runtime compatibility parsing.
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

// eslint-disable-next-line complexity -- AP-008 tracks consolidating duplicated factory/runtime compatibility parsing.
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
- Email: keep delivery disabled or fake-only until Postmark sender signatures and webhooks are verified.
- OpenRouter-compatible LLM: use deterministic fake completions until spend caps, model allowlist, and redaction posture are approved.
- Storage and search: use local/fake providers until source ownership, retention, export, and delete posture are documented.
- Cloudflare and Woodpecker: use local commands first, then configure hosted smoke and CI promotion after the fork is stable.

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
// eslint-disable-next-line complexity -- AP-008 tracks splitting blueprint-specific quickstart projection.
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
- Email: fake until Postmark sender signatures, streams, templates, and webhooks are approved.
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
): FeatureGeneratorResult =>
  buildCrudFeatureFiles({
    ...options,
    frontend: selectStarterScreen(
      options.catalogRoot ?? defaultRepoRoot,
      options.screenCatalogId,
    ),
  });

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
  // eslint-disable-next-line complexity -- AP-008 tracks splitting durable-table projection metadata.
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
  const businessFields = options.businessEntity
    ? `
    title: Schema.String,
    detail: Schema.String,
    status: Schema.Literals(["planned", "active", "complete"]),`
    : "";
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
        writePosture: "implemented",
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
${businessFields}
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
    `Generated ${name} agent declaration. Select a UI seat before adding surface behavior.`;
  const followUp = [
    "Select a UI seat before adding surface-specific behavior.",
    "Review capability grants before adding model-call or provider-backed behavior.",
  ] as const;
  const files: readonly GeneratedFile[] = [
    {
      path: `packages/convex/confect/agents/${name}.ts`,
      content: `export const ${name}Agent = {
  id: "${name}",
  system: "${options.system}",
  disposition: "${options.disposition}",
  systemDisposition: "${options.disposition}",
  displayName: "${pascalName}",
  description: ${JSON.stringify(description)},
  surfaces: [],
  capabilities: [],
  headlessExposure: false,
} as const;
`,
    },
    {
      path: `docs/template/generated/agents/${name}.md`,
      content: `# ${pascalName} Agent

${description}

This declaration is surface-neutral. Use \`pnpm template:add-agent-seat\` to select a UI seat and generate its explicit runtime contract.

- Canonical system: \`${options.system}\` (\`${options.disposition}\`)
- Surfaces: none
- Capabilities: none
- Headless exposure: none
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    surfaces: [],
    headlessExposure: false,
    files: withGeneratorProvenance("add-agent", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
    followUp,
  };
};

export const buildAgentSeatFiles = (
  options: AgentGeneratorOptions,
): AgentSeatGeneratorResult => {
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
    "Review WorkOS, PostHog, Dodo, email, LLM, storage, and search env names.",
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

export const buildPrototypeFiles = (
  options: PrototypeGeneratorOptions,
): PrototypeGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const basePath = `experiments/${options.system}/${name}`;
  const promotionCommand = `pnpm template:add-feature -- --name ${name} --system ${options.system} --disposition ${options.disposition} --screen-catalog-id <exact-catalog-id> --write`;
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

const valueFlags = new Set([
  "--name",
  "--blueprint",
  "--mode",
  "--path",
  "--exposure",
  "--description",
  "--hypothesis",
  "--system",
  "--disposition",
  "--query",
  "--tenant-scope",
  "--sensitivity",
  "--pii",
  "--export-mode",
  "--delete-mode",
  "--retention",
  "--from",
  "--to",
  "--version",
  "--fixture",
  "--screen-catalog-id",
]);
const booleanFlags = new Set([
  "--append-only",
  "--business-entity",
  "--help",
  "--write",
  "-h",
]);

const validateGeneratorArgv = (argv: readonly string[]): void => {
  const unconsumed: string[] = [];
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined || token === "--" || booleanFlags.has(token))
      continue;
    if (valueFlags.has(token)) {
      index += 1;
      continue;
    }
    unconsumed.push(token);
  }
  if (unconsumed.length === 0) return;
  if (argv.includes("--query")) {
    throw new Error(
      `Ambiguous arguments after --query: ${unconsumed.join(" ")}. Quote multi-word queries, for example --query "social sync".`,
    );
  }
  throw new Error(`Unexpected arguments: ${unconsumed.join(" ")}`);
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
  readonly screenCatalogId: string | undefined;
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
  readonly businessEntity: boolean;
  readonly write: boolean;
  readonly path: string;
  // eslint-disable-next-line complexity -- AP-008 tracks splitting the legacy generator argv compatibility parser.
} => {
  validateGeneratorArgv(argv);
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
  const screenCatalogIdIndex = argv.indexOf("--screen-catalog-id");
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
    screenCatalogId:
      screenCatalogIdIndex >= 0 ? argv[screenCatalogIdIndex + 1] : undefined,
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
    businessEntity: argv.includes("--business-entity"),
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
  // eslint-disable-next-line complexity -- AP-008 tracks splitting legacy generator command dispatch.
} => {
  try {
    const cliArgv = argv.filter((argument) => argument !== "--");
    const args = parseArgs(cliArgv);
    if (
      args.command !== undefined &&
      (cliArgv[1] === "--help" || cliArgv[1] === "-h")
    ) {
      const prefix = `template:${args.command}`;
      const usage = runGeneratorCli(["help"], cwd)
        .stdout.split("\n")
        .find((line) => line === prefix || line.startsWith(`${prefix} `));
      if (usage !== undefined)
        return { exitCode: 0, stdout: `${usage}\n`, stderr: "" };
    }
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
            "template:add-feature --name <name> --system <canonical-id> --disposition reuse|extend --screen-catalog-id <exact-id> [--description <text>] [--write]",
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
            "template:upgrade --from <client-version> --to <template-version> --path <reviewed-input.json>",
            "template:private-package:dry-run --fixture <path> --system <canonical-id> --disposition reuse|extend",
            "template:private-package:import --fixture <path> --system <canonical-id> --disposition reuse|extend --write",
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
      if (!args.screenCatalogId) {
        return {
          exitCode: 1,
          stdout: "",
          stderr:
            "Missing required --screen-catalog-id for add-feature. Select an exact assembled screen from docs/template/saas-ui-screen-catalog.json.\n",
        };
      }
      const result = buildFeatureFiles({
        name: args.name,
        screenCatalogId: args.screenCatalogId,
        catalogRoot,
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
          businessEntity: args.businessEntity,
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

      const ownership = requireOwnership();
      const generatorArgs = {
        name: args.name,
        ...ownership,
        ...(args.description ? { description: args.description } : {}),
      };
      const result = buildWorkflowFiles(generatorArgs);

      if (args.write) {
        writeGeneratedFiles(result.files, cwd);
      }

      return {
        exitCode: 0,
        stdout: `${JSON.stringify(
          {
            ...result,
            privacy: {
              classification: "review-required",
              secrets: "names-only",
            },
            reviewedEquivalent: {
              argv: [
                "node",
                "maestro-template.mjs",
                "scaffold",
                "--generator",
                "add-workflow",
                "--args",
                JSON.stringify(generatorArgs),
              ],
            },
          },
          null,
          2,
        )}\n`,
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

      const result =
        args.command === "add-agent-seat"
          ? buildAgentSeatFiles({
              name: args.name,
              ...requireOwnership(),
              ...(args.description ? { description: args.description } : {}),
            })
          : buildAgentFiles({
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

      const candidate = JSON.parse(readFileSync(outputPath, "utf8")) as unknown;
      const planned = planUpgrade(candidate);
      const report =
        planned.ok && !reviewedTransitionMatches(candidate, args.from, args.to)
          ? planUpgrade({
              schemaVersion: 1,
              reviewedInput: candidate,
              requestedTransition: { from: args.from, to: args.to },
            })
          : planned;

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

      const plan = executePrivatePackagePlan({
        fixturePath: resolve(cwd, args.fixture),
        fixtureArgument: args.fixture,
        targetRoot: cwd,
        ...requireOwnership(),
        mode: args.command === "private-package:import" ? "import" : "dry-run",
        write: args.write,
      });

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

const backendCodegen = [
  "pnpm confect:codegen",
  "pnpm confect:manifest",
  "pnpm format",
];
const featureCodegen = [...backendCodegen, "pnpm --dir apps/web build"];
const backendGates = ["pnpm check:confect-contracts"];

export const REVIEWED_GENERATOR_DESCRIPTORS = [
  {
    generatorId: "add-client-domain",
    recipe: "docs/template/app-factory-guide.md",
    command: "pnpm template:add-client-domain",
    argumentNames: [
      "name",
      "system",
      "disposition",
      "screenCatalogId",
      "description",
    ],
    codegen: backendCodegen,
    focusedGates: backendGates,
  },
  {
    generatorId: "add-feature",
    recipe: "docs/template/app-factory-guide.md",
    command: "pnpm template:add-feature",
    argumentNames: [
      "name",
      "system",
      "disposition",
      "screenCatalogId",
      "description",
    ],
    codegen: featureCodegen,
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
      "businessEntity",
      "description",
    ],
    codegen: backendCodegen,
    focusedGates: [
      ...backendGates,
      "pnpm check:system-catalog",
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
  const reviewedMutableCatalogs = new Set([
    "docs/template/system-catalog.json",
    "docs/template/data-resources.json",
    "packages/convex/confect/ops/dataResources.generated.ts",
  ]);
  const collisions = parsed.files
    .map(({ path }) => path)
    .filter((path) => !reviewedMutableCatalogs.has(path))
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

export const runGeneratorCliProcess = (
  argv: readonly string[] = process.argv.slice(2),
  output: {
    readonly stdout: (value: string) => void;
    readonly stderr: (value: string) => void;
  } = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  },
): 0 | 1 => {
  const result = runGeneratorCli(argv);
  output.stdout(result.stdout);
  output.stderr(result.stderr);
  return result.exitCode;
};

if (isGeneratorDirectRun(import.meta.url)) {
  process.exitCode = runGeneratorCliProcess();
}
