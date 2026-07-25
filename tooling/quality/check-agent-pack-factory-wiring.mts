import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function factoryWiringFindings(
  repoRoot: string,
): Promise<readonly string[]> {
  const findings: string[] = [];
  const [rootPackage, cliPackage, agentPackPackage, stackPackage] =
    await Promise.all([
      readJson(join(repoRoot, "package.json")),
      readJson(join(repoRoot, "apps/cli/package.json")),
      readJson(join(repoRoot, "tooling/agent-pack/package.json")),
      readJson(join(repoRoot, "tooling/stack/package.json")),
    ]);
  if (record(rootPackage.scripts).maestro !== "tsx apps/cli/src/index.ts") {
    findings.push("factory-wiring:root-maestro-script");
  }
  const cliBins = record(cliPackage.bin);
  if (
    cliBins.maestro !== "src/index.ts" ||
    cliBins["maestro-template"] !== "src/index.ts"
  ) {
    findings.push("factory-wiring:cli-binaries");
  }
  const dependencies = record(cliPackage.dependencies);
  if (
    dependencies["@maestro-template/agent-pack"] !== "workspace:*" ||
    dependencies["@maestro-template/generators"] !== "workspace:*" ||
    dependencies["@maestro-template/release-tooling"] !== "workspace:*" ||
    dependencies["@maestro-template/stack-tooling"] !== "workspace:*"
  ) {
    findings.push("factory-wiring:cli-agent-pack-dependency");
  }
  if (
    stackPackage.main !== "index.mts" ||
    stackPackage.types !== "index.mts" ||
    record(stackPackage.exports)["."] !== "./index.mts"
  ) {
    findings.push("factory-wiring:stack-exports");
  }
  if (
    agentPackPackage.main !== "src/index.ts" ||
    agentPackPackage.types !== "src/index.ts" ||
    record(agentPackPackage.exports)["."] !== "./src/index.ts"
  ) {
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
    !includesAll(cliIndex, [
      'import { createFactoryCliComposition } from "./factory/composition";',
      "const factoryCliComposition = createFactoryCliComposition(() => process.env);",
      "export const runCliAsync",
      "dispatchFactoryCliCommand(\n      factoryCliComposition.handlers,",
      'normalized.length === 1 && normalized[0] === "mcp"',
      "factoryCliComposition.mcp.serve(streams)",
      'normalized[0] === "mcp" && normalized[1] === "configure"',
      "factoryCliComposition.mcpConfigure.run(normalized.slice(1), cwd)",
    ]) ||
    !includesAll(factoryRouter, [
      "executeAgentPackCommand",
      "renderAgentPackResult",
      "exitCodeFor",
      "createFactoryCliHandler",
      "handlers: readonly FactoryCliHandler[]",
      "const handler = handlers.find",
    ]) ||
    !includesAll(factoryComposition, [
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
      "createStartCliHandler(start, startOutput)",
      "parseStartTargetInstance(raw, parseTemplateInstance",
      "createPreflightCliHandler(preflight)",
      "createVerifyCliHandler(verify)",
      "createVerifyCliHandler(check)",
      "createPlanCheckCliHandler(planCheck)",
      "createScaffoldCliHandler(scaffold)",
      "createPlanCheckCommand({",
      "createScaffoldCommand({",
      "createMaestroMcpProjection(",
      "createMaestroMcpServer(projection)",
      "createMcpConfigureCommand({",
      "createRepositoryLocalMcpConfigurationStore({ execFile })",
      "readInstalledConvexMcpInventory({",
      "return Object.freeze({\n    handlers,",
      "mcp,\n    mcpConfigure,",
    ]) ||
    !includesAll(factoryStart, [
      "new AsyncLocalStorage<FactoryCliRenderMode>()",
      'renderMode.getStore() !== "json"',
      "output?.run(parsed.renderMode, execute) ?? execute()",
      "readiness: { wait: waitForStartReadiness }",
      "supervise: (specs, readiness)",
      "readiness,",
    ]) ||
    countOccurrences(cliIndex, "createFactoryCliComposition(") !== 1 ||
    countOccurrences(factoryComposition, "createFactoryCliComposition(") !==
      1 ||
    countOccurrences(factoryComposition, "createComposedStartCommand(") !== 1 ||
    factoryComposition?.includes("process.env") === true ||
    factoryComposition?.includes("export const factoryCliComposition") === true
  ) {
    findings.push("factory-wiring:shared-executor-adapter");
  }
  const justfile = await optionalText(join(repoRoot, "Justfile"));
  if (
    justfile === undefined ||
    !justfile.includes("check-agent-pack:\n    pnpm check:agent-pack")
  ) {
    findings.push("factory-wiring:just-recipe");
  }
  return findings;
}

function expectedAgentPackBarrel(): string {
  return [
    'export * from "./contracts.js";',
    'export * from "./exitCodes.js";',
    'export * from "./repoContext.js";',
    'export * from "./preflight.js";',
    'export * from "./diagnostics.js";',
    'export * from "./receipt.js";',
    'export * from "./verify.js";',
    'export * from "./check.js";',
    'export * from "./nodeAdapters.js";',
    'export * from "./preflightProbe.js";',
    'export * from "./verificationRunner.js";',
    'export * from "./planCheck.js";',
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
