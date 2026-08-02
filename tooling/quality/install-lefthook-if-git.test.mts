import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const installer = fileURLToPath(
  new URL("./install-lefthook-if-git.mjs", import.meta.url),
);

describe("customer Lefthook prepare boundary", () => {
  it("installs hooks only when the app root owns the Git worktree", () => {
    const fixture = createFixture("isolated");
    git(fixture.appRoot, ["init", "--quiet"]);

    const result = runInstaller(fixture);

    expect(result.status).toBe(0);
    expect(readFileSync(fixture.invocationLog, "utf8")).toBe(
      realpathSync(fixture.appRoot),
    );
    expect(
      gitOutput(fixture.appRoot, [
        "config",
        "--local",
        "--get",
        "core.hooksPath",
      ]),
    ).toBe(".git/hooks");
  });

  it("does not mutate an ancestor Git worktree", () => {
    const fixture = createFixture("ancestor");
    git(fixture.root, ["init", "--quiet"]);

    const result = runInstaller(fixture);

    expect(result.status).toBe(0);
    expect(existsSync(fixture.invocationLog)).toBe(false);
    expect(existsSync(join(fixture.root, "lefthook.yml"))).toBe(false);
  });
});

function createFixture(name: string) {
  const root = mkdtempSync(join(tmpdir(), `maestro-lefthook-${name}-`));
  const appRoot = join(root, "customer");
  const binRoot = join(root, "bin");
  const invocationLog = join(root, "lefthook-invocation.txt");
  mkdirSync(appRoot);
  mkdirSync(binRoot);
  const executable = join(binRoot, "lefthook");
  writeFileSync(
    executable,
    '#!/bin/sh\nprintf "%s" "$PWD" > "$LEFTHOOK_INVOCATION_LOG"\n',
  );
  chmodSync(executable, 0o755);
  return { root, appRoot, binRoot, invocationLog };
}

function git(cwd: string, argv: readonly string[]): void {
  const result = spawnSync("git", argv, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Git fixture setup failed.");
  }
}

function gitOutput(cwd: string, argv: readonly string[]): string {
  const result = spawnSync("git", argv, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Git fixture inspection failed.");
  }
  return result.stdout.trim();
}

function runInstaller(fixture: ReturnType<typeof createFixture>) {
  return spawnSync(process.execPath, [installer], {
    cwd: fixture.appRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      LEFTHOOK_INVOCATION_LOG: fixture.invocationLog,
      PATH: `${fixture.binRoot}:${process.env.PATH ?? ""}`,
    },
  });
}
