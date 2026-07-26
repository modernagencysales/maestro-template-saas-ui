import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const protectedFunctions = [
  "convex/components/workflowAdmission/admission.ts",
  "convex/components/workflowDeadline/deadlines.ts",
  "convex/workflows/deadlinesCurrent.ts",
] as const;
const digest = (path: string): string =>
  createHash("sha256")
    .update(readFileSync(resolve(packageRoot, path)))
    .digest("hex");

describe("Confect codegen local-component boundary", () => {
  it("preserves official convex/components function roots", () => {
    const before = Object.fromEntries(
      protectedFunctions.map((path) => [path, digest(path)]),
    );
    const patch = readFileSync(
      resolve(repositoryRoot, "patches/@confect__cli@9.1.5.patch"),
      "utf8",
    );
    expect(patch).toContain("isPreservedAppModule");
    execFileSync("pnpm", ["exec", "confect", "codegen"], {
      cwd: packageRoot,
      stdio: "pipe",
    });
    expect(
      Object.fromEntries(
        protectedFunctions.map((path) => [path, digest(path)]),
      ),
    ).toEqual(before);
  }, 30_000);
});
