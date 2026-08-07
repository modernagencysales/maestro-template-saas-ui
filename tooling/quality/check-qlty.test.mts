import { describe, expect, it } from "vitest";
import { hasMode, isCi } from "./src/script-mode.mts";
import { qltyArgs, runQltyForTest } from "./check-qlty.mts";

describe("check:qlty", () => {
  it("supports fake mode", () => {
    expect(hasMode("fake", ["node", "script", "--mode", "fake"])).toBe(true);
  });

  it("fails closed in CI callers can detect", () => {
    expect(isCi({ CI: "true" })).toBe(true);
  });

  it("blocks qlty failures in every mode", () => {
    for (const mode of ["--staged", "--diff", "--all"] as const) {
      expect(runQltyForTest({ mode, qltyExit: 1 }).exitCode).toBe(1);
    }
  });

  it("uses bounded staged and upstream argument sets", () => {
    expect(qltyArgs("--staged", ["apps/web/src/a.ts"])).toEqual([
      ["check", "apps/web/src/a.ts", "--no-fix", "--fail-level=note"],
    ]);
    expect(qltyArgs("--diff", [])).toEqual([
      ["check", "--upstream", "origin/main", "--no-fix", "--fail-level=note"],
      ["smells", "--upstream", "origin/main"],
    ]);
  });

  it("skips the initial staged snapshot without a baseline", () => {
    expect(qltyArgs("--staged", ["apps/web/src/a.ts"], false)).toEqual([]);
  });
});
