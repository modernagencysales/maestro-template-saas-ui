import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { transplantStarter } from "./transplant-starter.mts";

const starterRoot = "/Users/headless/.tmp/saas-ui-tanstack-pro";

describe("pinned starter transplant", () => {
  it("rejects a checkout whose HEAD is not the source pin", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "saas-ui-target-"));

    await expect(
      transplantStarter({
        starterRoot,
        targetRoot,
        ids: ["theme"],
        expectedCommit: "definitely-not-the-pinned-commit",
      }),
    ).rejects.toThrow(/expected definitely-not-the-pinned-commit/);
  });

  it("writes a deterministic hash receipt for every copied starter file", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "saas-ui-target-"));
    const receiptPath = join(targetRoot, "starter-files.json");
    const files = await transplantStarter({
      starterRoot,
      targetRoot,
      ids: ["theme", "provider"],
      receiptPath,
    });

    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as {
      sourceCommit: string;
      files: Array<{ destination: string; sha256: string }>;
    };
    expect(receipt.sourceCommit).toBe(
      "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
    );
    expect(receipt.files).toHaveLength(files.length);
    for (const file of files) {
      expect(receipt.files).toContainEqual(
        expect.objectContaining({
          destination: expect.stringContaining(
            relative(targetRoot, file.destination),
          ),
          sha256: file.sha256,
        }),
      );
    }
  });
});
