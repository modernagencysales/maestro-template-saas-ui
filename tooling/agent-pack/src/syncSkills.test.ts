import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkRootSkillProjections,
  checkSkillProjections,
  syncSkillProjections,
} from "./syncSkills.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("canonical Maestro skill projections", () => {
  it("keeps the Claude and committed Codex projections byte-equivalent", async () => {
    await expect(checkSkillProjections(repoRoot)).resolves.toEqual([]);
    await expect(checkRootSkillProjections(repoRoot)).resolves.toEqual([]);
  });

  it("reports a hand-edited projection", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-skill-drift-"));
    await cp(join(repoRoot, "agent-pack"), join(fixtureRoot, "agent-pack"), {
      recursive: true,
    });
    const projection = join(
      fixtureRoot,
      "agent-pack/plugins/maestro/skills/maestro/SKILL.md",
    );
    await writeFile(projection, `${await readFile(projection, "utf8")}drift\n`);

    await expect(checkSkillProjections(fixtureRoot)).resolves.toContain(
      "drift:agent-pack/plugins/maestro/skills/maestro/SKILL.md",
    );
  });

  it("regenerates the Claude and committed Codex projections from the canonical source", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-skill-sync-"));
    await cp(join(repoRoot, "agent-pack"), join(fixtureRoot, "agent-pack"), {
      recursive: true,
    });
    await writeFile(
      join(fixtureRoot, "agent-pack/skills/maestro/SKILL.md"),
      "---\nname: maestro\ndescription: fixture\n---\n\nFixture.\n",
    );
    await cp(
      join(
        fixtureRoot,
        "agent-pack/plugins/maestro-convex/skills/maestro-convex",
      ),
      join(fixtureRoot, ".agents/skills/maestro-convex"),
      { recursive: true },
    );

    await syncSkillProjections(fixtureRoot);
    await expect(checkSkillProjections(fixtureRoot)).resolves.toEqual([]);
    await expect(checkRootSkillProjections(fixtureRoot)).resolves.toEqual([]);
    await expect(
      readFile(
        join(fixtureRoot, "agent-pack/plugins/maestro/skills/maestro/SKILL.md"),
        "utf8",
      ),
    ).resolves.toContain("description: fixture");
    await expect(
      readFile(join(fixtureRoot, ".agents/skills/maestro/SKILL.md"), "utf8"),
    ).resolves.toContain("description: fixture");
  });

  it("does not synchronize the removed Codex compatibility projection", async () => {
    await expect(
      readFile(join(repoRoot, "tooling/agent-pack/src/syncSkills.ts"), "utf8"),
    ).resolves.not.toContain(
      "agent-pack/generated/codex/.agents/skills/maestro",
    );
  });
});
