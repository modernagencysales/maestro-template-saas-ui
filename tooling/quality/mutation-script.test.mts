import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "maestro-mutation-script-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFakePnpm(logPath: string): Promise<string> {
  const fakePnpm = join(tempDir, "pnpm");
  await writeFile(
    fakePnpm,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${logPath}"
`,
    { mode: 0o755 },
  );

  return fakePnpm;
}

async function runScript(
  args: readonly string[] = [],
  env: NodeJS.ProcessEnv = {},
): Promise<{ readonly exitCode: number | null; readonly stdout: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn("bash", ["tooling/ci/mutation.sh", ...args], {
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
    child.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(stderr || stdout));
      } else {
        resolve({ exitCode, stdout });
      }
    });
  });
}

describe("mutation CI shim", () => {
  it("keeps fake mode cheap for local and diligence runs", async () => {
    const result = await runScript(["--mode", "fake"]);

    expect(result.stdout).toContain("mutation: ok (fake mode)");
  });

  it("skips outside scheduled/manual mutation runs", async () => {
    const result = await runScript([], { CI: "", RUN_MUTATION: "" });

    expect(result.stdout).toContain(
      "mutation: skipped outside scheduled/manual mutation runs",
    );
  });

  it("runs Stryker with the focused template config in manual mode", async () => {
    const logPath = join(tempDir, "pnpm.log");
    const fakePnpm = await writeFakePnpm(logPath);
    const result = await runScript([], {
      PATH: `${tempDir}:${process.env.PATH ?? ""}`,
      RUN_MUTATION: "true",
    });

    expect(result.exitCode).toBe(0);
    expect(fakePnpm).toContain(tempDir);
    await expect(readFile(logPath, "utf8")).resolves.toContain(
      "exec stryker run stryker.conf.mjs",
    );
  });
});
