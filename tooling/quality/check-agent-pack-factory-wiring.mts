import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function factoryWiringFindings(
  repoRoot: string,
): Promise<readonly string[]> {
  const findings: string[] = [];
  const [rootPackage, cliPackage, agentPackPackage] = await Promise.all([
    readJson(join(repoRoot, "package.json")),
    readJson(join(repoRoot, "apps/cli/package.json")),
    readJson(join(repoRoot, "tooling/agent-pack/package.json")),
  ]);
  if (hasInvalidRootScript(rootPackage)) {
    findings.push("factory-wiring:root-maestro-script");
  }
  if (hasInvalidCliBins(cliPackage)) {
    findings.push("factory-wiring:cli-binaries");
  }
  if (hasInvalidCliDependencies(cliPackage)) {
    findings.push("factory-wiring:cli-agent-pack-dependency");
  }
  if ((await optionalText(join(repoRoot, "Justfile"))) !== undefined) {
    findings.push("factory-wiring:obsolete-just-authority");
  }
  if (
    (await optionalText(join(repoRoot, "tooling/stack/package.json"))) !==
    undefined
  ) {
    findings.push("factory-wiring:obsolete-stack-authority");
  }
  if (hasInvalidAgentPackExports(agentPackPackage)) {
    findings.push("factory-wiring:agent-pack-exports");
  }
  const barrel = await optionalText(
    join(repoRoot, "tooling/agent-pack/src/index.ts"),
  );
  if (barrel?.trim() !== expectedAgentPackBarrel()) {
    findings.push("factory-wiring:agent-pack-barrel");
  }
  const cliIndex = await optionalText(join(repoRoot, "apps/cli/src/index.ts"));
  const factoryRouter = await optionalText(
    join(repoRoot, "apps/cli/src/factory/router.ts"),
  );
  const factoryComposition = await optionalText(
    join(repoRoot, "apps/cli/src/factory/composition.ts"),
  );
  const factoryStart = await optionalText(
    join(repoRoot, "apps/cli/src/factory/start.ts"),
  );
  if (
    hasInvalidCompositionWiring(
      cliIndex,
      factoryRouter,
      factoryComposition,
      factoryStart,
    )
  ) {
    findings.push("factory-wiring:shared-executor-adapter");
  }
  return findings;
}

function hasInvalidRootScript(rootPackage: Record<string, unknown>): boolean {
  return record(rootPackage.scripts).maestro !== "tsx apps/cli/src/index.ts";
}

function hasInvalidCliBins(cliPackage: Record<string, unknown>): boolean {
  const cliBins = record(cliPackage.bin);
  return (
    cliBins.maestro !== "src/index.ts" ||
    cliBins["maestro-template"] !== "src/index.ts"
  );
}

function hasInvalidCliDependencies(
  cliPackage: Record<string, unknown>,
): boolean {
  const dependencies = record(cliPackage.dependencies);
  return (
    dependencies["@maestro-template/agent-pack"] !== "workspace:*" ||
    dependencies["@maestro-template/generators"] !== "workspace:*" ||
    dependencies["@maestro-template/release-tooling"] !== "workspace:*" ||
    "@maestro-template/stack-tooling" in dependencies
  );
}

function hasInvalidAgentPackExports(
  agentPackPackage: Record<string, unknown>,
): boolean {
  return (
    agentPackPackage.main !== "src/index.ts" ||
    agentPackPackage.types !== "src/index.ts" ||
    record(agentPackPackage.exports)["."] !== "./src/index.ts"
  );
}

function hasInvalidCompositionWiring(
  cliIndex: string | undefined,
  factoryRouter: string | undefined,
  factoryComposition: string | undefined,
  factoryStart: string | undefined,
): boolean {
  return (
    hasMissingCompositionSource(
      cliIndex,
      factoryRouter,
      factoryComposition,
      factoryStart,
    ) ||
    hasInvalidCompositionCounts(cliIndex, factoryComposition) ||
    hasUnsafeCompositionSource(factoryComposition)
  );
}

function hasMissingCompositionSource(
  cliIndex: string | undefined,
  factoryRouter: string | undefined,
  factoryComposition: string | undefined,
  factoryStart: string | undefined,
): boolean {
  return (
    !includesAll(cliIndex, REQUIRED_CLI_INDEX_SOURCE) ||
    !includesAll(factoryRouter, REQUIRED_FACTORY_ROUTER_SOURCE) ||
    !includesAll(factoryComposition, REQUIRED_FACTORY_COMPOSITION_SOURCE) ||
    !includesAll(factoryStart, REQUIRED_FACTORY_START_SOURCE)
  );
}

function hasInvalidCompositionCounts(
  cliIndex: string | undefined,
  factoryComposition: string | undefined,
): boolean {
  return (
    countOccurrences(cliIndex, "createFactoryCliComposition(") !== 1 ||
    countOccurrences(factoryComposition, "createFactoryCliComposition(") !==
      1 ||
    countOccurrences(factoryComposition, "createComposedStartCommand(") !== 1 ||
    countOccurrences(factoryComposition, "createNodeBuildReadinessSurface(") !==
      1 ||
    countOccurrences(
      factoryComposition,
      "createNodeVerificationReceiptWriter(",
    ) !== 1
  );
}

function hasUnsafeCompositionSource(
  factoryComposition: string | undefined,
): boolean {
  return (
    factoryComposition?.includes("process.env") === true ||
    factoryComposition?.includes("export const factoryCliComposition") ===
      true ||
    factoryComposition?.includes("createPlanCheck") === true ||
    factoryComposition?.includes("planCheck") === true
  );
}

