import {
  execFile as execFileCallback,
  execFileSync,
  spawnSync,
} from "node:child_process";
import { promisify } from "node:util";
import {
  checkTemplateProductContract,
  RecordsCustomerMaterializationError,
  withMaterializedRecordsCustomer,
} from "./template-product-contract.mts";
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
): string => {
  try {
    return execFileSync("pnpm", args, {
      cwd: targetRoot,
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

const prepareMaterializedCustomer = (targetRoot: string): void => {
  runPreparedCustomerCommand(
    targetRoot,
    ["install", "--offline", "--ignore-scripts"],
    "Generated customer preparation",
  );
  runPreparedCustomerCommand(
    targetRoot,
    ["--dir", "packages/convex", "confect:codegen"],
    "Generated customer codegen",
  );
  runPreparedCustomerCommand(
    targetRoot,
    ["--dir", "packages/convex", "exec", "convex", "codegen"],
    "Generated customer Convex codegen",
  );
  runPreparedCustomerCommand(
    targetRoot,
    ["--dir", "apps/web", "exec", "vite", "build"],
    "Generated customer route codegen",
  );
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
      prepareMaterializedCustomer(targetRoot);
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
    prepareMaterializedCustomer(targetRoot);
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
