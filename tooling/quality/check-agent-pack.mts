import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import {
  checkRootSkillProjections,
  checkSkillProjections,
} from "../agent-pack/src/syncSkills.js";

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
  const [generated, root, wiring] = await Promise.all([
    checkSkillProjections(repoRoot),
    checkRootSkillProjections(repoRoot),
    factoryWiringFindings(repoRoot),
  ]);
  return [
    ...generated,
    ...root,
    ...wiring,
    ...(await forbiddenMcpFindings(repoRoot)),
  ];
}

async function factoryWiringFindings(
  repoRoot: string,
): Promise<readonly string[]> {
  const findings: string[] = [];
  const [rootPackage, cliPackage, agentPackPackage] = await Promise.all([
    readJson(join(repoRoot, "package.json")),
    readJson(join(repoRoot, "apps/cli/package.json")),
    readJson(join(repoRoot, "tooling/agent-pack/package.json")),
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
    ].join("\n")
  ) {
    findings.push("factory-wiring:agent-pack-barrel");
  }
  const cliIndex = await optionalText(join(repoRoot, "apps/cli/src/index.ts"));
  const factoryRouter = await optionalText(
    join(repoRoot, "apps/cli/src/factory/router.ts"),
  );
  if (
    cliIndex === undefined ||
    !cliIndex.includes("...createFactoryCliHandlers()") ||
    !cliIndex.includes("...createCliHandlers({") ||
    cliIndex.indexOf("...createFactoryCliHandlers()") >
      cliIndex.indexOf("...createCliHandlers({") ||
    factoryRouter === undefined
  ) {
    findings.push("factory-wiring:router-boundary");
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
