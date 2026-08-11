import { chmod, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import type { DiagnosticDescriptor } from "./diagnostics.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  createVerifyCommand,
  type VerificationRunObservation,
  type VerificationRunRequest,
  type VerificationRunner,
} from "./verify.js";
import {
  createExecFileVerificationRunner,
  type VerificationExecFile,
} from "./verificationRunner.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/fixture" }),
};

const descriptors: readonly DiagnosticDescriptor[] = [
  {
    gateId: "agent-pack",
    posture: "required",
    evidenceClass: "behavioral",
    canonicalDoc: "docs/template/preflight.md",
    repairHint: "Fix the reported Agent Pack contract invariant.",
    argv: ["pnpm", "check:agent-pack"],
    rerun: ["pnpm", "check:agent-pack"],
    focusedPathPrefixes: ["tooling/agent-pack/", "apps/cli/"],
    defaultFocused: true,
  },
  {
    gateId: "taste",
    posture: "advisory",
    evidenceClass: "advisory",
    canonicalDoc: "docs/template/reviewer-guide.md",
    repairHint: "Review the reported product-quality finding.",
    argv: ["pnpm", "taste:eval"],
    rerun: ["pnpm", "taste:eval"],
    focusedPathPrefixes: ["apps/web/"],
  },
];
const requiredDescriptor = descriptors[0];
const advisoryDescriptor = descriptors[1];
if (requiredDescriptor === undefined || advisoryDescriptor === undefined) {
  throw new Error("Expected required and advisory diagnostic fixtures.");
}
const productContractDescriptor: DiagnosticDescriptor = {
  ...requiredDescriptor,
  gateId: "product-contract",
  evidenceClass: "static",
  argv: ["pnpm", "check:product-contract"],
  rerun: ["pnpm", "check:product-contract"],
};
const acceptanceRequiredDescriptor: DiagnosticDescriptor = {
  ...requiredDescriptor,
  gateId: "acceptance-required",
  evidenceClass: "runtime",
  argv: ["pnpm", "acceptance:required"],
  rerun: ["pnpm", "acceptance:required"],
};

const runner = (
  observations: readonly VerificationRunObservation[],
  requests: VerificationRunRequest[] = [],
): VerificationRunner => ({
  inspect: async () => ({
    createdAt: "2026-07-25T12:00:00.000Z",
    subject: { commit: "abc123", dirty: false },
    repositoryFingerprint: "repository_sha256:fixture",
    environmentFingerprint: "environment_sha256:fixture",
    providerPostureFingerprint: "providers_sha256:fixture",
  }),
  run: async (request) => {
    requests.push(request);
    return observations;
  },
});

