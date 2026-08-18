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
import { spawn, spawnSync } from "node:child_process";
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
  "apps/web/node_modules",
  "packages/convex/node_modules",
  "tooling/generators/node_modules",
] as const;

const optionalLocalConfigPaths = ["packages/convex/.env.local"] as const;

export const repoRootFromScript = (): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const shouldCopyPath = (
  repoRoot: string,
  sourcePath: string,
): boolean => {
  if (sourcePath === repoRoot) {
    return true;
  }

  const parts = relative(repoRoot, sourcePath).split(sep);

  if (parts.some((part) => ignoredPathSegments.has(part))) {
    return false;
  }

  return !parts.some((part) => part === ".env" || part.startsWith(".env."));
};

export const copyRepoForSmoke = (
  repoRoot: string,
  targetRoot: string,
): void => {
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

export const runSmokeCommand = (
  tempRepoRoot: string,
  step: SmokeCommand,
): void => {
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

export const runSmokeCommandAsync = async (
  tempRepoRoot: string,
  step: SmokeCommand,
): Promise<void> => {
  process.stdout.write(`\n[workflow-output-smoke] ${step.label}\n`);

  const child = spawn(step.command, [...step.args], {
    cwd: tempRepoRoot,
    env: process.env,
    stdio: "pipe",
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const result = await new Promise<
    | { readonly code: number | null; readonly signal: NodeJS.Signals | null }
    | { readonly error: Error }
  >((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const verbose = process.env.WORKFLOW_OUTPUT_SMOKE_VERBOSE === "1";

  if (verbose) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  if ("error" in result) throw result.error;
  if (result.code === 0) return;

  if (!verbose) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  const detail =
    result.signal === null ? `exit code ${result.code}` : result.signal;
  throw new Error(`${step.label} failed with ${detail}`);
};

export const sourceFingerprint = (source: string): string =>
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

const runSmokeSteps = (
  tempRepoRoot: string,
  steps: readonly SmokeCommand[],
): void => {
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
};

const verifyGeneratedWorkflow = (
  tempRepoRoot: string,
  convexPackage: string,
  runnerPath: string,
): void => {
  if (!existsSync(runnerPath)) {
    throw new Error(`Generated workflow runner is missing: ${runnerPath}`);
  }
  const runnerSource = readFileSync(runnerPath, "utf8");
  const sourcePath = join(
    convexPackage,
    "confect/workflowRunners",
    smokeWorkflowName,
    "v1.ts",
  );
  const semanticsPath = join(
    tempRepoRoot,
    "docs/template/generated/workflows",
    `${smokeWorkflowName}.semantics.json`,
  );
  if (![sourcePath, semanticsPath].every(existsSync)) {
    throw new Error(
      "Generated workflow semantic source or coverage is missing",
    );
  }
  if (!runnerSource.includes("registeredFunctions.run")) {
    throw new Error("Confect did not reproduce the registered workflow runner");
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
    throw new Error(`Confect did not repair owned output: ${repairedFinding}`);
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
    throw new Error(`Reproduced runner ownership failed: ${reproducedFinding}`);
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
    const runnerPath = join(
      convexPackage,
      "convex/workflowRunners",
      smokeWorkflowName,
      "v1.ts",
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
        label: "Lint generated contract, runner source, and projection",
        command: "pnpm",
        args: [
          "--dir",
          tempRepoRoot,
          "exec",
          "eslint",
          `packages/convex/confect/workflowContracts/${smokeWorkflowName}.impl.ts`,
          `packages/convex/confect/workflowRunners/${smokeWorkflowName}/v1.ts`,
          `packages/convex/convex/workflowRunners/${smokeWorkflowName}/v1.ts`,
        ],
      },
      {
        label: "Regenerate Convex refs",
        command: "pnpm",
        args: ["--dir", tempRepoRoot, "exec", "convex", "codegen"],
        requiresDeployment: true,
      },
      {
        label: "Typecheck generated Convex package output",
        command: "pnpm",
        args: ["--dir", convexPackage, "typecheck"],
      },
    ];

    runSmokeSteps(tempRepoRoot, steps);
    verifyGeneratedWorkflow(tempRepoRoot, convexPackage, runnerPath);
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
