import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type ExclusionFixture = {
  readonly schemaVersion: 1;
  readonly releaseManifest: string;
  readonly blueprintManifest: string;
  readonly forbiddenPublicPathFragments: readonly string[];
  readonly forbiddenRouteTokens: readonly string[];
  readonly localOnlyOwner: string;
};

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("customer production exclusions", () => {
  it("keeps the immutable default customer artifact free of Build Readiness routes", () => {
    const fixture = readJson<ExclusionFixture>(
      resolve(
        repoRoot,
        "tooling/release/src/customer-production-exclusions.fixture.json",
      ),
    );
    const releaseManifestPath = resolve(repoRoot, fixture.releaseManifest);
    const release = readJson<Record<string, unknown>>(releaseManifestPath);
    const blueprint = readJson<{
      readonly entries: readonly { readonly path: string }[];
    }>(resolve(repoRoot, fixture.blueprintManifest));
    const base = readJson<{
      readonly paths: readonly {
        readonly path: string;
        readonly action: string;
      }[];
      readonly expectedHashes: Readonly<Record<string, string>>;
    }>(
      resolve(
        dirname(releaseManifestPath),
        String(record(release.baseManifest).path),
      ),
    );
    const shippedPaths = [
      ...base.paths
        .filter(({ action }) => action !== "omit")
        .map(({ path }) => path),
      ...Object.keys(base.expectedHashes),
      ...blueprint.entries.map(({ path }) => path),
    ];

    expect(fixture.localOnlyOwner).toBe("tooling/agent-pack/src/readiness");
    for (const fragment of fixture.forbiddenPublicPathFragments) {
      expect(shippedPaths.filter((path) => path.includes(fragment))).toEqual(
        [],
      );
    }
    const routeTree = readFileSync(
      resolve(repoRoot, "apps/web/src/routeTree.gen.ts"),
      "utf8",
    );
    for (const token of fixture.forbiddenRouteTokens) {
      expect(routeTree).not.toContain(token);
    }
  });
});

function readJson<Value>(path: string): Value {
  return JSON.parse(readFileSync(path, "utf8")) as Value;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
