import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  transplantStarter,
  verifyStarterSourceCommit,
} from "./transplant-starter.mts";

const starterRoot = "/Users/headless/.tmp/saas-ui-tanstack-pro";

describe("pinned starter transplant", () => {
  it("rejects dirty Starter source even when HEAD matches the pin", async () => {
    const source = await mkdtemp(join(tmpdir(), "saas-ui-starter-source-"));
    execFileSync("git", ["init"], { cwd: source });
    execFileSync("git", ["config", "user.name", "Saas UI test"], {
      cwd: source,
    });
    execFileSync("git", ["config", "user.email", "saas-ui@example.test"], {
      cwd: source,
    });
    await mkdir(join(source, "apps/web/src"), { recursive: true });
    await writeFile(
      join(source, "apps/web/src/source.ts"),
      "export const clean = true;\n",
    );
    execFileSync("git", ["add", "apps/web/src/source.ts"], { cwd: source });
    execFileSync("git", ["commit", "-m", "test source"], { cwd: source });
    const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: source,
      encoding: "utf8",
    }).trim();
    await writeFile(join(source, "apps/web/src/untracked.ts"), "dirty\n");

    expect(() => verifyStarterSourceCommit(source, expectedCommit)).toThrow(
      /working tree is not clean/,
    );
  });

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

  it("receipts the exact Starter support-package closure", () => {
    const root = resolve(import.meta.dirname, "../..");
    const receipt = JSON.parse(
      readFileSync(
        join(root, "docs/template/saas-ui-starter-files.json"),
        "utf8",
      ),
    ) as { files: Array<{ source: string; destination: string }> };
    const receiptedSources = new Set(receipt.files.map(({ source }) => source));
    const expectedSources = execFileSync(
      "git",
      [
        "ls-tree",
        "-r",
        "--name-only",
        "HEAD",
        "--",
        "packages/config",
        "packages/i18n",
        "packages/ui",
      ],
      { cwd: starterRoot, encoding: "utf8" },
    )
      .trim()
      .split("\n");

    expect(expectedSources.length).toBeGreaterThan(0);
    for (const source of expectedSources) {
      expect(receiptedSources.has(source), source).toBe(true);
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

  it("receipts the literal Starter error and navigation component closure", () => {
    const root = resolve(import.meta.dirname, "../..");
    const receipt = JSON.parse(
      readFileSync(
        join(root, "docs/template/saas-ui-starter-files.json"),
        "utf8",
      ),
    ) as {
      files: Array<{
        source: string;
        destination: string;
        sourceSha256: string;
        sha256: string;
        adapted: boolean;
      }>;
    };
    for (const path of [
      "apps/web/src/components/default-error-page.tsx",
      "apps/web/src/components/default-loader.tsx",
      "apps/web/src/components/link-button.tsx",
    ]) {
      const file = receipt.files.find(
        ({ destination }) => destination === path,
      );
      expect(file).toMatchObject({
        source: path,
        adapted: false,
      });
      expect(file?.sourceSha256).toBe(file?.sha256);
    }
  });

  it("maps every owned Starter projection to its pinned source", () => {
    const root = resolve(import.meta.dirname, "../..");
    const receipt = JSON.parse(
      readFileSync(
        join(root, "docs/template/saas-ui-starter-files.json"),
        "utf8",
      ),
    ) as { files: Array<{ source: string; destination: string }> };
    const upstream = JSON.parse(
      readFileSync(join(root, "docs/template/saas-ui-upstream.json"), "utf8"),
    ) as {
      compositions: Array<{
        files: Array<{ source: string; destination: string }>;
      }>;
    };
    const mapped = new Map(
      upstream.compositions.flatMap(({ files }) =>
        files.map(({ source, destination }) => [destination, source]),
      ),
    );
    const owned = receipt.files.filter(
      ({ destination }) =>
        destination === "apps/web/src/theme/preset.ts" ||
        destination.startsWith("apps/web/src/features/common/layouts/") ||
        destination.startsWith("apps/web/src/features/common/components/") ||
        destination.startsWith("apps/web/src/features/settings/"),
    );

    expect(owned).toHaveLength(34);
    for (const file of owned) {
      expect(mapped.get(file.destination), file.destination).toBe(
        file.source.slice(file.source.lastIndexOf("apps/web/src/")),
      );
    }
  });
});
