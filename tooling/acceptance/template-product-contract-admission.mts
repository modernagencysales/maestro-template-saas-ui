import {
  execFile as execFileCallback,
  execFileSync,
  spawnSync,
} from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  checkTemplateProductContract,
  RecordsCustomerMaterializationError,
  withMaterializedRecordsCustomer,
} from "./template-product-contract.mts";
import { applyPrerenderRetryCompatibility } from "../release/src/customerTarget/finalFilesystem.test-support";
import {
  redactedProcessOutputTail,
  renderBoundedPlaywrightProcessOutput,
} from "./run-acceptance.mts";

const repoRoot = new URL("../..", import.meta.url).pathname;
const identity = [
  "-c",
  "user.name=Maestro Acceptance",
  "-c",
  "user.email=acceptance@maestro.local",
];
const execFile = promisify(execFileCallback);

export const validateRequiredAcceptanceSummary = (stdout: string): void => {
  const summary = /(?:^|\n)4 required, (\d+) runtime(?:\r?\n|$)/u.exec(stdout);
  if (summary === null || Number(summary[1]) < 4)
    throw new Error(
      "Generated customer required acceptance must report 4 required behaviors and at least 4 runtime records.",
    );
};

export const canonicalRequiredAcceptanceSummary = (stdout: string): string => {
  validateRequiredAcceptanceSummary(stdout);
  const summary = /(?:^|\n)(4 required, \d+ runtime)(?:\r?\n|$)/u.exec(stdout);
  return summary?.[1] ?? "";
};

type ProcessFailure = {
  readonly stdout?: string | Buffer;
  readonly stderr?: string | Buffer;
};

export const capturedProcessFailure = (
  label: string,
  error: unknown,
): Error => {
  const failure = error as ProcessFailure;
  const output = redactedProcessOutputTail(
    [failure.stdout, failure.stderr]
      .filter((value): value is string | Buffer => value !== undefined)
      .map(String)
      .join("\n"),
  );
  return new Error(
    `${label} failed${output === "" ? "" : `\n${renderBoundedPlaywrightProcessOutput(output)}`}`,
  );
};

const withMaterializedAdmission = async <Value,>(
  operation: (targetRoot: string) => Promise<Value>,
): Promise<Value> => {
  try {
    return await withMaterializedRecordsCustomer(repoRoot, operation);
  } catch (error) {
    if (error instanceof RecordsCustomerMaterializationError)
      throw capturedProcessFailure("Generated customer materialization", error);
    throw error;
  }
};

const runPreparedCustomerCommand = (
  targetRoot: string,
  args: readonly string[],
  label: string,
  environment?: NodeJS.ProcessEnv,
): string => {
  try {
    return execFileSync("pnpm", args, {
      cwd: targetRoot,
      ...(environment === undefined ? {} : { env: environment }),
      encoding: "utf8",
      maxBuffer: 512 * 1024,
    });
  } catch (error) {
    throw capturedProcessFailure(label, error);
  }
};

const commitGeneratedCustomerArtifacts = (targetRoot: string): void => {
  try {
    execFileSync(
      "git",
      [...identity, "commit", "-m", "accept generated customer artifacts"],
      {
        cwd: targetRoot,
        env: { ...process.env, LEFTHOOK: "0" },
        encoding: "utf8",
        maxBuffer: 512 * 1024,
      },
    );
  } catch (error) {
    throw capturedProcessFailure("Generated customer artifact commit", error);
  }
};

