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
  readonly forbiddenCustomerPaths: readonly string[];
  readonly forbiddenCustomerBarrelExports: readonly string[];
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
      readonly entries: readonly {
        readonly path: string;
        readonly action: string;
      }[];
    }>(resolve(repoRoot, fixture.blueprintManifest));
    const base = readJson<{
      readonly paths: readonly {
        readonly path: string;
        readonly match: string;
        readonly action: string;
      }[];
      readonly expectedHashes: Readonly<Record<string, string>>;
    }>(
      resolve(
        dirname(releaseManifestPath),
        String(record(release.baseManifest).path),
      ),
    );
    const releasePaths = [
      ...base.paths,
      ...(release.additionalPaths as readonly {
        readonly path: string;
        readonly match: string;
        readonly action: string;
      }[]),
    ];
    const generatedPaths = new Set(
      blueprint.entries
        .filter(({ action }) => action !== "omit")
        .map(({ path }) => path),
    );
    const shippedPaths = [
      ...Object.keys(base.expectedHashes).filter(
        (path) => !isOmitted(releasePaths, path),
      ),
      ...generatedPaths,
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
    for (const path of fixture.forbiddenCustomerPaths) {
      expect(
        shippedPaths.filter(
          (shipped) => shipped === path || shipped.startsWith(`${path}/`),
        ),
      ).toEqual([]);
    }
    const customerBarrel = readFileSync(
      resolve(
        repoRoot,
        "releases/v0.2.0-alpha.1/blueprints/saas-application/base/tooling/agent-pack/src/index.ts.txt",
      ),
      "utf8",
    );
    for (const barrelExport of fixture.forbiddenCustomerBarrelExports) {
      expect(customerBarrel).not.toContain(barrelExport);
    }
  });
});

function isOmitted(
  paths: readonly {
    readonly path: string;
    readonly match: string;
    readonly action: string;
  }[],
  path: string,
): boolean {
  const exact = paths.find(
    (entry) => entry.match === "exact" && entry.path === path,
  );
  if (exact) return exact.action === "omit";
  return (
    paths
      .filter(
        (entry) =>
          entry.match === "subtree" &&
          (path === entry.path || path.startsWith(`${entry.path}/`)),
      )
      .sort((left, right) => right.path.length - left.path.length)[0]
      ?.action === "omit"
  );
}

function readJson<Value>(path: string): Value {
  return JSON.parse(readFileSync(path, "utf8")) as Value;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
