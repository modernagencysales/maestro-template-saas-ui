import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installOfficialConvexBundle } from "../agent-pack/src/officialConvex.js";
import { checkConvexAiFiles } from "./check-convex-ai-files.mts";

describe("check:convex-ai-files", () => {
  it("accepts every installed target and exact managed section", async () => {
    const fixtureRoot = await integratedFixture();
    await expect(checkConvexAiFiles(fixtureRoot)).resolves.toEqual([]);
  });

  it("rejects byte drift in an installed non-marker target", async () => {
    const fixtureRoot = await integratedFixture();
    const target = join(fixtureRoot, ".agents/skills/convex/SKILL.md");
    await writeFile(target, `${await readFile(target, "utf8")}drift\n`);

    await expect(checkConvexAiFiles(fixtureRoot)).resolves.toContain(
      "target-checksum:.agents/skills/convex/SKILL.md",
    );
  });

  it("rejects a changed managed section", async () => {
    const fixtureRoot = await integratedFixture();
    const target = join(fixtureRoot, "AGENTS.md");
    await writeFile(
      target,
      (await readFile(target, "utf8")).replace(
        "This project uses [Convex]",
        "This project once used [Convex]",
      ),
    );

    await expect(checkConvexAiFiles(fixtureRoot)).resolves.toContain(
      "managed-section:AGENTS.md#convex-ai",
    );
  });

  it("requires @AGENTS.md outside the Claude managed marker", async () => {
    const fixtureRoot = await integratedFixture();
    const target = join(fixtureRoot, "CLAUDE.md");
    const content = await readFile(target, "utf8");
    await writeFile(
      target,
      content
        .replace("@AGENTS.md\n\n", "")
        .replace(
          "<!-- convex-ai-end -->",
          "@AGENTS.md\n\n<!-- convex-ai-end -->",
        ),
    );

    await expect(checkConvexAiFiles(fixtureRoot)).resolves.toContain(
      "claude-include:outside-managed-section",
    );
  });
});

async function integratedFixture(): Promise<string> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-ai-check-"));
  await mkdir(join(fixtureRoot, "agent-pack"), { recursive: true });
  await mkdir(join(fixtureRoot, "docs/template"), { recursive: true });
  await cp(
    join(process.cwd(), "agent-pack/official-convex"),
    join(fixtureRoot, "agent-pack/official-convex"),
    { recursive: true },
  );
  for (const file of [
    "convex-ai-files.manifest.json",
    "convex-compatibility.json",
  ]) {
    await cp(
      join(process.cwd(), "docs/template", file),
      join(fixtureRoot, "docs/template", file),
    );
  }
  await installOfficialConvexBundle(fixtureRoot, fixtureRoot);
  return fixtureRoot;
}
