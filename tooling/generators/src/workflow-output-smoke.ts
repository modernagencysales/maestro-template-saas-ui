#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const smokeWorkflowName = "generatedWorkflowSmoke";
export const workflowOutputSmokeScriptName = "template:workflow-output-smoke";

type SmokeCommand = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
};

const ignoredPathSegments = new Set([
  ".git",
  ".tmp",
  ".tokensave",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "repos",
]);

const sharedNodeModulePaths = [
  "node_modules",
  "packages/convex/node_modules",
  "tooling/generators/node_modules",
] as const;

const optionalLocalConfigPaths = ["packages/convex/.env.local"] as const;

const repoRootFromScript = (): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const shouldCopyPath = (repoRoot: string, sourcePath: string): boolean => {
  if (sourcePath === repoRoot) {
    return true;
  }

  const parts = relative(repoRoot, sourcePath).split(sep);

  if (parts.some((part) => ignoredPathSegments.has(part))) {
    return false;
  }

  return !parts.some((part) => part === ".env" || part.startsWith(".env."));
};

const copyRepoForSmoke = (repoRoot: string, targetRoot: string): void => {
  cpSync(repoRoot, targetRoot, {
    recursive: true,
    dereference: false,
    filter: (sourcePath) => shouldCopyPath(repoRoot, sourcePath),
  });

  for (const nodeModulesPath of sharedNodeModulePaths) {
    const source = join(repoRoot, nodeModulesPath);
    const target = join(targetRoot, nodeModulesPath);

    if (existsSync(source) && !existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(source, target, "dir");
    }
  }

  for (const configPath of optionalLocalConfigPaths) {
    const source = join(repoRoot, configPath);
    const target = join(targetRoot, configPath);

    if (existsSync(source) && !existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target);
    }
  }
};

const runSmokeCommand = (tempRepoRoot: string, step: SmokeCommand): void => {
  process.stdout.write(`\n[workflow-output-smoke] ${step.label}\n`);

  const result = spawnSync(step.command, [...step.args], {
    cwd: tempRepoRoot,
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const verbose = process.env.WORKFLOW_OUTPUT_SMOKE_VERBOSE === "1";

  if (verbose) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (!verbose) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
    }

    const detail =
      result.signal === null ? `exit code ${result.status}` : result.signal;

    throw new Error(`${step.label} failed with ${detail}`);
  }
};

export const runWorkflowOutputSmoke = (
  repoRoot = repoRootFromScript(),
): void => {
  const tempRoot = mkdtempSync(join(tmpdir(), "maestro-workflow-smoke-"));
  const tempRepoRoot = join(tempRoot, "repo");
  const keepTemp = process.env.WORKFLOW_OUTPUT_SMOKE_KEEP_TEMP === "1";

  process.stdout.write(
    `[workflow-output-smoke] Preparing isolated repo at ${tempRepoRoot}\n`,
  );

  try {
    copyRepoForSmoke(repoRoot, tempRepoRoot);

    const convexPackage = join(tempRepoRoot, "packages/convex");
    const steps: readonly SmokeCommand[] = [
      {
        label: "Generate workflow output",
        command: "pnpm",
        args: [
          "--dir",
          tempRepoRoot,
          "template:add-workflow",
          "--",
          "--name",
          smokeWorkflowName,
          "--system",
          "workflow-runtime",
          "--disposition",
          "extend",
          "--description",
          "Generated workflow output smoke check.",
          "--write",
        ],
      },
      {
        label: "Regenerate Convex refs",
        command: "pnpm",
        args: ["--dir", convexPackage, "exec", "convex", "codegen"],
      },
      {
        label: "Typecheck generated Convex package output",
        command: "pnpm",
        args: ["--dir", convexPackage, "typecheck"],
      },
    ];

    for (const step of steps) {
      runSmokeCommand(tempRepoRoot, step);
    }
  } finally {
    if (keepTemp) {
      process.stdout.write(
        `[workflow-output-smoke] Preserved temp repo: ${tempRepoRoot}\n`,
      );
    } else {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
};

if (process.argv[1]?.endsWith("workflow-output-smoke.ts")) {
  runWorkflowOutputSmoke();
}
