import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateCompatibilitySet, validatePinnedManifests } from "./matrix";

const repoRoot = resolve(import.meta.dirname, "../../..");

describe("Convex compatibility matrix", () => {
  it("accepts the current pinned set and rejects an unproven candidate", async () => {
    const [matrix, current, candidate] = await Promise.all([
      readJson("docs/template/convex-compatibility.json"),
      readJson("tooling/convex-compat/__fixtures__/current.json"),
      readJson("tooling/convex-compat/__fixtures__/candidate.json"),
    ]);

    expect(evaluateCompatibilitySet(matrix, current)).toEqual({
      status: "pass",
      findings: [],
    });
    expect(evaluateCompatibilitySet(matrix, candidate)).toEqual({
      status: "fail",
      findings: [
        "workpool-duplicate-completion",
        "workpool-cancel-race",
        "fresh-frozen-install",
      ],
    });
  });

  it("pins package declarations to the machine-readable authority", async () => {
    const matrix = await readJson("docs/template/convex-compatibility.json");
    const [convexPackage, proofPackage] = await Promise.all([
      readJson("packages/convex/package.json"),
      readJson("tooling/effectified-api-proof/package.json"),
    ]);

    expect(
      validatePinnedManifests(matrix, convexPackage, proofPackage),
    ).toEqual([]);
  });

  it("evaluates candidates without changing the working lockfile", async () => {
    const before = await readFile(resolve(repoRoot, "pnpm-lock.yaml"), "utf8");
    const matrix = await readJson("docs/template/convex-compatibility.json");
    const candidate = await readJson(
      "tooling/convex-compat/__fixtures__/candidate.json",
    );
    evaluateCompatibilitySet(matrix, candidate);
    const after = await readFile(resolve(repoRoot, "pnpm-lock.yaml"), "utf8");
    expect(after).toBe(before);
  });
});

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}
