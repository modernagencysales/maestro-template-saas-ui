import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDataResourceCatalog,
  renderDataResourceRuntime,
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
  parseSystemCatalog,
  type SystemCatalog,
} from "@maestro-template/template-core/systemCatalog";
import {
  resolveTemplateInstanceCompatibility,
  templateInstanceSchemaProvider,
} from "@maestro-template/template-core/templateInstance";
import { gtmImplementationBlueprint } from "./blueprints/gtmImplementation";
import { buildCrudFeatureFiles } from "./feature-crud";
import { selectStarterScreen } from "./screen-selection";

export const buildWorkflowFiles = (
  options: WorkflowGeneratorOptions,
): WorkflowGeneratorResult => {
  void options;
  throw new Error("Workflow automation pattern is not selected.");
};

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

export type CapabilityGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly exposure?: "web" | "workflow" | "headless";
  readonly write?: boolean;
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
  "pnpm check:schema-migration-notes",
  "pnpm check:secret-canaries",
] as const;

const defaultBlueprintId: WorkflowBackedBlueprintId =
  "source-grounded-gtm-brain";
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
  {
    id: "saas-application",
    label: "SaaS Application",
    summary:
      "A neutral workspace-safe SaaS application with one renameable CRUD record slice and no required automation or live provider.",
    domainNouns: ["workspace", "member", "record"],
    sourceTypes: ["deterministic fixture"],
    defaultCapability: null,
    defaultWorkflow: null,
    defaultAgent: null,
    providerPosture: "fake-first",
    surfaces: ["web", "api", "cli"],
  },
];

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

const withGeneratorProvenance = (
  generator: string,
  name: string,
  files: readonly GeneratedFile[],
  ownership?: {
    readonly system: string;
    readonly disposition: SystemGeneratorDisposition;
  },
): readonly GeneratedFile[] => {
  const commandFamily = `template:${generator}`;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseCustomerTemplateInstance = (
  raw: string,
  // eslint-disable-next-line complexity -- AP-008 tracks consolidating legacy instance compatibility parsing.
): TemplateInstance => {
  try {
    return parseTemplateInstance(raw);
  } catch (legacyError) {
    let input: unknown;
    try {
      input = JSON.parse(raw) as unknown;
    } catch {
      throw legacyError;
    }
    const resolution = resolveTemplateInstanceCompatibility(input);
    if (!resolution.safeToContinueReadOnly) {
      throw new Error(
        `[${resolution.code}] template-instance.json is not readable by this customer runtime: ${resolution.recovery.action}`,
      );
    }
    const canonical =
      resolution.status === "compatible"
        ? templateInstanceSchemaProvider.parse(input)
        : input;
    const personalization = isRecord(canonical)
      ? canonical.personalization
      : undefined;
    const blueprint = isRecord(canonical) ? canonical.blueprint : undefined;
    const name = isRecord(personalization) ? personalization.name : undefined;
    const blueprintId = isRecord(blueprint) ? blueprint.id : undefined;
    if (
      typeof name !== "string" ||
      name.trim() === "" ||
      typeof blueprintId !== "string" ||
      ![
        "source-grounded-gtm-brain",
        "gtm-implementation",
        "saas-application",
      ].includes(blueprintId)
    ) {
      throw new Error(
        "template-instance.json is missing canonical personalization.name or blueprint.id",
      );
    }
    return buildTemplateInstance({
      name,
      blueprint: blueprintId as BlueprintId,
      providerMode: "fake",
      generatedAt: "1970-01-01T00:00:00.000Z",
    });
  }
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
    {
      path: "packages/convex/confect/ops/dataResources.generated.ts",
      content: renderDataResourceRuntime(nextDataResources),
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
5. Run \`pnpm confect:codegen\` and focused workflow tests after selecting workflow automation.
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
      "Select workflow automation before running focused workflow tests.",
    ],
  };
};
