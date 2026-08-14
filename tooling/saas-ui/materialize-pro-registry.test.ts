import { createHash } from "node:crypto";
import { mkdir, readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import {
  compareProRegistryProjection,
  discoverInstallableItems,
  materializeProRegistry,
  snapshotMaterializedTarget,
  verifyProSourceCommit,
} from "./materialize-pro-registry.mts";

const proRoot = "/Users/headless/.cache/codex-research/saas-ui-pro";
const targets: string[] = [];
const hash = (source: string): string =>
  createHash("sha256").update(source).digest("hex");

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    targets
      .splice(0)
      .map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("complete Saas UI Pro registry materialization", () => {
  it("rejects dirty source even when HEAD matches the expected pin", async () => {
    const source = await mkdtemp(join(tmpdir(), "saas-ui-pro-source-"));
    targets.push(source);
    execFileSync("git", ["init"], { cwd: source });
    execFileSync("git", ["config", "user.name", "Saas UI test"], {
      cwd: source,
    });
    execFileSync("git", ["config", "user.email", "saas-ui@example.test"], {
      cwd: source,
    });
    await mkdir(join(source, "packages/blocks/example"), { recursive: true });
    await writeFile(
      join(source, "packages/blocks/example/source.ts"),
      "export const clean = true;\n",
    );
    execFileSync("git", ["add", "packages/blocks/example/source.ts"], {
      cwd: source,
    });
    execFileSync("git", ["commit", "-m", "test source"], { cwd: source });
    const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: source,
      encoding: "utf8",
    }).trim();
    await writeFile(
      join(source, "packages/blocks/example/untracked.ts"),
      "dirty\n",
    );

    expect(() => verifyProSourceCommit(source, expectedCommit)).toThrow(
      /working tree is not clean/,
    );
  });

  it("rejects ignored source files that the collector would materialize", async () => {
    const source = await mkdtemp(join(tmpdir(), "saas-ui-pro-source-"));
    targets.push(source);
    execFileSync("git", ["init"], { cwd: source });
    execFileSync("git", ["config", "user.name", "Saas UI test"], {
      cwd: source,
    });
    execFileSync("git", ["config", "user.email", "saas-ui@example.test"], {
      cwd: source,
    });
    await mkdir(join(source, "packages/blocks/example"), { recursive: true });
    await writeFile(join(source, ".gitignore"), "*.generated.ts\n");
    await writeFile(
      join(source, "packages/blocks/example/source.ts"),
      "export const clean = true;\n",
    );
    execFileSync("git", ["add", ".gitignore", "packages"], { cwd: source });
    execFileSync("git", ["commit", "-m", "test source"], { cwd: source });
    const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: source,
      encoding: "utf8",
    }).trim();
    await writeFile(
      join(source, "packages/blocks/example/extra.generated.ts"),
      "dirty\n",
    );

    expect(() => verifyProSourceCommit(source, expectedCommit)).toThrow(
      /working tree is not clean/,
    );
  });

  it("mechanically compares every pinned registry item with editable local source", async () => {
    const root = join(import.meta.dirname, "../..");
    const comparison = await compareProRegistryProjection({
      proRoot,
      targetRoot: join(root, "apps/web"),
    });

    expect(comparison.sourceCommit).toBe(
      "ac3a40c8dc05e403f9d501a87c092646891d3c40",
    );
    expect(comparison.registryIds).toEqual(
      JSON.parse(await readFile(join(root, "apps/web/components.json"), "utf8"))
        .installed,
    );
    const installable = await discoverInstallableItems(proRoot);
    expect(comparison.registryIds).toEqual(
      installable
        .map(({ name }) => name)
        .sort((left, right) => left.localeCompare(right, "en")),
    );
    expect(comparison.files).toHaveLength(
      JSON.parse(
        await readFile(
          join(root, "docs/template/saas-ui-registry-files.json"),
          "utf8",
        ),
      ).files.length,
    );
    expect(comparison.differences).toEqual([]);

    const receiptPath = join(root, "docs/template/saas-ui-registry-files.json");
    const originalReceipt = await readFile(receiptPath, "utf8");
    const receipt = JSON.parse(originalReceipt) as {
      installed: string[];
    };
    receipt.installed = receipt.installed.slice(1);
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    try {
      await expect(
        compareProRegistryProjection({
          proRoot,
          targetRoot: join(root, "apps/web"),
        }),
      ).resolves.toMatchObject({
        differences: expect.arrayContaining([
          "registry receipt installed registry ids: expected",
        ]),
      });
    } finally {
      await writeFile(receiptPath, originalReceipt);
    }
  }, 30_000);

  it("records catalog source paths and hashes for every projected destination", async () => {
    const root = join(import.meta.dirname, "../..");
    const receipt = JSON.parse(
      await readFile(
        join(root, "docs/template/saas-ui-registry-files.json"),
        "utf8",
      ),
    ) as {
      files: Array<{
        source: string;
        destination: string;
        sourceSha256: string;
        sha256: string;
      }>;
    };

    expect(receipt.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.stringMatching(/^registry:/),
          destination: expect.stringMatching(/^apps\/web\/src\/components\//),
          sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ]),
    );
    expect(
      receipt.files.every(
        ({ source, sourceSha256, sha256 }) =>
          source.length > 0 &&
          /^[a-f0-9]{64}$/.test(sourceSha256) &&
          /^[a-f0-9]{64}$/.test(sha256),
      ),
    ).toBe(true);
  });

  it("installs every published Pro root and is byte-idempotent", async () => {
    const projectRoot = await mkdtemp(
      join(tmpdir(), "maestro-saas-ui-registry-project-"),
    );
    const target = join(projectRoot, "apps/web");
    targets.push(projectRoot);
    await mkdir(join(projectRoot, "docs/template"), { recursive: true });
    await writeFile(
      join(projectRoot, "docs/template/saas-ui-upstream.json"),
      JSON.stringify({
        registry: { sourceCommit: "ac3a40c8dc05e403f9d501a87c092646891d3c40" },
      }),
    );
    await mkdir(target, { recursive: true });
    await writeFile(
      join(target, "package.json"),
      JSON.stringify({ name: "fixture", private: true, dependencies: {} }),
    );

    const first = await materializeProRegistry({ proRoot, targetRoot: target });
    const installable = await discoverInstallableItems(proRoot);
    expect(first.installed).toEqual(
      installable
        .map(({ name }) => name)
        .sort((left, right) => left.localeCompare(right, "en")),
    );
    expect(
      JSON.parse(await readFile(join(target, "components.json"), "utf8"))
        .installed,
    ).toEqual(first.installed);

    const before = await snapshotMaterializedTarget(target);
    const second = await materializeProRegistry({
      proRoot,
      targetRoot: target,
    });
    expect(await snapshotMaterializedTarget(target)).toEqual(before);
    expect(second.files).toEqual(first.files);
    expect(first.conflicts).toEqual([]);
    expect(
      first.files.every(
        ({ path, sha256 }) => first.plannedHashes[path] === sha256,
      ),
    ).toBe(true);
    expect(first.unresolvedImports).toEqual([]);
    expect(first.receipt.files).toEqual(
      first.files.map(({ path, source, sourceSha256, sha256 }) => ({
        source: source.startsWith("registry:")
          ? source
          : source.slice(proRoot.length + 1),
        destination: `apps/web/${path}`,
        sourceSha256,
        sha256,
        adapted: false,
      })),
    );
    expect(
      JSON.parse(
        await readFile(
          join(projectRoot, "docs/template/saas-ui-registry-files.json"),
          "utf8",
        ),
      ),
    ).toEqual(first.receipt);
    expect(second.receipt).toEqual(first.receipt);
    expect(Object.keys(first.externalDependencies)).toEqual(
      expect.arrayContaining([
        "@ark-ui/react",
        "@dnd-kit/core",
        "@tanstack/react-form",
        "react-icons",
        "zod",
      ]),
    );
    expect(
      Object.values(first.externalDependencies).every(
        (version) => !version.startsWith("workspace:"),
      ),
    ).toBe(true);
    for (const file of first.files) {
      const content = await readFile(join(target, file.path), "utf8");
      expect(content).not.toMatch(/workspace:|@\/registry\/|#registry\//);
      expect(content).not.toContain(proRoot);
    }
  }, 30_000);

  it("preserves receipted adapted bytes and reports subsequent registry drift", async () => {
    const projectRoot = await mkdtemp(
      join(tmpdir(), "maestro-saas-ui-adapted-registry-"),
    );
    const target = join(projectRoot, "apps/web");
    targets.push(projectRoot);
    await mkdir(join(projectRoot, "docs/template"), { recursive: true });
    await writeFile(
      join(projectRoot, "docs/template/saas-ui-upstream.json"),
      JSON.stringify({
        registry: { sourceCommit: "ac3a40c8dc05e403f9d501a87c092646891d3c40" },
      }),
    );
    await mkdir(target, { recursive: true });
    await writeFile(
      join(target, "package.json"),
      JSON.stringify({ name: "fixture", private: true, dependencies: {} }),
    );

    const first = await materializeProRegistry({ proRoot, targetRoot: target });
    const file = first.files[0];
    if (!file) throw new Error("registry materialization produced no files");
    const destination = `apps/web/${file.path}`;
    const filePath = join(target, file.path);
    const adaptedSource = `${await readFile(filePath, "utf8")}\n// adapter\n`;
    await writeFile(filePath, adaptedSource);
    const receiptPath = join(
      projectRoot,
      "docs/template/saas-ui-registry-files.json",
    );
    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as {
      files: Array<{ destination: string; sha256: string; adapted?: boolean }>;
    };
    const entry = receipt.files.find(
      (value) => value.destination === destination,
    );
    if (!entry) throw new Error(`receipt is missing ${destination}`);
    entry.sha256 = hash(adaptedSource);
    entry.adapted = true;
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

    const second = await materializeProRegistry({
      proRoot,
      targetRoot: target,
    });
    expect(await readFile(filePath, "utf8")).toBe(adaptedSource);
    expect(
      second.receipt.files.find((value) => value.destination === destination),
    ).toMatchObject({ adapted: true, sha256: hash(adaptedSource) });
    expect(
      (await compareProRegistryProjection({ proRoot, targetRoot: target }))
        .differences,
    ).toEqual([]);

    await writeFile(filePath, `${adaptedSource}// drift\n`);
    await expect(
      compareProRegistryProjection({ proRoot, targetRoot: target }),
    ).resolves.toMatchObject({
      differences: [`editable registry source drift: ${destination}`],
    });
  }, 30_000);
});
