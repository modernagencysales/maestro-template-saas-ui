import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkSkillProjections, syncSkillProjections } from "./syncSkills.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("canonical Maestro skill projections", () => {
  it("keeps Claude and Codex projections byte-equivalent", async () => {
    await expect(checkSkillProjections(repoRoot)).resolves.toEqual([]);
  });

  it("reports a hand-edited projection", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-skill-drift-"));
    await cp(join(repoRoot, "agent-pack"), join(fixtureRoot, "agent-pack"), {
      recursive: true,
    });
    const projection = join(
      fixtureRoot,
      "agent-pack/generated/codex/.agents/skills/maestro/SKILL.md",
    );
    await writeFile(projection, `${await readFile(projection, "utf8")}drift\n`);

    await expect(checkSkillProjections(fixtureRoot)).resolves.toContain(
      "drift:agent-pack/generated/codex/.agents/skills/maestro/SKILL.md",
    );
  });

  it("regenerates both projections from the canonical source", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-skill-sync-"));
    await cp(join(repoRoot, "agent-pack"), join(fixtureRoot, "agent-pack"), {
      recursive: true,
    });
    await writeFile(
      join(fixtureRoot, "agent-pack/skills/maestro/SKILL.md"),
      "---\nname: maestro\ndescription: fixture\n---\n\nFixture.\n",
    );

    await syncSkillProjections(fixtureRoot);
    await expect(checkSkillProjections(fixtureRoot)).resolves.toEqual([]);
    await expect(
      readFile(
        join(fixtureRoot, "agent-pack/plugins/maestro/skills/maestro/SKILL.md"),
        "utf8",
      ),
    ).resolves.toContain("description: fixture");
  });
});
