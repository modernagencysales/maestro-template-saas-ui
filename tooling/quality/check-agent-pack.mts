import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import {
  checkRootSkillProjections,
  checkSkillProjections,
} from "../agent-pack/src/syncSkills.js";
import { AGENT_PACK_COMMAND_VERSION } from "../agent-pack/src/contracts.js";
import {
  evaluateReceiptStaleness,
  summarizeVerificationReceipt,
  VERIFICATION_RECEIPT_VERSION,
  type VerificationReceipt,
} from "../agent-pack/src/receipt.js";

const FORBIDDEN_MCP_FILES = [
  ".mcp.json",
  ".claude/.mcp.json",
  ".claude/mcp.json",
  ".agents/mcp.json",
  ".codex/mcp.json",
] as const;

export async function checkAgentPack(
  repoRoot: string,
): Promise<readonly string[]> {
  const [generated, root, wiring, verification] = await Promise.all([
    checkSkillProjections(repoRoot),
    checkRootSkillProjections(repoRoot),
    factoryWiringFindings(repoRoot),
    verificationArtifactFindings(repoRoot),
  ]);
  return [
    ...generated,
    ...root,
    ...wiring,
    ...verification,
    ...(await forbiddenMcpFindings(repoRoot)),
  ];
}

async function factoryWiringFindings(
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
  if (
    record(cliPackage.dependencies)["@maestro-template/agent-pack"] !==
      "workspace:*" ||
    record(cliPackage.dependencies)["@maestro-template/generators"] !==
      "workspace:*" ||
    record(cliPackage.dependencies)["@maestro-template/stack-tooling"] !==
      "workspace:*"
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
  if (
    barrel?.trim() !==
    [
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
    ].join("\n")
  ) {
    findings.push("factory-wiring:agent-pack-barrel");
  }
  const cliIndex = await optionalText(join(repoRoot, "apps/cli/src/index.ts"));
  const factoryRouter = await optionalText(
    join(repoRoot, "apps/cli/src/factory/router.ts"),
  );
  const factoryComposition = await optionalText(
    join(repoRoot, "apps/cli/src/factory/composition.ts"),
  );
  if (
    !includesAll(cliIndex, [
      'import { createFactoryCliComposition } from "./factory/composition";',
      "const factoryCliComposition = createFactoryCliComposition(() => process.env);",
      "export const runCliAsync",
      "dispatchFactoryCliCommand(\n      factoryCliComposition.handlers,",
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
      "export function createFactoryCliComposition(\n  readEnvironment: CompositionEnvironmentReader,\n) {",
      "runtime: createNodePreflightRuntimeReader({\n        fs: nodePreflightFileSystem,\n        execFile,",
      "environment: readEnvironment,",
      "const descriptors = defineQualityDiagnosticRegistryProjection(\n  defineDiagnosticRegistryProjection,\n);",
      "const verificationRunner = createExecFileVerificationRunner({\n    execFile,",
      "projectCompositionEnvironment(repo, readEnvironment)",
      "createPreflightCliHandler(preflight)",
      "createVerifyCliHandler(verify)",
      "createVerifyCliHandler(check)",
      "createPlanCheckCliHandler(planCheck)",
      "createScaffoldCliHandler(scaffold)",
      "createPlanCheckCommand({",
      "createScaffoldCommand({",
      "return Object.freeze({\n    handlers,",
    ]) ||
    countOccurrences(cliIndex, "createFactoryCliComposition(") !== 1 ||
    countOccurrences(factoryComposition, "createFactoryCliComposition(") !==
      1 ||
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

const RECEIPT_EXAMPLES = ["pass.json", "advisory.json", "stale.json"] as const;
const REQUIRED_DOC_LINKS = [
  ["docs/template/quickstart.md", "./preflight.md"],
  ["docs/template/claude-code-setup.md", "./preflight.md"],
  ["docs/template/codex-setup.md", "./preflight.md"],
  ["docs/template/repo-map.md", "docs/template/preflight.md"],
  ["docs/template/reviewer-guide.md", "./verification-receipts.md"],
  ["docs/template/operations-runbook.md", "./verification-receipts.md"],
] as const;

async function verificationArtifactFindings(
  repoRoot: string,
): Promise<readonly string[]> {
  const findings: string[] = [];
  const schemaPath = join(
    repoRoot,
    "schemas/maestro-verification-receipt.schema.json",
  );
  const schema = await readJsonValue(schemaPath);
  if (schema === undefined) {
    findings.push("verification-receipt:missing-schema");
  } else {
    const schemaProperties = record(record(schema).properties);
    if (
      record(schemaProperties.schemaVersion).const !==
        VERIFICATION_RECEIPT_VERSION ||
      record(record(record(schemaProperties.command).properties).version)
        .const !== AGENT_PACK_COMMAND_VERSION
    ) {
      findings.push("verification-receipt:schema-version");
    }
  }

  for (const name of RECEIPT_EXAMPLES) {
    const value = await readJsonValue(
      join(repoRoot, "docs/template/examples/receipts", name),
    );
    if (value === undefined) {
      findings.push(`verification-receipt:missing-example:${name}`);
      continue;
    }
    if (schema !== undefined) {
      const errors = validateJsonSchema(value, schema, "$");
      if (errors.length > 0) {
        findings.push(
          `verification-receipt:invalid-example:${name}:${errors[0]}`,
        );
        continue;
      }
    }
    const receipt = value as VerificationReceipt;
    if (
      (name === "pass.json" &&
        summarizeVerificationReceipt(receipt).status !== "pass") ||
      (name === "advisory.json" &&
        summarizeVerificationReceipt(receipt).status !==
          "pass-with-advisories") ||
      (name === "stale.json" &&
        !evaluateReceiptStaleness(receipt, {
          subject: receipt.subject,
          environmentFingerprint: receipt.fingerprints.environment,
          providerPostureFingerprint: receipt.fingerprints.providerPosture,
        }).reasons.includes("partial-scope"))
    ) {
      findings.push(`verification-receipt:example-meaning:${name}`);
    }
  }

  for (const [path, link] of REQUIRED_DOC_LINKS) {
    const text = await optionalText(join(repoRoot, path));
    if (text === undefined || !text.includes(link)) {
      findings.push(`agent-pack-doc-link:${path}:${link}`);
    }
  }
  return findings;
}

async function readJsonValue(path: string): Promise<unknown | undefined> {
  const text = await optionalText(path);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { __invalidJson: true };
  }
}

function validateJsonSchema(
  value: unknown,
  rawSchema: unknown,
  path: string,
): readonly string[] {
  const schema = record(rawSchema);
  const errors: string[] = [];
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter(
      (candidate) => validateJsonSchema(value, candidate, path).length === 0,
    ).length;
    if (matches !== 1) {
      errors.push(`${path} must match exactly one oneOf schema`);
    }
  }
  if ("const" in schema && !jsonEqual(value, schema.const)) {
    errors.push(`${path} must equal the schema constant`);
  }
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((item) => jsonEqual(value, item))
  ) {
    errors.push(`${path} is outside the schema enum`);
  }
  if (schema.type === "object") {
    if (!isRecord(value)) return [...errors, `${path} must be an object`];
    const properties = record(schema.properties);
    for (const required of Array.isArray(schema.required)
      ? schema.required
      : []) {
      if (typeof required === "string" && !(required in value)) {
        errors.push(`${path}.${required} is required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(
          ...validateJsonSchema(value[key], childSchema, `${path}.${key}`),
        );
      }
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [...errors, `${path} must be an array`];
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${path} has more than maxItems`);
    }
    value.forEach((item, index) => {
      errors.push(
        ...validateJsonSchema(item, schema.items, `${path}[${index}]`),
      );
    });
  } else if (schema.type === "string") {
    if (typeof value !== "string")
      return [...errors, `${path} must be a string`];
    if (
      typeof schema.minLength === "number" &&
      value.length < schema.minLength
    ) {
      errors.push(`${path} is shorter than minLength`);
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${path} must be a date-time`);
    }
  } else if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path} must be a boolean`);
  }
  return errors;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

async function forbiddenMcpFindings(
  repoRoot: string,
): Promise<readonly string[]> {
  const findings: string[] = [];
  for (const path of FORBIDDEN_MCP_FILES) {
    if ((await optionalText(join(repoRoot, path))) !== undefined) {
      findings.push(`forbidden-mcp-config:${path}`);
    }
  }
  const codex = await optionalText(join(repoRoot, ".codex/config.toml"));
  if (codex !== undefined && /\bmcp(?:_servers?)?\b/i.test(codex)) {
    findings.push("forbidden-mcp-config:.codex/config.toml");
  }
  const claude = await optionalText(join(repoRoot, ".claude/settings.json"));
  if (
    claude !== undefined &&
    (/"mcpServers"\s*:/.test(claude) ||
      /"enableAllProjectMcpServers"\s*:\s*true/.test(claude))
  ) {
    findings.push("forbidden-mcp-config:.claude/settings.json");
  }
  return findings;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = await checkAgentPack(process.cwd());
  if (findings.length > 0) {
    console.error(
      `Agent Pack drift:\n${findings.map((finding) => `- ${finding}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("Agent Pack root projections and MCP posture are valid.");
}
