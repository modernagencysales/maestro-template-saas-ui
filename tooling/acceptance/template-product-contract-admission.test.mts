import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RecordsCustomerMaterializationError } from "../../apps/cli/src/factory/customerCandidateFixture";
import * as admission from "./template-product-contract-admission.mts";
import {
  canonicalRequiredAcceptanceSummary,
  capturedProcessFailure,
  validateRequiredAcceptanceSummary,
} from "./template-product-contract-admission.mts";

describe("required acceptance admission summary", () => {
  it("configures the ephemeral Convex deployment before required codegen", () => {
    const targetRoot = mkdtempSync(resolve(tmpdir(), "maestro-admission-"));
    writeFileSync(resolve(targetRoot, ".env.local"), "stale deployment");
    mkdirSync(resolve(targetRoot, ".convex"));
    const commands: string[][] = [];
    const preparedPrerenderRoots: string[] = [];
    const stopAfterVite = new Error("stop after Vite");
    const prepare = Reflect.get(admission, "prepareMaterializedCustomer");
    expect(prepare).toBeTypeOf("function");

    try {
      expect(() =>
        Reflect.apply(prepare, undefined, [
          targetRoot,
          "required",
          (_root: string, args: readonly string[]) => {
            commands.push([...args]);
            if (args.includes("vite")) throw stopAfterVite;
            return "";
          },
          (root: string) => preparedPrerenderRoots.push(root),
        ]),
      ).toThrow(stopAfterVite);
      expect(commands.slice(2)).toEqual([
        ["--silent", "exec", "convex", "init"],
        [
          "--silent",
          "exec",
          "convex",
          "env",
          "set",
          "MAESTRO_CONTRACT_TEST",
          "1",
        ],
        [
          "--silent",
          "exec",
          "convex",
          "env",
          "set",
          "POSTHOG_PROJECT_TOKEN",
          "phc_test_placeholder",
        ],
        [
          "--silent",
          "exec",
          "convex",
          "env",
          "set",
          "WORKOS_CLIENT_ID",
          "client_test_contracts_runtime",
        ],
        [
          "--silent",
          "exec",
          "convex",
          "dev",
          "--once",
          "--typecheck",
          "disable",
        ],
        ["--dir", "apps/web", "exec", "vite", "build"],
      ]);
      expect(preparedPrerenderRoots).toEqual([targetRoot]);
      expect(existsSync(resolve(targetRoot, ".env.local"))).toBe(false);
      expect(existsSync(resolve(targetRoot, ".convex"))).toBe(false);
    } finally {
      rmSync(targetRoot, { recursive: true });
    }
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
