import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  installOfficialConvexBundle,
  removeOfficialConvexBundle,
  validateOfficialConvexBundle,
} from "./officialConvex.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("official Convex AI files", () => {
  it("matches the pinned CLI, installer, commit, lock, and file checksums", async () => {
    await expect(validateOfficialConvexBundle(repoRoot)).resolves.toEqual([]);
  });

  it("detects committed bundle drift offline", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-convex-drift-"));
    await mkdir(join(fixtureRoot, "agent-pack"), { recursive: true });
    await mkdir(join(fixtureRoot, "docs/template"), { recursive: true });
    await cp(
      join(repoRoot, "agent-pack/official-convex"),
      join(fixtureRoot, "agent-pack/official-convex"),
      { recursive: true },
    );
    await cp(
      join(repoRoot, "docs/template/convex-ai-files.manifest.json"),
      join(fixtureRoot, "docs/template/convex-ai-files.manifest.json"),
    );
    await cp(
      join(repoRoot, "docs/template/convex-compatibility.json"),
      join(fixtureRoot, "docs/template/convex-compatibility.json"),
    );
    const guidelines = join(
      fixtureRoot,
      "agent-pack/official-convex/managed/guidelines.md",
    );
    await writeFile(guidelines, `${await readFile(guidelines, "utf8")}drift\n`);

    await expect(validateOfficialConvexBundle(fixtureRoot)).resolves.toContain(
      "checksum:agent-pack/official-convex/managed/guidelines.md",
    );
  });

  it("projects and removes only exact owned files without network metadata", async () => {
    const fixtureRoot = await mkdtemp(
      join(tmpdir(), "maestro-convex-install-"),
    );
    await writeFile(join(fixtureRoot, "customer-code.txt"), "preserve\n");

    const receipt = await installOfficialConvexBundle(repoRoot, fixtureRoot);
    expect(receipt.installed).toContain(
      "packages/convex/convex/_generated/ai/guidelines.md",
    );
    expect(receipt.installed).toContain(".claude/skills/convex/SKILL.md");
    expect(receipt.installed).toContain(".agents/skills/convex/SKILL.md");
    expect(receipt.installed).not.toContain(".mcp.json");

    const removal = await removeOfficialConvexBundle(repoRoot, fixtureRoot);
    expect(removal.refused).toEqual([]);
    await expect(
      readFile(join(fixtureRoot, "customer-code.txt"), "utf8"),
    ).resolves.toBe("preserve\n");
  });

  it("refuses to remove a user-modified owned file", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-convex-remove-"));
    await installOfficialConvexBundle(repoRoot, fixtureRoot);
    const target = join(fixtureRoot, ".agents/skills/convex/SKILL.md");
    await writeFile(target, `${await readFile(target, "utf8")}user edit\n`);

    const removal = await removeOfficialConvexBundle(repoRoot, fixtureRoot);
    expect(removal.refused).toEqual([".agents/skills/convex/SKILL.md"]);
    await expect(readFile(target, "utf8")).resolves.toContain("user edit");
  });
});