describe("agent-pack verification command", () => {
  it("projects successful planned product admissions into the full receipt", async () => {
    const execute = vi.fn<VerificationExecFile>(async (file, args) => ({
      exitCode: 0,
      stdout: file === "git" && args[0] === "rev-parse" ? "abc123\n" : "",
      stderr: "",
    }));
    const command = createVerifyCommand({
      descriptors: [productContractDescriptor, acceptanceRequiredDescriptor],
      runner: createExecFileVerificationRunner({
        execFile: execute,
        readFile: async () =>
          JSON.stringify({
            scripts: {
              verify: "pnpm check:product-contract && pnpm acceptance:required",
              "check:product-contract": "tsx admission structural",
              "acceptance:required": "tsx admission required",
            },
          }),
        now: () => "2026-08-11T12:00:00.000Z",
        environment: async () => ({}),
        providerPosture: async () => ({}),
        limits: {
          metadataTimeoutMs: 1_000,
          focusedTimeoutMs: 5_000,
          fullTimeoutMs: 10_000,
          maxBufferBytes: 64_000,
          packageJsonMaxBytes: 32_000,
        },
      }),
    });

    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );

    expect(result.data?.receipt.gates).toMatchObject([
      {
        gateId: "product-contract",
        status: "pass",
        argv: ["pnpm", "check:product-contract"],
      },
      {
        gateId: "acceptance-required",
        status: "pass",
        argv: ["pnpm", "acceptance:required"],
      },
    ]);
    expect(
      execute.mock.calls
        .filter(([file]) => file === "pnpm")
        .map(([, args]) => args),
    ).toEqual([["verify"]]);
  });

  it.each([
    [
      "pass",
      [
        { gateId: "agent-pack", status: "pass", message: "Passed." },
        { gateId: "taste", status: "pass", message: "Passed." },
      ],
    ],
    [
      "pass with advisories",
      [
        { gateId: "agent-pack", status: "pass", message: "Passed." },
        { gateId: "taste", status: "fail", message: "Advisory failed." },
      ],
    ],
    [
      "required failure",
      [
        { gateId: "agent-pack", status: "fail", message: "Required failed." },
        { gateId: "taste", status: "pass", message: "Passed." },
      ],
    ],
  ] as const)("persists the exact %s receipt", async (_case, observations) => {
    const persist = vi.fn(async () => undefined);
    const result = await executeAgentPackCommand(
      createVerifyCommand({
        descriptors,
        runner: runner(observations),
        writer: { persist },
      }),
      { scope: "full", changed: [] },
      context,
    );

    expect(persist).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(context.repo, result.data?.receipt);
    expect(result.mutationPosture).toBe("write");
  });

  it("fails closed when the complete receipt cannot be persisted", async () => {
    const persist = vi.fn(async () => {
      throw new Error("disk unavailable");
    });
    const result = await executeAgentPackCommand(
      createVerifyCommand({
        descriptors: [requiredDescriptor],
        runner: runner([
          { gateId: "agent-pack", status: "pass", message: "Passed." },
        ]),
        writer: { persist },
      }),
      { scope: "full", changed: [] },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      summary: "Verification evidence could not be persisted.",
      diagnostics: [{ code: "AGENT_PACK_VERIFICATION_RECEIPT_PERSIST_FAILED" }],
      data: { requiredBlocking: true, receiptPersisted: false },
    });
  });

  it("fails closed when a focused selection resolves to zero gates", async () => {
    const run = vi.fn(async () => []);
    const result = await executeAgentPackCommand(
      createVerifyCommand({
        descriptors: [],
        runner: { ...runner([]), run },
      }),
      { scope: "focused", changed: [] },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [
        {
          code: "AGENT_PACK_VERIFY_GATE_SELECTION_EMPTY",
          severity: "error",
          safeToContinue: false,
          rerun: "pnpm maestro -- verify --scope focused",
        },
      ],
      data: {
        receipt: { gates: [] },
        summary: {
          status: "fail",
          requiredFailures: ["maestro/gate-selection"],
          unavailable: ["maestro/gate-selection"],
        },
        requiredBlocking: true,
      },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("returns the canonical receipt without writing the target", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "maestro-verify-read-"));
    const targetContext = {
      ...context,
      repo: createRepositoryContext({ cwd: targetRoot }),
    };
    const command = createVerifyCommand({
      descriptors: [requiredDescriptor],
      runner: runner([
        { gateId: "agent-pack", status: "pass", message: "Passed." },
      ]),
    });
    await chmod(targetRoot, 0o555);

    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      targetContext,
    ).finally(() => chmod(targetRoot, 0o755));

    expect(result).toMatchObject({
      exitClass: "success",
      mutationPosture: "read-only",
      data: {
        receipt: {
          schemaVersion: 1,
          subject: { commit: "abc123", dirty: false },
          scope: { kind: "full", changedPaths: [], partial: false },
        },
      },
    });
    expect(await readdir(targetRoot)).toEqual([]);
  });

  it("binds passing full evidence into a fresh receipt", async () => {
    const requests: VerificationRunRequest[] = [];
    const command = createVerifyCommand({
      descriptors,
      runner: runner(
        descriptors.map(({ gateId }) => ({
          gateId,
          status: "pass",
          message: "Passed.",
        })),
        requests,
      ),
    });
    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "success",
      data: {
        summary: { status: "pass" },
        receipt: {
          schemaVersion: 1,
          command: { id: "verify", version: 1 },
          subject: { commit: "abc123", dirty: false },
          scope: { kind: "full", partial: false },
        },
      },
    });
    expect(requests[0]).toMatchObject({ scope: "full", descriptors });
  });

  it("samples verification context before and after gate execution", async () => {
    const events: string[] = [];
    const command = createVerifyCommand({
      descriptors: [requiredDescriptor],
      runner: {
        inspect: async () => {
          events.push("inspect");
          return {
            createdAt: "2026-07-25T12:00:00.000Z",
            subject: { commit: "abc123", dirty: false },
            repositoryFingerprint: "repository_sha256:fixture",
            environmentFingerprint: "environment_sha256:fixture",
            providerPostureFingerprint: "providers_sha256:fixture",
          };
        },
        run: async () => {
          events.push("run");
          return [{ gateId: "agent-pack", status: "pass", message: "Passed." }];
        },
      },
    });

    await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );

    expect(events).toEqual(["inspect", "run", "inspect"]);
  });

  it("selects only declared focused gates and records partial evidence", async () => {
    const requests: VerificationRunRequest[] = [];
    const command = createVerifyCommand({
      descriptors,
      runner: runner(
        [{ gateId: "agent-pack", status: "pass", message: "Passed." }],
        requests,
      ),
    });
    const result = await executeAgentPackCommand(
      command,
      { scope: "focused", changed: ["tooling/agent-pack/src/verify.ts"] },
      context,
    );

    expect(requests[0]?.descriptors.map(({ gateId }) => gateId)).toEqual([
      "agent-pack",
    ]);
    expect(result.data).toMatchObject({
      receipt: {
        scope: {
          kind: "focused",
          changedPaths: ["tooling/agent-pack/src/verify.ts"],
          partial: true,
        },
      },
    });
  });

  it("uses only the explicit minimal default for an empty focused scope", async () => {
    const requests: VerificationRunRequest[] = [];
    const command = createVerifyCommand({
      descriptors,
      runner: runner(
        [{ gateId: "agent-pack", status: "pass", message: "Passed." }],
        requests,
      ),
    });

    await executeAgentPackCommand(
      command,
      { scope: "focused", changed: [] },
      context,
    );

    expect(requests[0]?.descriptors.map(({ gateId }) => gateId)).toEqual([
      "agent-pack",
    ]);
  });

  it("blocks a required failure with canonical repair evidence", async () => {
    const command = createVerifyCommand({
      descriptors: [requiredDescriptor],
      runner: runner([
        {
          gateId: "agent-pack",
          status: "fail",
          message: "Contract snapshot differs.",
          semanticRuleIds: ["agent-pack/result-envelope"],
        },
      ]),
    });
    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [
        {
          code: "agent-pack",
          severity: "error",
          safeToContinue: false,
          rerun: "pnpm check:agent-pack",
        },
      ],
      data: { summary: { status: "fail", requiredFailures: ["agent-pack"] } },
    });
  });

  it("reports advisory findings without required blocking", async () => {
    const command = createVerifyCommand({
      descriptors: [advisoryDescriptor],
      runner: runner([
        { gateId: "taste", status: "fail", message: "Review suggested." },
      ]),
    });
    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [
        { code: "taste", severity: "warning", safeToContinue: true },
      ],
      data: {
        requiredBlocking: false,
        summary: { status: "pass-with-advisories" },
      },
    });
  });

  it("records missing runner evidence as unavailable", async () => {
    const command = createVerifyCommand({
      descriptors: [requiredDescriptor],
      runner: runner([]),
    });
    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );
    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [
        { code: "agent-pack", message: expect.stringContaining("unavailable") },
      ],
      data: { receipt: { gates: [{ status: "unavailable" }] } },
    });
  });

  it("keeps an aggregate execution failure separate from attributed gates", async () => {
    const command = createVerifyCommand({
      descriptors: [requiredDescriptor],
      runner: runner([
        { gateId: "agent-pack", status: "pass", message: "Passed." },
        {
          gateId: "maestro/full-verify",
          status: "fail",
          message: "Aggregate failed.",
          diagnostic: {
            code: "AGENT_PACK_FULL_VERIFY_FAILED",
            severity: "error",
            message: "pnpm verify failed after attribution.",
            safeToContinue: false,
            nextAction: "Repair the owning invariant.",
            rerun: "pnpm verify",
          },
        },
      ]),
    });

    const result = await executeAgentPackCommand(
      command,
      { scope: "full", changed: [] },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_FULL_VERIFY_FAILED" }],
      data: {
        requiredBlocking: true,
        receipt: { gates: [{ gateId: "agent-pack", status: "pass" }] },
      },
    });
  });

  it.each([
    ["repository", "repositoryFingerprint", "repository_sha256:changed"],
    ["environment", "environmentFingerprint", "environment_sha256:changed"],
    [
      "provider posture",
      "providerPostureFingerprint",
      "providers_sha256:changed",
    ],
  ] as const)(
    "blocks when %s metadata changes",
    async (_name, field, afterValue) => {
      let inspection = 0;
      const command = createVerifyCommand({
        descriptors: [requiredDescriptor],
        runner: {
          inspect: async () => {
            const facts = {
              createdAt: "2026-07-25T12:00:00.000Z",
              subject: { commit: "abc123", dirty: false },
              repositoryFingerprint: "repository_sha256:fixture" as const,
              environmentFingerprint: "environment_sha256:fixture" as const,
              providerPostureFingerprint: "providers_sha256:fixture" as const,
            };
            return inspection++ === 0
              ? facts
              : { ...facts, [field]: afterValue };
          },
          run: async () => [
            { gateId: "agent-pack", status: "pass", message: "Passed." },
          ],
        },
      });

      const result = await executeAgentPackCommand(
        command,
        { scope: "full", changed: [] },
        context,
      );
      expect(result).toMatchObject({
        exitClass: "findings",
        diagnostics: [
          {
            code: "AGENT_PACK_VERIFICATION_CONTEXT_CHANGED_DURING_VERIFY",
            severity: "error",
            safeToContinue: false,
          },
        ],
        data: { requiredBlocking: true },
      });
    },
  );

  it.each([
    ["repository", "repositoryFingerprint", "repository_sha256:unavailable"],
    ["environment", "environmentFingerprint", "environment_sha256:unavailable"],
    [
      "provider posture",
      "providerPostureFingerprint",
      "providers_sha256:unavailable",
    ],
  ] as const)(
    "blocks when %s metadata is unavailable",
    async (_name, field, value) => {
      const command = createVerifyCommand({
        descriptors: [requiredDescriptor],
        runner: {
          inspect: async () => ({
            createdAt: "2026-07-25T12:00:00.000Z",
            subject: { commit: "abc123", dirty: false },
            repositoryFingerprint:
              field === "repositoryFingerprint"
                ? (value as `repository_sha256:${string}`)
                : "repository_sha256:fixture",
            environmentFingerprint:
              field === "environmentFingerprint"
                ? (value as `environment_sha256:${string}`)
                : "environment_sha256:fixture",
            providerPostureFingerprint:
              field === "providerPostureFingerprint"
                ? (value as `providers_sha256:${string}`)
                : "providers_sha256:fixture",
          }),
          run: async () => [
            { gateId: "agent-pack", status: "pass", message: "Passed." },
          ],
        },
      });

      const result = await executeAgentPackCommand(
        command,
        { scope: "full", changed: [] },
        context,
      );
      expect(result).toMatchObject({
        exitClass: "findings",
        diagnostics: [
          {
            code: "AGENT_PACK_VERIFICATION_CONTEXT_UNAVAILABLE",
            severity: "error",
            safeToContinue: false,
          },
        ],
        data: { requiredBlocking: true },
      });
    },
  );

  it.each([
    { scope: "focused", changed: [], extra: true },
    { scope: "full", changed: ["apps/cli"] },
    { scope: "focused", changed: "apps/cli" },
  ])("rejects invalid invocation shape %#", async (invocation) => {
    const command = createVerifyCommand({ descriptors, runner: runner([]) });
    await expect(
      executeAgentPackCommand(command, invocation, context),
    ).resolves.toMatchObject({ exitClass: "invalidInvocation" });
  });
});
