import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createCheckCommand,
  createComposedPreflightProbe,
  createExecFileVerificationRunner,
  createMaestroMcpProjection,
  createMaestroMcpServer,
  createMcpConfigureCommand,
  createNodeExecFileAdapter,
  createNodeBuildReadinessSurface,
  createNodeVerificationReceiptWriter,
  createNodePreflightRuntimeReader,
  createConvexDoctorAdapter,
  createProviderDoctorCommand,
  createPlanCheckCommand,
  createPreflightCommand,
  createAddRecipeCommand,
  createRecipesCommand,
  createScaffoldCommand,
  createVerifyCommand,
  createVerificationReceiptExportCommand,
  createRepositoryContext,
  createRepositoryLocalMcpConfigurationStore,
  createNodeSupportBundleExporter,
  createNodeRecipeTransaction,
  createSupportBundleCommand,
  defineDiagnosticRegistryProjection,
  executeAgentPackCommand,
  nodePreflightFileSystem,
  parseConvexMcpProfiles,
  readInstalledConvexMcpInventory,
  serveMcpStdio,
  sha256RecipeBytes,
  validateInstalledOfficialConvexTargets,
  type AgentPackExecutionContext,
  type McpConfigurationStore,
  type NodePreflightPolicy,
} from "@maestro-template/agent-pack";
import { createAppMapMcpProjection } from "@maestro-template/app-map-tooling/mcp";
import {
  buildBlueprintCatalog,
  buildTemplateInstance,
  doctorTemplateInstance,
  parseTemplateInstance,
  readDataResourceCatalog,
  readProductTopology,
  readSystemCatalog,
  resolveReviewedGenerator,
  requiredEnvNamesForProvider,
  runReviewedGenerator,
} from "@maestro-template/generators";
import { defineQualityDiagnosticRegistryProjection } from "@maestro-template/quality-tooling";
import {
  readReviewedAdrRefs,
  validatePlan,
} from "@maestro-template/stack-tooling";
import { WORKFLOW_SEMANTICS } from "@maestro-template/template-core/workflow-semantics";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { createPlanCheckCliHandler } from "./planCheck";
import { createAppMapCliHandlers } from "./appMap";
import { createAdoptCliHandler } from "./adopt";
import { readBoundedAdoptionPacket } from "./adoptFileReader";
import { loadCustomerCreateComposition as createCustomerCreateComposition } from "./createComposition";
import { createProviderDoctorCliHandler } from "./doctor";
import {
  projectCompositionEnvironment,
  projectCompositionEnvironmentFingerprintMaterial,
  projectCompositionProviderFingerprintMaterial,
  type CompositionEnvironmentReader,
} from "./environment";
import { createMcpCliAdapter } from "./mcp";
import { createMcpConfigureCliAdapter } from "./mcpConfigure";
import { createPreflightCliHandler } from "./preflight";
import { loadRecipeCatalogProjection } from "./recipeCatalog";
import { createRecipeCliHandlers } from "./recipes";
import { createScaffoldCliHandler } from "./scaffold";
import { createSupportBundleCliHandler } from "./supportBundle";
import {
  createComposedStartCommand,
  createStartCliHandler,
  createStartOutputBoundary,
  parseStartTargetInstance,
} from "./start";
import {
  createReceiptExportCliHandler,
  createVerifyCliHandler,
} from "./verify";
import { createUpgradeCliHandler } from "./upgrade";
import { runAgentPackCommandAsCli, type FactoryCliHandler } from "./router";

export function isUnsafeReviewedGeneratorPath(filePath: string): boolean {
  return (
    isAbsolute(filePath) ||
    win32.isAbsolute(filePath) ||
    filePath.split(/[\\/]/u).some((part) => part === "..")
  );
}

export const FACTORY_EXECUTION_POLICY = Object.freeze({
  supportedPlatforms: ["linux", "darwin", "win32"],
  supportedNodeMajors: [22],
  minimumGitVersion: "2.31.0",
  minimumDiskBytes: 512 * 1024 * 1024,
  requiredPorts: [],
  metadataTimeoutMs: 10_000,
  focusedTimeoutMs: 120_000,
  fullTimeoutMs: 30 * 60_000,
  maxBufferBytes: 1024 * 1024,
  packageJsonMaxBytes: 256 * 1024,
}) satisfies NodePreflightPolicy & {
  readonly focusedTimeoutMs: number;
  readonly fullTimeoutMs: number;
};

