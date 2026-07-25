import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkAgentPack } from "./check-agent-pack.mts";

describe("check:agent-pack", () => {
  it("accepts exact root Maestro projections without MCP configuration", async () => {
    const fixtureRoot = await integratedFixture();
    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual([]);
  });

  it("rejects drift in both root skill projections", async () => {
    const fixtureRoot = await integratedFixture();
    for (const skill of ["maestro", "maestro-convex"]) {
      const target = join(fixtureRoot, ".agents/skills", skill, "SKILL.md");
      await writeFile(target, `${await readFile(target, "utf8")}drift\n`);
    }

    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
      expect.arrayContaining([
        "drift:.agents/skills/maestro/SKILL.md",
        "drift:.agents/skills/maestro-convex/SKILL.md",
      ]),
    );
  });

  it("rejects committed Claude or Codex MCP configuration", async () => {
    const fixtureRoot = await integratedFixture();
    await writeFile(join(fixtureRoot, ".mcp.json"), "{}\n");
    await mkdir(join(fixtureRoot, ".codex"), { recursive: true });
    await writeFile(
      join(fixtureRoot, ".codex/config.toml"),
      '[mcp_servers.convex]\ncommand = "convex"\n',
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
      expect.arrayContaining([
        "forbidden-mcp-config:.mcp.json",
        "forbidden-mcp-config:.codex/config.toml",
      ]),
    );
  });
});

async function integratedFixture(): Promise<string> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-pack-check-"));
  await cp(join(process.cwd(), "agent-pack"), join(fixtureRoot, "agent-pack"), {
    recursive: true,
  });
  await mkdir(join(fixtureRoot, ".agents/skills"), { recursive: true });
  await cp(
    join(fixtureRoot, "agent-pack/generated/codex/.agents/skills/maestro"),
    join(fixtureRoot, ".agents/skills/maestro"),
    { recursive: true },
  );
  await cp(
    join(
      fixtureRoot,
      "agent-pack/plugins/maestro-convex/skills/maestro-convex",
    ),
    join(fixtureRoot, ".agents/skills/maestro-convex"),
    { recursive: true },
  );
  return fixtureRoot;
}
