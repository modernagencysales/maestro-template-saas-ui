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
    expect(normalized).not.toContain('["--silent", "exec", "convex", "init"]');
    expect(normalized).toContain(
      '"convex", "dev", "--once", "--typecheck", "disable"',
    );
    expect(normalized).toContain(
      'rmSync(resolve(targetRoot, ".env.local"), { force: true })',
    );
    expect(normalized).toContain(
      'rmSync(resolve(targetRoot, ".convex"), { force: true, recursive: true })',
    );
  });

  it("provides fake AuthKit configuration to required local preparation", () => {
    const source = readFileSync(
      new URL("./template-product-contract-admission.mts", import.meta.url),
      "utf8",
    );
    const normalized = source.replace(/\s+/gu, " ");

    for (const entry of [
      'MAESTRO_CONTRACT_TEST: "1"',
      'VITE_CONVEX_URL: "http://127.0.0.1:3210"',
      'VITE_MAESTRO_CONTRACT_MODE: "1"',
      'WORKOS_API_KEY: "fake"',
      'WORKOS_CLIENT_ID: "client_test_contracts_runtime"',
      'WORKOS_COOKIE_PASSWORD: "contracts-runtime-test-cookie-password"',
      'WORKOS_REDIRECT_URI: "http://127.0.0.1:3000/api/auth/callback"',
    ])
      expect(normalized).toContain(entry);
    expect(normalized).toContain(
      '"Generated customer route codegen", localRuntimeEnvironment',
    );
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
