import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

  it("retains partial child output when the child exits nonzero", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-process-partial-"));
    roots.push(root);
    const receipt = resolve(root, "launch.raw");
    const outcome = resolve(root, "launch.raw.outcome.json");
    expect(() =>
      runRtkToFile(
        [
          "proxy",
          "node",
          "-e",
          "process.stdout.write('partial');process.exit(1)",
        ],
        receipt,
        { outcomePath: outcome },
      ),
    ).toThrow("failed (1)");
    expect(readFileSync(receipt, "utf8")).toBe("partial");
    expect(JSON.parse(readFileSync(outcome, "utf8"))).toEqual({
      errorCode: null,
      errorSyscall: null,
      kind: "exited",
      outputPath: receipt,
      outputSha256: createHash("sha256").update("partial").digest("hex"),
      schemaVersion: "maestro-rtk-file-outcome/v2",
      signal: null,
      status: 1,
    });
  });

  it("records a spawned child signal separately from a pre-exec error", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-process-signal-"));
    roots.push(root);
    const receipt = resolve(root, "launch.raw");
    const outcome = resolve(root, "launch.raw.outcome.json");
    const accepted = resolve(root, "accepted.marker");
    const fakeRtk = resolve(root, "rtk");
    writeFileSync(
      fakeRtk,
      `#!/bin/sh\nprintf accepted > ${JSON.stringify(accepted)}\nkill -TERM $$\n`,
    );
    chmodSync(fakeRtk, 0o755);
    const originalPath = process.env.PATH;
    process.env.PATH = `${root}:${originalPath ?? ""}`;
    try {
      expect(() =>
        runRtkToFile(["fabro", "create", "ignored"], receipt, {
          outcomePath: outcome,
        }),
      ).toThrow("failed (unknown)");
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }

    expect(existsSync(accepted)).toBe(true);
    expect(readFileSync(receipt, "utf8")).toBe("");
    expect(JSON.parse(readFileSync(outcome, "utf8"))).toEqual({
      errorCode: null,
      errorSyscall: null,
      kind: "signaled",
      outputPath: receipt,
      outputSha256: createHash("sha256").update("").digest("hex"),
      schemaVersion: "maestro-rtk-file-outcome/v2",
      signal: "SIGTERM",
      status: null,
    });
  });
});
