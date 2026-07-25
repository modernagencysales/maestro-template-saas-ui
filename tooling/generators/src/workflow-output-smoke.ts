#!/usr/bin/env node
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
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateWorkflowSemanticCoverage } from "@maestro-template/template-core/workflow-semantics";

export const smokeWorkflowName = "generatedWorkflowSmoke";
export const workflowOutputSmokeScriptName = "template:workflow-output-smoke";

type SmokeCommand = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly requiresDeployment?: boolean;
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

const sourceFingerprint = (source: string): string =>
  createHash("sha256").update(source).digest("hex");

export const runnerOwnershipFinding = (
  runnerPath: string,
  expectedFingerprint: string,
): string | null => {
  if (!existsSync(runnerPath)) return "runner projection is missing";
  const actualFingerprint = sourceFingerprint(readFileSync(runnerPath, "utf8"));
  return actualFingerprint === expectedFingerprint
    ? null
    : `runner projection fingerprint changed: expected ${expectedFingerprint}, received ${actualFingerprint}`;
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
    const runnerPath = join(
      convexPackage,
      "convex/workflowRunners",
      `${smokeWorkflowName}.ts`,
    );
    rmSync(runnerPath, { force: true });
    if (existsSync(runnerPath)) {
      throw new Error("Copied runner projection survived smoke isolation");
    }
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
        label: "Regenerate Confect runner projection",
        command: "pnpm",
        args: ["--dir", tempRepoRoot, "confect:codegen"],
      },
      {
        label: "Lint generated runner source and projection",
        command: "pnpm",
        args: [
          "--dir",
          tempRepoRoot,
          "exec",
          "eslint",
          `packages/convex/confect/workflowRunners/${smokeWorkflowName}.ts`,
          `packages/convex/convex/workflowRunners/${smokeWorkflowName}.ts`,
        ],
      },
      {
        label: "Regenerate Convex refs",
        command: "pnpm",
        args: ["--dir", convexPackage, "exec", "convex", "codegen"],
        requiresDeployment: true,
      },
      {
        label: "Typecheck generated Convex package output",
        command: "pnpm",
        args: ["--dir", convexPackage, "typecheck"],
      },
    ];

    for (const step of steps) {
      if (
        step.requiresDeployment === true &&
        !process.env.CONVEX_DEPLOYMENT?.trim()
      ) {
        process.stdout.write(
          `\n[workflow-output-smoke] ${step.label}: unavailable (no CONVEX_DEPLOYMENT); continuing with fake/local typecheck and output checks\n`,
        );
        continue;
      }
      runSmokeCommand(tempRepoRoot, step);
    }

    if (!existsSync(runnerPath)) {
      throw new Error(`Generated workflow runner is missing: ${runnerPath}`);
    }
    const runnerSource = readFileSync(runnerPath, "utf8");
    const sourcePath = join(
      convexPackage,
      "confect/workflowRunners",
      `${smokeWorkflowName}.ts`,
    );
    const semanticsPath = join(
      tempRepoRoot,
      "docs/template/generated/workflows",
      `${smokeWorkflowName}.semantics.json`,
    );
    if (!existsSync(sourcePath) || !existsSync(semanticsPath)) {
      throw new Error(
        "Generated workflow semantic source or coverage is missing",
      );
    }
    if (!runnerSource.includes("registeredFunctions.run")) {
      throw new Error(
        "Confect did not reproduce the registered workflow runner",
      );
    }
    const coverage = JSON.parse(readFileSync(semanticsPath, "utf8")) as Record<
      string,
      {
        readonly posture: "generated" | "guarded-default";
        readonly constructor: string;
        readonly compiler: string;
        readonly fixture: string;
      }
    >;
    const coverageFindings = validateWorkflowSemanticCoverage(coverage);
    if (coverageFindings.length > 0) {
      throw new Error(
        `Invalid semantic coverage: ${coverageFindings.join(", ")}`,
      );
    }
    const expectedFingerprint = sourceFingerprint(runnerSource);
    writeFileSync(
      runnerPath,
      `${runnerSource}\n// deliberate smoke corruption\n`,
    );
    const corruptionFinding = runnerOwnershipFinding(
      runnerPath,
      expectedFingerprint,
    );
    if (!corruptionFinding?.includes("fingerprint changed")) {
      throw new Error("Runner ownership check accepted corrupted output");
    }
    runSmokeCommand(tempRepoRoot, {
      label: "Repair corrupted Confect runner projection",
      command: "pnpm",
      args: ["--dir", tempRepoRoot, "confect:codegen"],
    });
    const repairedFinding = runnerOwnershipFinding(
      runnerPath,
      expectedFingerprint,
    );
    if (repairedFinding !== null) {
      throw new Error(
        `Confect did not repair owned output: ${repairedFinding}`,
      );
    }
    rmSync(runnerPath);
    if (
      runnerOwnershipFinding(runnerPath, expectedFingerprint) !==
      "runner projection is missing"
    ) {
      throw new Error("Runner ownership check accepted deleted output");
    }
    runSmokeCommand(tempRepoRoot, {
      label: "Reproduce deleted Confect runner projection",
      command: "pnpm",
      args: ["--dir", tempRepoRoot, "confect:codegen"],
    });
    const reproducedFinding = runnerOwnershipFinding(
      runnerPath,
      expectedFingerprint,
    );
    if (reproducedFinding !== null) {
      throw new Error(
        `Reproduced runner ownership failed: ${reproducedFinding}`,
      );
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
