import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const launcherTimeoutMs = 30_000;

function runLauncher(args: readonly string[]): Promise<{
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolveRun) => {
    execFile(
      process.execPath,
      ["maestro-template.mjs", ...args],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        timeout: launcherTimeoutMs,
      },
      (error, stdout, stderr) => {
        resolveRun({
          status:
            error === null
              ? 0
              : typeof error.code === "number"
                ? error.code
                : null,
          stdout,
          stderr,
        });
      },
    );
  });
}

describe("repository-owned CLI launcher", () => {
  it(
    "preserves clean JSON stdout and the CLI exit code",
    async () => {
      const result = await runLauncher(["describe"]);

      expect(result.status, result.stderr).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      expect(result.stdout).not.toContain("> maestro-template@");
    },
    launcherTimeoutMs + 5_000,
  );

  it(
    "keeps invalid-command stdout empty and exits one",
    async () => {
      const result = await runLauncher(["not-a-command"]);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Unknown command");
    },
    launcherTimeoutMs + 5_000,
  );
});
