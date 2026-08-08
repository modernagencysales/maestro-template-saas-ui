import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const codegenProcessTimeoutMs = 90_000;
const codegenTestTimeoutMs = 200_000;
const pristineCliRoot = dirname(require.resolve("@confect/cli/package.json"));
const patchPath = resolve(
  repositoryRoot,
  "patches/@confect__cli@10.0.0-next.9.patch",
);
const protectedFunctions = [
  "convex/brain/pages.ts",
  "convex/components/workflowAdmission/admission.ts",
  "convex/components/workflowDeadline/deadlines.ts",
  "convex/workflows/deadlinesCurrent.ts",
  "convex/workflows/subworkflowLinksCurrent.ts",
  "confect/_generated/registeredFunctions/workflows/subworkflowLinksCurrent.ts",
] as const;
const deterministicOutputs = [
  "confect/_generated/spec.ts",
  "convex/workflows/subworkflowLinks.ts",
] as const;

const digest = (root: string, path: string): string =>
  createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex");

const digests = (root: string, paths: readonly string[]) =>
  Object.fromEntries(paths.map((path) => [path, digest(root, path)]));

const canApplyPatch = (cliRoot: string, reverse = false): boolean => {
  try {
    execFileSync(
      "git",
      ["apply", ...(reverse ? ["--reverse"] : []), "--check", patchPath],
      { cwd: cliRoot, stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
};

const normalizeCliPatch = (cliRoot: string, patched: boolean): void => {
  const pristine = canApplyPatch(cliRoot);
  const alreadyPatched = canApplyPatch(cliRoot, true);
  if (pristine === alreadyPatched) {
    throw new Error(
      "Confect CLI fixture is neither pristine nor exactly patched.",
    );
  }
  if (patched === alreadyPatched) return;
  execFileSync("git", ["apply", ...(patched ? [] : ["--reverse"]), patchPath], {
    cwd: cliRoot,
    stdio: "pipe",
  });
};

const createFixture = (applyPatch: boolean) => {
  const root = mkdtempSync(join(tmpdir(), "maestro-confect-codegen-"));
  const fixturePackageRoot = resolve(root, "packages/convex");
  const fixtureCliRoot = resolve(root, "confect-cli");
  mkdirSync(fixturePackageRoot, { recursive: true });
  mkdirSync(fixtureCliRoot, { recursive: true });
  cpSync(
    resolve(packageRoot, "confect"),
    resolve(fixturePackageRoot, "confect"),
    {
      recursive: true,
    },
  );
  cpSync(
    resolve(packageRoot, "convex"),
    resolve(fixturePackageRoot, "convex"),
    {
      recursive: true,
    },
  );
  cpSync(
    resolve(packageRoot, "package.json"),
    resolve(fixturePackageRoot, "package.json"),
  );
  cpSync(resolve(pristineCliRoot, "bin"), resolve(fixtureCliRoot, "bin"), {
    recursive: true,
  });
  cpSync(resolve(pristineCliRoot, "dist"), resolve(fixtureCliRoot, "dist"), {
    recursive: true,
  });
  cpSync(
    resolve(pristineCliRoot, "package.json"),
    resolve(fixtureCliRoot, "package.json"),
  );
  symlinkSync(
    resolve(repositoryRoot, "node_modules"),
    resolve(root, "node_modules"),
  );
  symlinkSync(
    resolve(packageRoot, "node_modules"),
    resolve(fixturePackageRoot, "node_modules"),
  );
  symlinkSync(
    resolve(pristineCliRoot, "../.."),
    resolve(fixtureCliRoot, "node_modules"),
  );
  writeFileSync(
    resolve(fixturePackageRoot, "convex/extinctOwned.ts"),
    "export const extinctOwned = true;\n",
  );
  normalizeCliPatch(fixtureCliRoot, applyPatch);
  return {
    root,
    packageRoot: fixturePackageRoot,
    cli: resolve(fixtureCliRoot, "bin/confect.mjs"),
  };
};

const runCodegen = async (
  fixture: ReturnType<typeof createFixture>,
): Promise<void> => {
  try {
    await execFileAsync(process.execPath, [fixture.cli, "codegen"], {
      cwd: fixture.packageRoot,
      encoding: "utf8",
      timeout: codegenProcessTimeoutMs,
    });
  } catch (error) {
    const failure = error as {
      readonly stdout?: Buffer | string;
      readonly stderr?: Buffer | string;
    };
    throw new Error(
      [failure.stdout?.toString(), failure.stderr?.toString()]
        .filter(Boolean)
        .join("\n"),
      { cause: error },
    );
  }
};

const removeFixture = (fixture: ReturnType<typeof createFixture>): void => {
  rmSync(fixture.root, { recursive: true, force: true });
};

describe("Confect codegen local-component boundary", () => {
  it(
    "characterizes the three pristine next.9 regressions",
    async () => {
      const fixture = createFixture(false);
      try {
        await runCodegen(fixture);
        expect(
          existsSync(resolve(fixture.packageRoot, protectedFunctions[1])),
        ).toBe(false);
        expect(
          existsSync(resolve(fixture.packageRoot, protectedFunctions[3])),
        ).toBe(false);
        expect(
          readFileSync(
            resolve(fixture.packageRoot, "confect/_generated/spec.ts"),
            "utf8",
          ),
        ).toContain("subworkflowLinksCurrent");
        expect(
          readFileSync(
            resolve(
              fixture.packageRoot,
              "convex/workflows/subworkflowLinks.ts",
            ),
            "utf8",
          ),
        ).toContain(
          "export const reportReconciliationFailure = registeredFunctions.reportReconciliationFailure;",
        );
      } finally {
        removeFixture(fixture);
      }
    },
    codegenTestTimeoutMs,
  );

  it(
    "preserves app roots and emits deterministic formatted declarations",
    async () => {
      const fixture = createFixture(true);
      try {
        const before = digests(fixture.packageRoot, protectedFunctions);
        await runCodegen(fixture);
        expect(digests(fixture.packageRoot, protectedFunctions)).toEqual(
          before,
        );
        expect(
          existsSync(resolve(fixture.packageRoot, "convex/extinctOwned.ts")),
        ).toBe(false);
        expect(
          readFileSync(
            resolve(fixture.packageRoot, "confect/_generated/spec.ts"),
            "utf8",
          ),
        ).not.toContain("subworkflowLinksCurrent");
        expect(
          readFileSync(
            resolve(
              fixture.packageRoot,
              "convex/workflows/subworkflowLinks.ts",
            ),
            "utf8",
          ),
        ).toContain(
          "export const reportReconciliationFailure =\n  registeredFunctions.reportReconciliationFailure;",
        );
        const afterFirstRun = digests(
          fixture.packageRoot,
          deterministicOutputs,
        );
        await runCodegen(fixture);
        expect(digests(fixture.packageRoot, protectedFunctions)).toEqual(
          before,
        );
        expect(digests(fixture.packageRoot, deterministicOutputs)).toEqual(
          afterFirstRun,
        );
      } finally {
        removeFixture(fixture);
      }
    },
    codegenTestTimeoutMs,
  );
});
