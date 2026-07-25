import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkAgentPack } from "./check-agent-pack.mts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

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

  it("rejects drift in the canonical factory invocation", async () => {
    const fixtureRoot = await integratedFixture();
    const rootPackagePath = join(fixtureRoot, "package.json");
    const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
    rootPackage.scripts.maestro = "tsx tooling/generators/src/index.ts";
    await writeFile(rootPackagePath, JSON.stringify(rootPackage));

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:root-maestro-script",
    );
  });
});

async function integratedFixture(): Promise<string> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-pack-check-"));
  await cp(join(repoRoot, "agent-pack"), join(fixtureRoot, "agent-pack"), {
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
  await cp(join(repoRoot, "package.json"), join(fixtureRoot, "package.json"));
  await cp(join(repoRoot, "Justfile"), join(fixtureRoot, "Justfile"));
  await mkdir(join(fixtureRoot, "apps/cli/src/factory"), { recursive: true });
  await cp(
    join(repoRoot, "apps/cli/package.json"),
    join(fixtureRoot, "apps/cli/package.json"),
  );
  await cp(
    join(repoRoot, "apps/cli/src/index.ts"),
    join(fixtureRoot, "apps/cli/src/index.ts"),
  );
  await cp(
    join(repoRoot, "apps/cli/src/factory/router.ts"),
    join(fixtureRoot, "apps/cli/src/factory/router.ts"),
  );
  await mkdir(join(fixtureRoot, "tooling/agent-pack/src"), { recursive: true });
  await cp(
    join(repoRoot, "tooling/agent-pack/package.json"),
    join(fixtureRoot, "tooling/agent-pack/package.json"),
  );
  await cp(
    join(repoRoot, "tooling/agent-pack/src/index.ts"),
    join(fixtureRoot, "tooling/agent-pack/src/index.ts"),
  );
  return fixtureRoot;
}
