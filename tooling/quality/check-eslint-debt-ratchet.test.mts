import { describe, expect, it } from "vitest";
import {
  compareDebt,
  parseDebt,
  validateRepoPath,
} from "./check-eslint-debt-ratchet.mts";

describe("ESLint legacy-debt ratchet", () => {
  it("passes unchanged, reduced, and removed debt", () => {
    expect(compareDebt([22, 14], [22, 14])).toEqual([]);
    expect(compareDebt([21, 14], [22, 14])).toEqual([]);
    expect(compareDebt([14], [22, 14])).toEqual([]);
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
});
