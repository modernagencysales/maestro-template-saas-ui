import {
  execFile as execFileCallback,
  execFileSync,
  spawnSync,
} from "node:child_process";
import { promisify } from "node:util";
import {
  checkTemplateProductContract,
  withMaterializedRecordsCustomer,
} from "./template-product-contract.mts";

const repoRoot = new URL("../..", import.meta.url).pathname;
const identity = [
  "-c",
  "user.name=Maestro Acceptance",
  "-c",
  "user.email=acceptance@maestro.local",
];
const execFile = promisify(execFileCallback);

const prepareMaterializedCustomer = (targetRoot: string): void => {
  execFileSync("pnpm", ["install", "--offline", "--ignore-scripts"], {
    cwd: targetRoot,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["--dir", "packages/convex", "confect:codegen"], {
    cwd: targetRoot,
    stdio: "inherit",
  });
  execFileSync("git", ["add", "-A"], { cwd: targetRoot });
  if (
    spawnSync("git", ["diff", "--cached", "--quiet"], {
      cwd: targetRoot,
    }).status !== 0
  )
    execFileSync(
      "git",
      [...identity, "commit", "-m", "accept generated customer artifacts"],
      {
        cwd: targetRoot,
        env: { ...process.env, LEFTHOOK: "0" },
        stdio: "inherit",
      },
    );
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
    await withMaterializedRecordsCustomer(repoRoot, async (targetRoot) => {
      const findings = await checkTemplateProductContract({
        repoRoot,
        sourceRoot: "examples/saas-application/seed/source",
        allowFirstContract: true,
        targetRoot,
      });
      if (findings.length > 0) throw new Error(findings.join("\n"));
      prepareMaterializedCustomer(targetRoot);
      execFileSync("pnpm", ["--dir", "packages/convex", "typecheck"], {
        cwd: targetRoot,
        stdio: "inherit",
      });
      execFileSync("pnpm", ["check:product-contract"], {
        cwd: targetRoot,
        stdio: "inherit",
      });
    });
  };

export const runRequiredAcceptanceAdmission = async (): Promise<void> => {
  await withMaterializedRecordsCustomer(repoRoot, async (targetRoot) => {
    prepareMaterializedCustomer(targetRoot);
    const { stdout, stderr } = await execFile("pnpm", ["acceptance:required"], {
      cwd: targetRoot,
      maxBuffer: 512 * 1024,
    });
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    if (!stdout.includes("4 required, 4 runtime"))
      throw new Error(
        "Generated customer required acceptance did not report 4 required, 4 runtime.",
      );
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
