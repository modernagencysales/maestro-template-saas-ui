import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
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

  it("tracks every adapted receipt destination after factory compatibility seams", () => {
    const root = resolve(import.meta.dirname, "../..");
    const receipt = JSON.parse(
      readFileSync(
        join(root, "docs/template/saas-ui-starter-files.json"),
        "utf8",
      ),
    ) as {
      files: Array<{ destination: string; sha256: string; adapted: boolean }>;
    };

    for (const file of receipt.files.filter(({ adapted }) => adapted)) {
      const servedSha256 = createHash("sha256")
        .update(readFileSync(join(root, file.destination)))
        .digest("hex");
      expect(servedSha256, file.destination).toBe(file.sha256);
    }
  });
});
