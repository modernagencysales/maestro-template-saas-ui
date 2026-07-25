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
  const [generated, root] = await Promise.all([
    checkSkillProjections(repoRoot),
    checkRootSkillProjections(repoRoot),
  ]);
  return [...generated, ...root, ...(await forbiddenMcpFindings(repoRoot))];
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
