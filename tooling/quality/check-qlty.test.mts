import { describe, expect, it } from "vitest";
import { hasMode, isCi } from "./src/script-mode.mts";
import { qltyAdvisory, qltyArgs } from "./check-qlty.mts";

describe("check:qlty", () => {
  it("supports fake mode", () => {
    expect(hasMode("fake", ["node", "script", "--mode", "fake"])).toBe(true);
  });

  it("fails closed in CI callers can detect", () => {
    expect(isCi({ CI: "true" })).toBe(true);
  });

  it("keeps findings and provider failures visible but advisory", () => {
    const findings = qltyAdvisory({ status: 1, signal: null }, "check");
    const providerFailure = qltyAdvisory({ status: 2, signal: null }, "check");

    expect(findings).toEqual({
      exitCode: 0,
      warning:
        "check:qlty: advisory check reported findings or failed (status 1)",
    });
    expect(providerFailure.exitCode).toBe(0);
    expect(providerFailure.warning).toContain("status 2");
  });

  it("keeps a missing binary and a 30-second timeout advisory", () => {
    const missing = qltyAdvisory(
      {
        status: null,
        signal: null,
        error: Object.assign(new Error("spawnSync qlty ENOENT"), {
          code: "ENOENT",
        }),
      },
      "availability",
    );
    const timeout = qltyAdvisory(
      {
        status: null,
        signal: "SIGTERM",
        error: Object.assign(new Error("spawnSync qlty ETIMEDOUT"), {
          code: "ETIMEDOUT",
        }),
      },
      "check",
    );

    expect(missing.exitCode).toBe(0);
    expect(missing.warning).toContain("qlty binary unavailable");
    expect(missing.warning).toContain("ENOENT");
    expect(timeout.exitCode).toBe(0);
    expect(timeout.warning).toContain("SIGTERM");
    expect(timeout.warning).toContain("ETIMEDOUT");
  });

  it("stays quiet when Qlty succeeds", () => {
    expect(qltyAdvisory({ status: 0, signal: null }, "check")).toEqual({
      exitCode: 0,
    });
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
});