const REQUIRED_CLI_INDEX_SOURCE = [
  'import { createFactoryCliComposition } from "./factory/composition";',
  "const factoryCliComposition = createFactoryCliComposition(() => process.env);",
  "export const runCliAsync",
  "dispatchFactoryCliCommand(\n      factoryCliComposition.handlers,",
  'normalized.length === 1 && normalized[0] === "mcp"',
  "factoryCliComposition.mcp.serve(streams)",
  'normalized[0] === "mcp" && normalized[1] === "configure"',
  "factoryCliComposition.mcpConfigure.run(normalized.slice(1), cwd)",
] as const;

const REQUIRED_FACTORY_ROUTER_SOURCE = [
  "executeAgentPackCommand",
  "renderAgentPackResult",
  "exitCodeFor",
  "createFactoryCliHandler",
  "handlers: readonly FactoryCliHandler[]",
  "const handler = handlers.find",
] as const;

const REQUIRED_FACTORY_COMPOSITION_SOURCE = [
  "const execFile = createNodeExecFileAdapter();",
  "export function createFactoryCliComposition(",
  "overrides: FactoryMcpOverrides = {},",
  "runtime: createNodePreflightRuntimeReader({\n        fs: nodePreflightFileSystem,\n        execFile,",
  "environment: readEnvironment,",
  "const descriptors = defineQualityDiagnosticRegistryProjection(\n  defineDiagnosticRegistryProjection,\n);",
  "const verificationRunner = createExecFileVerificationRunner({\n    execFile,",
  "projectCompositionEnvironment(repo, readEnvironment)",
  "createCustomerCreateComposition()",
  "overrides.start?.log ?? ((line) => process.stderr.write(`${line}\\n`))",
  "createComposedStartCommand({",
  "createNodeBuildReadinessSurface({",
  "const receiptWriter = createNodeVerificationReceiptWriter({",
  "writer: receiptWriter,",
  "const readOnlyVerify = createVerifyCommand({",
  "verify: readOnlyVerify,",
  "receiptWriter,",
  "createStartCliHandler(start, startOutput)",
  "parseStartTargetInstance(raw, parseTemplateInstance",
  "createPreflightCliHandler(preflight)",
  "createVerifyCliHandler(verify)",
  "createVerifyCliHandler(check)",
  "createScaffoldCliHandler(scaffold)",
  "createScaffoldCommand({",
  "createMaestroMcpProjection(",
  "createMaestroMcpServer(projection)",
  "createMcpConfigureCommand({",
  "createRepositoryLocalMcpConfigurationStore({ execFile })",
  "readInstalledConvexMcpInventory({",
  "return Object.freeze({\n    handlers,",
  "mcp,\n    mcpConfigure,",
] as const;

const REQUIRED_FACTORY_START_SOURCE = [
  "new AsyncLocalStorage<FactoryCliRenderMode>()",
  'renderMode.getStore() !== "json"',
  "output?.run(parsed.renderMode, execute) ?? execute()",
  "readiness: { wait: waitForStartReadiness }",
  "supervise: (specs, readiness)",
  "readiness,",
] as const;

function expectedAgentPackBarrel(): string {
  return [
    'export * from "./contracts.js";',
    'export * from "./exitCodes.js";',
    'export * from "./repoContext.js";',
    'export * from "./preflight.js";',
    'export * from "./diagnostics.js";',
    'export * from "./receipt.js";',
    'export * from "./receiptWriter.js";',
    'export * from "./recipes.js";',
    'export * from "./recipeTransaction.js";',
    'export * from "./verify.js";',
    'export * from "./check.js";',
    'export * from "./nodeAdapters.js";',
    'export * from "./officialConvex.js";',
    'export * from "./hostProjectionLifecycle.js";',
    'export * from "./preflightProbe.js";',
    'export * from "./providers/convex.js";',
    'export * from "./providers/doctor.js";',
    'export * from "./readiness/index.js";',
    'export * from "./verificationRunner.js";',
    'export * from "./scaffold.js";',
    'export * from "./create.js";',
    'export * from "./ports.js";',
    'export * from "./processSupervisor.js";',
    'export * from "./start.js";',
    'export * from "./pluginContract.js";',
    'export * from "./mcp/protocol.js";',
    'export * from "./mcp/projection.js";',
    'export * from "./mcp/server.js";',
    'export * from "./mcp/convexProfiles.js";',
    'export * from "./mcp/configure.js";',
    'export * from "./mcp/nodeConfigure.js";',
    'export * from "./privacy/disclosure.js";',
    'export * from "./privacy/supportBundle.js";',
    'export * from "./privacy/supportBundleCommand.js";',
    'export * from "./privacy/nodeSupportBundleExporter.js";',
    'export * from "./adopt.js";',
    'export * from "./adoptAuthority.js";',
    'export * from "./adoptExecution.js";',
    'export * from "./adoptCheckpoint.js";',
    'export { verifyAdoptionReceipt } from "./adoptReceiptVerifier.js";',
    "export type {",
    "  AdoptionReceipt,",
    "  AdoptionReceiptFinding,",
    "  AdoptionReceiptVerification,",
    '} from "./adoptReceipt.js";',
  ].join("\n");
}

function countOccurrences(
  source: string | undefined,
  fragment: string,
): number {
  if (source === undefined || fragment.length === 0) return 0;
  return source.split(fragment).length - 1;
}

function includesAll(
  source: string | undefined,
  fragments: readonly string[],
): boolean {
  return (
    source !== undefined && fragments.every((part) => source.includes(part))
  );
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const text = await optionalText(path);
  if (text === undefined) return {};
  const value: unknown = JSON.parse(text);
  return record(value);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function optionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

function errorCode(error: unknown): unknown {
  if (error === null || typeof error !== "object") return undefined;
  return Object.fromEntries(Object.entries(error)).code;
}
