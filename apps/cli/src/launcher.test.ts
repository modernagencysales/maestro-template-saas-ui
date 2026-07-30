import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("repository-owned CLI launcher", () => {
  it("preserves clean JSON stdout and the CLI exit code", () => {
    const result = spawnSync(
      process.execPath,
      ["maestro-template.mjs", "describe"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stdout).not.toContain("> maestro-template@");
  });

  it("keeps invalid-command stdout empty and exits one", () => {
    const result = spawnSync(
      process.execPath,
      ["maestro-template.mjs", "not-a-command"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown command");
  });
});
