import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverHostProjection,
  installHostProjection,
  removeHostProjection,
} from "./hostInstall.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const temporaryHomes: string[] = [];

async function temporaryHome(): Promise<string> {
  const homeDir = await mkdtemp(join(tmpdir(), "maestro-codex-home-"));
  temporaryHomes.push(homeDir);
  return homeDir;
}

afterEach(async () => {
  await Promise.all(
    temporaryHomes
      .splice(0)
      .map((homeDir) => rm(homeDir, { recursive: true, force: true })),
  );
});

describe("Codex skill distribution", () => {
  it("discovers equivalent committed context without configuring MCP", async () => {
    const homeDir = await temporaryHome();
    const canonicalSkill = join(repoRoot, "agent-pack/skills/maestro/SKILL.md");
    const canonicalBefore = await readFile(canonicalSkill, "utf8");
    await installHostProjection({ host: "codex", repoRoot, homeDir });

    await expect(
      discoverHostProjection({ host: "codex", homeDir }),
    ).resolves.toEqual({
      maestro: true,
      maestroConvex: true,
      officialConvexSkills: [
        "convex",
        "convex-create-component",
        "convex-migration-helper",
        "convex-performance-audit",
        "convex-quickstart",
        "convex-setup-auth",
      ],
      mcpConfigured: false,
    });

    await expect(
      readFile(join(homeDir, ".codex/config.toml"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(join(homeDir, ".mcp.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(canonicalSkill, "utf8")).resolves.toBe(
      canonicalBefore,
    );
  });

  it("preserves unrelated files and removes exactly receipt-owned files", async () => {
    const homeDir = await temporaryHome();
    const unrelated = join(homeDir, ".codex/skills/customer/SKILL.md");
    await mkdir(join(homeDir, ".codex/skills/customer"), { recursive: true });
    await writeFile(unrelated, "# Customer-owned skill\n");

    const receipt = await installHostProjection({
      host: "codex",
      repoRoot,
      homeDir,
    });
    expect(receipt.files.length).toBeGreaterThan(0);
    expect(receipt.files.every((file) => file.sha256.length === 64)).toBe(true);
    expect(
      receipt.files.some((file) => file.path.endsWith(".codex/config.toml")),
    ).toBe(false);
    expect(receipt.files.some((file) => file.path.includes("/.convex/"))).toBe(
      false,
    );

    const removal = await removeHostProjection(receipt);
    expect(removal.refused).toEqual([]);
    expect(removal.removed).toEqual(
      receipt.files.map((file) => file.path).sort(),
    );
    await expect(readFile(unrelated, "utf8")).resolves.toBe(
      "# Customer-owned skill\n",
    );
    await expect(
      discoverHostProjection({ host: "codex", homeDir }),
    ).resolves.toEqual({
      maestro: false,
      maestroConvex: false,
      officialConvexSkills: [],
      mcpConfigured: false,
    });
  });

  it("refuses removal when an installed file was modified", async () => {
    const homeDir = await temporaryHome();
    const receipt = await installHostProjection({
      host: "codex",
      repoRoot,
      homeDir,
    });
    const skillPath = join(homeDir, ".codex/skills/maestro/SKILL.md");
    await writeFile(
      skillPath,
      `${await readFile(skillPath, "utf8")}\nUser customization.\n`,
    );

    const removal = await removeHostProjection(receipt);
    expect(removal.refused).toEqual([skillPath]);
    await expect(readFile(skillPath, "utf8")).resolves.toContain(
      "User customization.",
    );
  });

  it("rejects a real home path instead of mutating it", async () => {
    const realLookingHome = join(tmpdir(), "not-a-maestro-disposable-home");

    await expect(
      installHostProjection({
        host: "codex",
        repoRoot,
        homeDir: realLookingHome,
      }),
    ).rejects.toThrow(/disposable temporary home/i);
  });

  it("ships Codex-native Maestro metadata without an MCP declaration", async () => {
    const metadata = await readFile(
      join(repoRoot, "agent-pack/skills/maestro/agents/openai.yaml"),
      "utf8",
    );

    expect(metadata).toContain('display_name: "Maestro"');
    expect(metadata).toContain("allow_implicit_invocation: true");
    expect(metadata).not.toMatch(/\bmcp(?:_servers?)?\s*:/i);
  });
});
