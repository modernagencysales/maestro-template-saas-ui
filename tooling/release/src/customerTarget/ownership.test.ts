import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertMaterializableCustomerReleaseManifest,
  resolveCustomerReleasePath,
  validateCustomerReleaseManifest,
} from "./manifest";
import {
  buildCustomerOwnershipInventory,
  classifyCustomerSourcePath,
} from "./ownership";
import { hashSourceFiles } from "./sourceFixture.test-support";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const sourceCommit = "517b5bc28d1d633bef18f57610cff49800123788";
const sourcePaths = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", sourceCommit],
  { cwd: repoRoot, encoding: "utf8" },
)
  .trim()
  .split("\n");
describe("customer ownership inventory", () => {
  it("classifies every immutable tagged source path", () => {
    const inventory = buildCustomerOwnershipInventory(sourcePaths);

    expect(inventory).toHaveLength(sourcePaths.length);
    expect(new Set(inventory.map(({ ownership }) => ownership))).toEqual(
      new Set([
        "template-owned",
        "customer-extension",
        "generated",
        "factory-only",
      ]),
    );
    expect(() =>
      buildCustomerOwnershipInventory([...sourcePaths, "unknown/new-root.txt"]),
    ).toThrow("Unclassified customer release source path");
  });

  it.each([
    ["apps/web/src/routes/index.tsx", "template-owned", "copy"],
    ["tooling/generators/src/index.ts", "template-owned", "copy"],
    ["tooling/quality/check-generated-files.mts", "template-owned", "copy"],
    ["tooling/app-map/src/build.ts", "template-owned", "copy"],
    ["tooling/app-map/INTEGRATION_REQUEST.md", "factory-only", "omit"],
    ["docs/agent/host-projection-lifecycle.md", "template-owned", "copy"],
    ["docs/template/quickstart.md", "template-owned", "copy"],
    ["examples/generic-ai-ops/seed/workspace.json", "template-owned", "copy"],
    ["patches/@confect__cli@9.1.5.patch", "template-owned", "copy"],
    ["project.config.json", "customer-extension", "copy"],
    ["apps/web/src/routeTree.gen.ts", "generated", "generate"],
    ["docs/superpowers/specs/agent-pack.md", "factory-only", "omit"],
    ["docs/template/porting-backlog.md", "factory-only", "omit"],
    ["repos/effect/package.json", "factory-only", "omit"],
    ["tooling/evals/package.json", "factory-only", "omit"],
    ["apps/voice-relay/package.json", "factory-only", "omit"],
    ["examples/gtm-implementation/README.md", "factory-only", "omit"],
    [".codex/config.toml", "factory-only", "omit"],
  ])("pins %s ownership", (path, ownership, action) => {
    expect(classifyCustomerSourcePath(path)).toMatchObject({
      path,
      ownership,
      action,
    });
  });

  it("binds the complete materializable manifest to exact source bytes", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(repoRoot, "releases/v0.1.0-alpha.1/manifest.json"),
        "utf8",
      ),
    );
    const shippedFiles = hashSourceFiles(
      repoRoot,
      sourceCommit,
      Object.keys(fixture.expectedHashes),
    );
    const manifest = validateCustomerReleaseManifest(fixture, shippedFiles);

    expect(manifest.release.sourceCommit).toBe(sourceCommit);
    expect(
      sourcePaths.every((path) =>
        Boolean(resolveCustomerReleasePath(manifest.paths, path)),
      ),
    ).toBe(true);
    expect(manifest.materializationStatus).toBe("fixture-only");
    expect(() =>
      assertMaterializableCustomerReleaseManifest(manifest, {
        tag: manifest.release.tag,
        sourceCommit: manifest.release.sourceCommit,
        sourceChecksum: manifest.release.sourceChecksum,
      }),
    ).toThrow("Release manifest is fixture-only");
  });
});