const execFile = createNodeExecFileAdapter();
const readBoundedFile = async (
  path: string,
  options: { readonly maxBytes: number },
): Promise<string> => {
  const handle = await open(path, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > options.maxBytes) {
      throw new Error("File exceeds the bounded verification read limit.");
    }
    const buffer = Buffer.alloc(options.maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, options.maxBytes + 1, 0);
    if (bytesRead > options.maxBytes) {
      throw new Error("File exceeds the bounded verification read limit.");
    }
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
};
const workflowRules = WORKFLOW_SEMANTICS.map(({ id, subject, status }) => ({
  id,
  subject,
  status,
}));
const publishedWorkflowRuleIds = WORKFLOW_SEMANTICS.map(({ id }) => id);
const descriptors = defineQualityDiagnosticRegistryProjection(
  defineDiagnosticRegistryProjection,
);
const convexMcpProfiles = parseConvexMcpProfiles(
  JSON.parse(
    readFileSync(
      new URL(
        "../../../../docs/template/convex-mcp-profiles.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as unknown,
);

export {
  projectCompositionEnvironment,
  projectCompositionProviderPosture,
} from "./environment";
export type { CompositionEnvironmentReader } from "./environment";

export type FactoryMcpOverrides = {
  readonly start?: { readonly log?: (line: string) => void };
  readonly mcp?: {
    readonly observedTools?: (
      context: AgentPackExecutionContext,
    ) => Promise<readonly string[]>;
    readonly store?: McpConfigurationStore;
  };
};

export function createFactoryCliComposition(
  readEnvironment: CompositionEnvironmentReader,
  overrides: FactoryMcpOverrides = {},
) {
  const preflight = createPreflightCommand(
    createComposedPreflightProbe({
      runtime: createNodePreflightRuntimeReader({
        fs: nodePreflightFileSystem,
        execFile,
        policy: FACTORY_EXECUTION_POLICY,
        workflowRules,
        publishedWorkflowRuleIds,
        environment: readEnvironment,
      }),
      readers: {
        parseTemplateInstance: (raw) =>
          parseStartTargetInstance(raw, parseTemplateInstance, (identity) => {
            const blueprint = buildBlueprintCatalog().find(
              ({ id }) => id === identity.blueprint,
            )?.id;
            if (blueprint === undefined)
              throw new Error("Customer blueprint is not reviewed.");
            return buildTemplateInstance({
              name: identity.name,
              blueprint,
              providerMode: "fake",
              generatedAt: "1970-01-01T00:00:00.000Z",
            });
          }),
        buildTemplateInstance,
        doctorTemplateInstance,
        readSystemCatalog,
        readDataResourceCatalog,
        readProductTopology,
        buildBlueprintCatalog,
        requiredEnvNamesForProvider,
      },
    }),
  );
  const startOutput = createStartOutputBoundary(
    overrides.start?.log ?? ((line) => process.stderr.write(`${line}\n`)),
  );
  const verificationRunner = createExecFileVerificationRunner({
    execFile,
    readFile: readBoundedFile,
    now: () => new Date().toISOString(),
    environment: async (repo) =>
      projectCompositionEnvironmentFingerprintMaterial(repo, readEnvironment),
    providerPosture: async (repo) =>
      projectCompositionProviderFingerprintMaterial({
        repo,
        instance: parseTemplateInstance(
          await readBoundedFile(
            resolve(repo.targetRoot, "template-instance.json"),
            {
              maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
            },
          ),
        ),
        readEnvironment,
        requiredEnvironmentNames: requiredEnvNamesForProvider,
      }),
    limits: FACTORY_EXECUTION_POLICY,
  });
  const start = createComposedStartCommand({
    preflight,
    readFile: readBoundedFile,
    maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
    environment: readEnvironment,
    log: startOutput.write,
    readinessSurface: createNodeBuildReadinessSurface({
      readFile: (path) =>
        readBoundedFile(path, {
          maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
        }),
      current: (repo) => verificationRunner.inspect(repo),
    }),
  });

  const receiptWriter = createNodeVerificationReceiptWriter({
    maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
  });
  const readOnlyVerify = createVerifyCommand({
    descriptors,
    runner: verificationRunner,
  });
  const verify = createVerifyCommand({
    descriptors,
    runner: verificationRunner,
    writer: receiptWriter,
  });
  const verifyExport = createVerificationReceiptExportCommand({
    preflight,
    verify: readOnlyVerify,
    receiptWriter,
  });
  const check = createCheckCommand({ preflight, verify });
  const planCheck = createPlanCheckCommand({
    validate: (plan, repo) =>
      validatePlan(plan, {
        reviewedAdrRefs: readReviewedAdrRefs(
          pathToFileURL(`${repo.sourceRoot}/`),
        ),
      }),
  });
  const inspectPreflightResult = async (
    repo: AgentPackExecutionContext["repo"],
  ) =>
    executeAgentPackCommand(
      preflight,
      { mode: "fake" },
      {
        schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
        invocation: "library",
        repo,
      },
    );
  const inspectMutationPreflight = async (
    repo: AgentPackExecutionContext["repo"],
  ) => {
    const result = await inspectPreflightResult(repo);
    return result.data === null
      ? {
          fingerprint: "preflight_sha256:unavailable",
          safeToMutate: false,
          cleanWorktree: false,
        }
      : {
          fingerprint: result.data.fingerprint,
          safeToMutate: result.data.safeToMutate,
          cleanWorktree: result.data.facts.repository.dirty === false,
        };
  };
  const inspectRecipePreflight = async (
    repo: AgentPackExecutionContext["repo"],
  ) => {
    const result = await inspectPreflightResult(repo);
    if (result.data === null)
      return {
        fingerprint: "recipe_preflight_sha256:unavailable",
        safeToMutate: false,
        cleanWorktree: false,
      };
    const { facts } = result.data;
    const stableMutationEvidence = {
      repo,
      host: facts.host,
      prerequisites: { dependencies: facts.prerequisites.dependencies },
      repository: facts.repository,
      versionsCompatible: facts.versionsCompatible,
      versions: facts.versions,
      workflow: facts.workflow,
      app: facts.app,
    };
    return {
      fingerprint: `recipe_preflight_${sha256RecipeBytes(
        JSON.stringify(stableMutationEvidence),
      )}`,
      safeToMutate: result.data.safeToMutate,
      cleanWorktree: facts.repository.dirty === false,
    };
  };
  const scaffold = createScaffoldCommand({
    generators: {
      resolve: resolveReviewedGenerator,
      run: async ({ generatorId, args, write, repo }) =>
        runReviewedGenerator({
          generatorId,
          args,
          write,
          cwd: repo.targetRoot,
        }),
    },
    preflight: {
      inspect: inspectMutationPreflight,
    },
    workflow: {
      semantics: WORKFLOW_SEMANTICS.map(({ id, status, repair }) => ({
        id,
        status,
        repair,
      })),
      reviewedAdrRefs: (repo) =>
        readReviewedAdrRefs(pathToFileURL(`${repo.sourceRoot}/`)),
    },
  });
  const recipeDependencies = {
    load: (repo: AgentPackExecutionContext["repo"]) =>
      loadRecipeCatalogProjection(repo.sourceRoot),
    generators: {
      resolve: (generatorId: string) => {
        const result = resolveReviewedGenerator(generatorId);
        return result.supported
          ? {
              supported: true as const,
              version: `reviewed-generator-v1:${generatorId}`,
            }
          : { supported: false as const };
      },
      preview: async ({
        generatorId,
        args,
        repo,
      }: {
        readonly generatorId: string;
        readonly args: Readonly<Record<string, string | boolean>>;
        readonly repo: AgentPackExecutionContext["repo"];
      }) => {
        const result = runReviewedGenerator({
          generatorId,
          args,
          write: false,
          cwd: repo.targetRoot,
        });
        if (!result.ok) return result;
        try {
          return {
            ok: true as const,
            output: {
              ...result.output,
              files: result.output.files.map((file) => {
                if (isUnsafeReviewedGeneratorPath(file.path))
                  throw new Error(
                    `Reviewed generator emitted unsafe path ${file.path}.`,
                  );
                const target = resolve(repo.targetRoot, file.path);
                if (!existsSync(target)) return { ...file, beforeSha256: null };
                const stats = lstatSync(target);
                if (!stats.isFile() || stats.isSymbolicLink())
                  throw new Error(
                    `Reviewed generator target is not a regular file: ${file.path}.`,
                  );
                return {
                  ...file,
                  beforeSha256: sha256RecipeBytes(readFileSync(target)),
                };
              }),
            },
          };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Recipe generator preview failed.",
          };
        }
      },
    },
    preflight: { inspect: inspectRecipePreflight },
    transaction: createNodeRecipeTransaction(),
  };
  const recipeHandlers = createRecipeCliHandlers({
    add: createAddRecipeCommand(recipeDependencies),
    recipes: createRecipesCommand(recipeDependencies),
  });
  const providerDoctor = createProviderDoctorCommand({
    adapters: [
      createConvexDoctorAdapter({
        environment: (repo) => {
          const report = projectCompositionEnvironment(repo, readEnvironment);
          return {
            availableEnvironmentNames: report.availableEnvironmentNames
              .split(",")
              .filter(Boolean),
          };
        },
        requiredEnvironmentNames: (repo) =>
          requiredEnvNamesForProvider("convex", {
            repoRoot: repo.sourceRoot,
          }),
        templateProviderReport: async (repo, environment) => {
          try {
            const instance = parseTemplateInstance(
              await readBoundedFile(
                resolve(repo.targetRoot, "template-instance.json"),
                { maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes },
              ),
            );
            const report = doctorTemplateInstance(instance, {
              mode:
                environment === "fake" || environment === "local"
                  ? "fake"
                  : "test",
              repoRoot: repo.sourceRoot,
            });
            const check = report.checks.find(
              ({ id }) => id === "provider:convex",
            );
            return (
              check ?? {
                status: "warn" as const,
                detail:
                  "Convex provider check is absent from the template report.",
              }
            );
          } catch {
            return {
              status: "warn" as const,
              detail:
                "Template instance is unavailable; provider state was not inferred.",
            };
          }
        },
        officialAiFilesFindings: (repo) =>
          validateInstalledOfficialConvexTargets(repo.sourceRoot),
        mcpPolicy: {
          fakeDisabled: true,
          inspectDeployment: "dev",
          productionUnsupported: true,
          alwaysDisabledTools: convexMcpProfiles.alwaysDisabled,
        },
      }),
    ],
  });
  const supportBundle = createSupportBundleCommand({
    load: async () => ({
      host: { kind: "unknown" as const },
      providers: [{ kind: "convex" as const, posture: "unknown" as const }],
    }),
    exporter: createNodeSupportBundleExporter({
      maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
    }),
  });
  const mcpStore =
    overrides.mcp?.store ??
    createRepositoryLocalMcpConfigurationStore({ execFile });
  const observedTools =
    overrides.mcp?.observedTools ??
    ((context: AgentPackExecutionContext) =>
      readInstalledConvexMcpInventory({
        execFile,
        repo: context.repo,
        timeoutMs: FACTORY_EXECUTION_POLICY.metadataTimeoutMs,
        maxBufferBytes: FACTORY_EXECUTION_POLICY.maxBufferBytes,
      }));
  const mcpConfigureCommand = createMcpConfigureCommand({
    contract: convexMcpProfiles,
    observedTools,
    store: mcpStore,
  });
  const mcpConfigure = createMcpConfigureCliAdapter((input, cwd, renderMode) =>
    runAgentPackCommandAsCli(
      mcpConfigureCommand,
      input,
      {
        schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
        invocation: "cli",
        repo: createRepositoryContext({ cwd }),
      },
      renderMode,
    ),
  );
  const mcp = createMcpCliAdapter(({ stdin, stdout, stderr, cwd }) => {
    const repo = createRepositoryContext({ cwd });
    const baseProjection = createMaestroMcpProjection(
      {
        preflight,
        planCheck,
        scaffold,
        supportBundle,
        verify: readOnlyVerify,
      },
      repo,
    );
    const appMapProjection = createAppMapMcpProjection(cwd);
    const appMapToolNames = new Set(
      appMapProjection.tools().map(({ name }) => name),
    );
    const projection = {
      tools: () => [...baseProjection.tools(), ...appMapProjection.tools()],
      call: (name: string, args: Readonly<Record<string, unknown>>) =>
        appMapToolNames.has(name)
          ? appMapProjection.call(name, args)
          : baseProjection.call(name, args),
    };
    const server = createMaestroMcpServer(projection);
    return serveMcpStdio({ stdin, stdout, stderr, server });
  });
  const handlers: readonly FactoryCliHandler[] = [
    ...createAppMapCliHandlers(),
    createCustomerCreateComposition(),
    createAdoptCliHandler({
      readFile: (root, path) =>
        readBoundedAdoptionPacket(
          root,
          path,
          FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
        ),
    }),
    createStartCliHandler(start, startOutput),
    ...recipeHandlers,
    createProviderDoctorCliHandler(providerDoctor),
    createPreflightCliHandler(preflight),
    createVerifyCliHandler(verify),
    createReceiptExportCliHandler(verifyExport),
    createVerifyCliHandler(check),
    createPlanCheckCliHandler(planCheck),
    createScaffoldCliHandler(scaffold),
    createSupportBundleCliHandler(supportBundle),
    createUpgradeCliHandler(),
  ];

  return Object.freeze({
    handlers,
    mcp,
    mcpConfigure,
    diagnosticCount: descriptors.length,
    workflowRuleCount: workflowRules.length,
  });
}
