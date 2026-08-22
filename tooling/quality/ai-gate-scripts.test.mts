import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spawned tsx/shell subprocesses start slowly under V8 coverage
// instrumentation; give these integration tests a generous budget.
const SHELL_TEST_TIMEOUT = 60_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function run(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = {},
): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      // The CI toolchain bootstrap must never run inside a test timeout.
      env: { ...process.env, TEMPLATE_CI_SETUP: "skip", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

describe("AI and PR gate scripts", () => {
  it(
    "AI CI wrappers fail closed without provider auth",
    { timeout: SHELL_TEST_TIMEOUT },
    async () => {
      const noProviderEnv = {
        OPENROUTER_API_KEY: "",
        OPENAI_API_KEY: "",
      };
      const taste = await run("bash", ["tooling/ci/taste.sh"], noProviderEnv);
      const contract = await run(
        "bash",
        ["tooling/ci/contract-review.sh"],
        noProviderEnv,
      );

      expect(taste.exitCode).toBe(1);
      expect(taste.stderr).toContain(
        "requires OPENROUTER_API_KEY or OPENAI_API_KEY",
      );
      expect(contract.exitCode).toBe(1);
      expect(contract.stderr).toContain(
        "requires OPENROUTER_API_KEY or OPENAI_API_KEY",
      );
    },
  );

  it(
    "AI CI wrappers allow explicit fake mode only",
    { timeout: SHELL_TEST_TIMEOUT },
    async () => {
      const taste = await run("bash", [
        "tooling/ci/taste.sh",
        "--mode",
        "fake",
      ]);
      const contract = await run("bash", [
        "tooling/ci/contract-review.sh",
        "--mode",
        "fake",
      ]);

      expect(taste.exitCode).toBe(0);
      expect(taste.stdout).toContain("extract-ai-verdict: pass");
      expect(contract.exitCode).toBe(0);
      expect(contract.stdout).toContain("extract-ai-verdict: pass");
    },
  );

  it(
    "GitHub PR gates fail closed in CI without GitHub auth",
    { timeout: SHELL_TEST_TIMEOUT },
    async () => {
      const health = await run(
        "pnpm",
        ["exec", "tsx", "tooling/quality/check-pr-health.mts"],
        {
          CI: "true",
          GITHUB_TOKEN: "",
        },
      );
      const threads = await run(
        "pnpm",
        ["exec", "tsx", "tooling/quality/check-unresolved-review-threads.mts"],
        {
          CI: "true",
          GITHUB_TOKEN: "",
        },
      );

      expect(health.exitCode).toBe(1);
      expect(health.stderr).toContain("missing GITHUB_TOKEN");
      expect(threads.exitCode).toBe(1);
      expect(threads.stderr).toContain("missing GITHUB_TOKEN");
    },
  );
});