export const prepareMaterializedCustomer = (
  targetRoot: string,
  mode: "structural" | "required",
  runCommand: typeof runPreparedCustomerCommand = runPreparedCustomerCommand,
  preparePrerenderRuntime: (
    root: string,
  ) => void = applyPrerenderRetryCompatibility,
): void => {
  runCommand(
    targetRoot,
    ["install", "--offline", "--ignore-scripts"],
    "Generated customer preparation",
  );
  runCommand(
    targetRoot,
    ["--dir", "packages/convex", "confect:codegen"],
    "Generated customer codegen",
  );
  if (mode === "required") {
    const localRuntimeEnvironment = {
      ...process.env,
      MAESTRO_CONTRACT_TEST: "1",
      VITE_CONVEX_URL: "http://127.0.0.1:3210",
      VITE_MAESTRO_CONTRACT_MODE: "1",
      WORKOS_API_KEY: "fake",
      WORKOS_CLIENT_ID: "client_test_contracts_runtime",
      WORKOS_COOKIE_PASSWORD: "contracts-runtime-test-cookie-password",
      WORKOS_REDIRECT_URI: "http://127.0.0.1:3000/api/auth/callback",
    };
    const localConvexEnvironment = {
      ...Object.fromEntries(
        Object.entries(localRuntimeEnvironment).filter(
          ([name]) => !name.startsWith("CONVEX_"),
        ),
      ),
      CONVEX_AGENT_MODE: "anonymous",
    };
    runCommand(
      targetRoot,
      ["--silent", "exec", "convex", "init"],
      "Generated customer local Convex initialization",
      localConvexEnvironment,
    );
    const deploymentEnvironment = {
      MAESTRO_CONTRACT_TEST: "1",
      POSTHOG_PROJECT_TOKEN: ["phc", "test", "placeholder"].join("_"),
      WORKOS_CLIENT_ID: "client_test_contracts_runtime",
    };
    for (const [name, value] of Object.entries(deploymentEnvironment))
      runCommand(
        targetRoot,
        ["--silent", "exec", "convex", "env", "set", name, value],
        `Generated customer local Convex ${name} configuration`,
        localConvexEnvironment,
      );
    runCommand(
      targetRoot,
      ["--silent", "exec", "convex", "dev", "--once", "--typecheck", "disable"],
      "Generated customer local Convex codegen",
      localConvexEnvironment,
    );
    rmSync(resolve(targetRoot, ".env.local"), { force: true });
    rmSync(resolve(targetRoot, ".convex"), { force: true, recursive: true });
    preparePrerenderRuntime(targetRoot);
    runCommand(
      targetRoot,
      ["--dir", "apps/web", "exec", "vite", "build"],
      "Generated customer route codegen",
      localRuntimeEnvironment,
    );
  }
  execFileSync("git", ["add", "-A"], { cwd: targetRoot });
  if (
    spawnSync("git", ["diff", "--cached", "--quiet"], {
      cwd: targetRoot,
    }).status !== 0
  )
    commitGeneratedCustomerArtifacts(targetRoot);
  if (
    execFileSync("git", ["status", "--short"], {
      cwd: targetRoot,
      encoding: "utf8",
    }) !== ""
  )
    throw new Error("Prepared generated customer checkout is dirty.");
};

export const runStructuralProductContractAdmission =
  async (): Promise<void> => {
    await withMaterializedAdmission(async (targetRoot) => {
      const findings = await checkTemplateProductContract({
        repoRoot,
        sourceRoot: "examples/saas-application/seed/source",
        allowFirstContract: true,
        targetRoot,
      });
      if (findings.length > 0) throw new Error(findings.join("\n"));
      prepareMaterializedCustomer(targetRoot, "structural");
      runPreparedCustomerCommand(
        targetRoot,
        ["--dir", "packages/convex", "typecheck"],
        "Generated customer typecheck",
      );
      runPreparedCustomerCommand(
        targetRoot,
        ["check:product-contract"],
        "Generated customer product contract check",
      );
    });
  };

export const runRequiredAcceptanceAdmission = async (): Promise<void> => {
  await withMaterializedAdmission(async (targetRoot) => {
    prepareMaterializedCustomer(targetRoot, "required");
    let stdout: string;
    try {
      ({ stdout } = await execFile("pnpm", ["acceptance:required"], {
        cwd: targetRoot,
        encoding: "utf8",
        maxBuffer: 512 * 1024,
      }));
    } catch (error) {
      throw capturedProcessFailure("Generated customer acceptance", error);
    }
    process.stdout.write(`${canonicalRequiredAcceptanceSummary(stdout)}\n`);
  });
};

const main = async (): Promise<void> => {
  const [mode, ...rest] = process.argv.slice(2);
  if (rest.length !== 0 || (mode !== "structural" && mode !== "required"))
    throw new Error(
      "usage: template-product-contract-admission.mts <structural|required>",
    );
  await (mode === "structural"
    ? runStructuralProductContractAdmission()
    : runRequiredAcceptanceAdmission());
};

if (process.argv[1]?.endsWith("template-product-contract-admission.mts"))
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
