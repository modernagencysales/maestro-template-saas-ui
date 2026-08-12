import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { transplantStarter } from "./transplant-starter.mts";

describe("pinned starter transplant", () => {
  it("rejects a checkout whose HEAD is not the manifest pin", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "saas-ui-target-"));

    await expect(
      transplantStarter({
        starterRoot: "/Users/headless/.tmp/saas-ui-tanstack-pro",
        targetRoot,
        ids: ["theme"],
        expectedCommit: "definitely-not-the-pinned-commit",
      }),
    ).rejects.toThrow(/expected definitely-not-the-pinned-commit/);
  });

  it("copies the selected source bytes and reports their digests", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "saas-ui-target-"));
    const files = await transplantStarter({
      starterRoot: "/Users/headless/.tmp/saas-ui-tanstack-pro",
      targetRoot,
      ids: ["theme"],
    });

    expect(files.map((file) => file.destination)).toContain(
      join(targetRoot, "src/theme/preset.ts"),
    );
    expect(
      await readFile(join(targetRoot, "src/theme/preset.ts"), "utf8"),
    ).toContain("createSystem(defaultConfig, config)");
    expect(files.every((file) => /^[a-f0-9]{64}$/u.test(file.sha256))).toBe(
      true,
    );
  });
});
