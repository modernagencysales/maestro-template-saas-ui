import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { installHostProjection } from "./hostInstall.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("host installation boundary", () => {
  it("refuses a symlink that would redirect writes outside the disposable home", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "maestro-codex-symlink-"));
    const outside = await mkdtemp(join(tmpdir(), "maestro-host-outside-"));
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "preserve.txt"), "outside\n");
    await symlink(outside, join(homeDir, ".codex"), "dir");

    await expect(
      installHostProjection({ host: "codex", repoRoot, homeDir }),
    ).rejects.toThrow(/symlink/i);
    await expect(readFile(join(outside, "preserve.txt"), "utf8")).resolves.toBe(
      "outside\n",
    );
  });
});
