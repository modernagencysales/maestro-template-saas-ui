import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RecordsCustomerMaterializationError } from "../../apps/cli/src/factory/customerCandidateFixture";
import {
  canonicalRequiredAcceptanceSummary,
  capturedProcessFailure,
  validateRequiredAcceptanceSummary,
} from "./template-product-contract-admission.mts";

describe("required acceptance admission summary", () => {
  it("keeps structural preparation independent of a Convex deployment", () => {
    const source = readFileSync(
      new URL("./template-product-contract-admission.mts", import.meta.url),
      "utf8",
    );
    const normalized = source.replace(/\s+/gu, " ");
    expect(normalized).not.toContain(
      '["--dir", "packages/convex", "exec", "convex", "codegen"]',
    );
    expect(normalized).toContain('["--silent", "exec", "convex", "init"]');
    expect(normalized).toContain(
      '"convex", "dev", "--once", "--typecheck", "disable"',
    );
    expect(normalized).toContain('CONVEX_AGENT_MODE: "anonymous"');
  });

  it("renders failed materialization stdout and stderr as a bounded safe witness", () => {
    const failure = new RecordsCustomerMaterializationError({
      exitCode: 1,
      stdout: `materialization stdout Authorization=Basic materialization-stdout-canary ${"x".repeat(700)}`,
      stderr: `materialization stderr COOKIE=session=materialization-stderr-canary ${"y".repeat(700)}\nsafe materialization witness`,
    });
    expect(failure.message).toBe(
      "Records customer materialization failed with exit code 1.",
    );
    const rendered = capturedProcessFailure(
      "Generated customer materialization",
      failure,
    ).message;
    expect(rendered).toContain("safe materialization witness");
    expect(rendered).not.toContain("materialization-stdout-canary");
    expect(rendered).not.toContain("materialization-stderr-canary");
    expect(rendered.length).toBeLessThanOrEqual(550);
  });

  it.each([
    "4 required, 4 runtime",
    "4 required, 5 runtime",
    "4 required, 10 runtime",
  ])("accepts %s", (stdout) => {
    expect(() => validateRequiredAcceptanceSummary(stdout)).not.toThrow();
  });

  it("returns only the canonical successful acceptance summary", () => {
    expect(
      canonicalRequiredAcceptanceSummary(
        "noisy generated customer output\n4 required, 6 runtime\nmore output",
      ),
    ).toBe("4 required, 6 runtime");
  });

  it.each([
    ["missing required coverage", "3 required, 5 runtime"],
    ["too few runtime records", "4 required, 3 runtime"],
  ])("rejects %s", (_name, stdout) => {
    expect(() => validateRequiredAcceptanceSummary(stdout)).toThrow(
      "Generated customer required acceptance must report 4 required behaviors and at least 4 runtime records.",
    );
  });
});
