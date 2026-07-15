import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gitBranchExists, runRtkToFile } from "../src/process.js";

const roots: string[] = [];
const git = (cwd: string, ...args: string[]): void => {
  execFileSync("rtk", ["proxy", "git", ...args], { cwd });
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe("brain factory process helpers", () => {
  it("uses unfiltered Git output for exact branch existence", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-process-"));
    roots.push(root);
    git(root, "init", "-q");
    git(root, "config", "user.email", "brain@example.test");
    git(root, "config", "user.name", "Brain Test");
    writeFileSync(resolve(root, "README.md"), "test\n");
    git(root, "add", "README.md");
    git(root, "commit", "-qm", "test: initialize repository");
    const branch = execFileSync(
      "rtk",
      ["proxy", "git", "branch", "--show-current"],
      { cwd: root, encoding: "utf8" },
    ).trim();
    expect(gitBranchExists(branch, root)).toBe(true);
    expect(gitBranchExists("fabro/missing", root)).toBe(false);
  });

  it("persists child output directly to an exclusive launch receipt", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-process-receipt-"));
    roots.push(root);
    git(root, "init", "-q");
    git(root, "config", "user.email", "brain@example.test");
    git(root, "config", "user.name", "Brain Test");
    writeFileSync(resolve(root, "README.md"), "test\n");
    git(root, "add", "README.md");
    git(root, "commit", "-qm", "test: initialize repository");
    const receipt = resolve(root, "launch-receipt.json");
    const output = runRtkToFile(
      ["proxy", "git", "rev-parse", "HEAD"],
      receipt,
      { cwd: root },
    );
    expect(readFileSync(receipt, "utf8").trim()).toBe(output);
    expect(() =>
      runRtkToFile(["proxy", "git", "rev-parse", "HEAD"], receipt, {
        cwd: root,
      }),
    ).toThrow();
  });
});
