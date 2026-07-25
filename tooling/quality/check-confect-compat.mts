import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validatePinnedManifests } from "../convex-compat/src/matrix";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";
import { evaluateStaticCheck } from "./src/gate.mts";

export const descriptor = descriptorFor("confect-compat");

export async function collectCompatibilityFindings(
  repoRoot = resolve(import.meta.dirname, "../.."),
): Promise<readonly string[]> {
  const [matrix, convexPackage, proofPackage] = await Promise.all([
    readJson(join(repoRoot, "docs/template/convex-compatibility.json")),
    readJson(join(repoRoot, "packages/convex/package.json")),
    readJson(join(repoRoot, "tooling/effectified-api-proof/package.json")),
  ]);
  return validatePinnedManifests(matrix, convexPackage, proofPackage);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

if (isDirectRun(import.meta.url)) {
  const [staticResult, compatibilityFindings] = await Promise.all([
    evaluateStaticCheck(process.cwd(), descriptor),
    collectCompatibilityFindings(),
  ]);
  const failures = [
    ...staticResult.failures,
    ...compatibilityFindings.map(
      (finding) =>
        `package version differs from compatibility matrix: ${finding}`,
    ),
  ];
  if (failures.length === 0) {
    console.log("check:confect-compat: ok (matrix-backed)");
  } else {
    failures.forEach((failure) =>
      console.error(`check:confect-compat: ${failure}`),
    );
    process.exitCode = 1;
  }
}
