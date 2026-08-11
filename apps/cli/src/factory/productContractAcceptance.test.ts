import {
  execFile as execFileCallback,
  execFileSync,
  spawnSync,
} from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  checkTemplateProductContract,
  withMaterializedRecordsCustomer,
} from "../../../../tooling/acceptance/template-product-contract.mts";

const repoRoot = new URL("../../../../", import.meta.url).pathname;
const identity = [
  "-c",
  "user.name=Maestro Acceptance",
  "-c",
  "user.email=acceptance@maestro.local",
];
const execFile = promisify(execFileCallback);

const installAndCommitGenerated = (targetRoot: string): void => {
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
  expect(
    execFileSync("git", ["status", "--short"], {
      cwd: targetRoot,
      encoding: "utf8",
    }),
  ).toBe("");
};

describe("generated customer product contract admission", () => {
  it("validates generated customer product contract", async () => {
    await withMaterializedRecordsCustomer(repoRoot, async (targetRoot) => {
      const findings = await checkTemplateProductContract({
        repoRoot,
        sourceRoot: "examples/saas-application/seed/source",
        allowFirstContract: true,
        targetRoot,
      });
      expect(findings).toEqual([]);
      installAndCommitGenerated(targetRoot);
      execFileSync("pnpm", ["--dir", "packages/convex", "typecheck"], {
        cwd: targetRoot,
        stdio: "inherit",
      });
      execFileSync("pnpm", ["check:product-contract"], {
        cwd: targetRoot,
        stdio: "inherit",
      });
    });
  }, 900_000);

  it("executes required Records product behaviors", async () => {
    await withMaterializedRecordsCustomer(repoRoot, async (targetRoot) => {
      installAndCommitGenerated(targetRoot);
      const { stdout, stderr } = await execFile(
        "pnpm",
        ["acceptance:required"],
        {
          cwd: targetRoot,
          maxBuffer: 512 * 1024,
        },
      );
      process.stdout.write(stdout);
      process.stderr.write(stderr);
      expect(stdout).toContain("4 required, 4 runtime");
    });
  }, 900_000);
});
