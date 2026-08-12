import { mkdir, readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  discoverComponentConfigs,
  materializeProRegistry,
  snapshotMaterializedTarget,
} from "./materialize-pro-registry.mts";

const proRoot = "/Users/headless/.cache/codex-research/saas-ui-pro";
const targets: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    targets
      .splice(0)
      .map((target) => rm(target, { recursive: true, force: true })),
  );
});

describe("complete Saas UI Pro registry materialization", () => {
  it("installs every published Pro root and is byte-idempotent", async () => {
    const projectRoot = await mkdtemp(
      join(tmpdir(), "maestro-saas-ui-registry-project-"),
    );
    const target = join(projectRoot, "apps/web");
    targets.push(projectRoot);
    await mkdir(join(projectRoot, "docs/template"), { recursive: true });
    await writeFile(
      join(projectRoot, "docs/template/saas-ui-upstream.json"),
      JSON.stringify({ registry: {} }),
    );
    await mkdir(target, { recursive: true });
    await writeFile(
      join(target, "package.json"),
      JSON.stringify({ name: "fixture", private: true, dependencies: {} }),
    );

    const first = await materializeProRegistry({ proRoot, targetRoot: target });
    const authoredRoots = await discoverComponentConfigs(
      join(proRoot, "packages/blocks"),
    );

    expect(first.installed).toHaveLength(authoredRoots.length);
    for (const config of authoredRoots)
      expect(
        first.items.some(({ sourceConfig }) => sourceConfig === config),
      ).toBe(true);
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
      first.files.map(({ path, sha256 }) => ({
        destination: `apps/web/${path}`,
        sha256,
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
});
