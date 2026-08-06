import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareDebt,
  parseDebt,
  parseRenameMap,
  readBlob,
  stagedRenames,
  validateRepoPath,
} from "./check-eslint-debt-ratchet.mts";

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", [...args], { cwd, stdio: "pipe" });
}

describe("ESLint legacy-debt ratchet", () => {
  it("passes unchanged, reduced, and removed debt", () => {
    expect(compareDebt([22, 14], [22, 14])).toEqual([]);
    expect(compareDebt([21, 14], [22, 14])).toEqual([]);
    expect(compareDebt([14], [22, 14])).toEqual([]);
  });

  it("compares ranked file/rule vectors rather than function identities", () => {
    expect(compareDebt([21, 13], [22, 14])).toEqual([]);
  });

  it("rejects increased numeric debt", () => {
    expect(compareDebt([23, 14], [22, 14])).toEqual(["23 exceeds baseline 22"]);
  });

  it("rejects an extra violation", () => {
    expect(compareDebt([22, 14, 11], [22, 14])).toEqual([
      "3 violations exceed baseline count 2",
    ]);
  });

  it("requires new files to be clean", () => {
    expect(compareDebt([], [])).toEqual([]);
    expect(compareDebt([11], [])).toEqual([
      "1 violation exceeds baseline count 0",
    ]);
  });

  it("parses all shift-left rule values in descending order", () => {
    expect(
      parseDebt([
        {
          ruleId: "complexity",
          message:
            "Arrow function has a complexity of 23. Maximum allowed is 10.",
        },
        {
          ruleId: "max-depth",
          message: "Blocks are nested too deeply (6). Maximum allowed is 4.",
        },
        {
          ruleId: "max-params",
          message:
            "Async arrow function has too many parameters (7). Maximum allowed is 5.",
        },
        {
          ruleId: "complexity",
          message:
            "Function 'small' has a complexity of 11. Maximum allowed is 10.",
        },
        { ruleId: "no-unused-vars", message: "'value' is never used." },
      ]),
    ).toEqual({ complexity: [23, 11], "max-depth": [6], "max-params": [7] });
  });

  it("accepts only normalized repository-relative paths", () => {
    expect(validateRepoPath("tooling/quality/check.mts")).toBe(
      "tooling/quality/check.mts",
    );
    expect(() => validateRepoPath("../outside.mts")).toThrow(
      "invalid repository-relative path",
    );
    expect(() => validateRepoPath("/tmp/outside.mts")).toThrow(
      "invalid repository-relative path",
    );
    expect(() => validateRepoPath("tooling/../outside.mts")).toThrow(
      "invalid repository-relative path",
    );
  });

  it("parses NUL-delimited destination-to-source rename metadata", () => {
    const source = "src/old\t[debt]\n*.ts";
    const destination = "src/new?[debt].ts";

    expect(parseRenameMap(`R100\0${source}\0${destination}\0`)).toEqual(
      new Map([[destination, source]]),
    );
    expect(() => parseRenameMap(`R100\0${source}\0${destination}`)).toThrow(
      "malformed staged rename metadata",
    );
    expect(() => parseRenameMap(`M\0${source}\0${destination}\0`)).toThrow(
      "malformed staged rename metadata",
    );
  });

  it("inherits a literal metacharacter path's baseline across a staged rename", () => {
    const root = mkdtempSync(join(tmpdir(), "eslint-debt-rename-"));
    const source = "src/[legacy]*?.ts";
    const destination = "src/[renamed]*?.ts";
    const code =
      "export const legacy = (a, b, c, d, e, f) => a || b || c || d || e || f;\n";
    try {
      git(root, ["init", "--quiet"]);
      git(root, ["config", "user.email", "ratchet@example.test"]);
      git(root, ["config", "user.name", "Ratchet Test"]);
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, source), code);
      git(root, ["add", "--", source]);
      git(root, ["commit", "--quiet", "-m", "baseline"]);
      renameSync(join(root, source), join(root, destination));
      git(root, ["add", "-A"]);

      const baselinePath = stagedRenames(root).get(destination);
      expect(baselinePath).toBe(source);
      if (baselinePath === undefined)
        throw new Error("missing rename baseline");
      expect(readBlob(root, "HEAD", baselinePath)).toBe(code);
      expect(readBlob(root, "index", destination)).toBe(code);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
