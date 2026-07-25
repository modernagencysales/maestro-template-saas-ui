import { describe, expect, it } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import type { DiagnosticDescriptor } from "./diagnostics.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  createVerifyCommand,
  type VerificationRunObservation,
  type VerificationRunRequest,
  type VerificationRunner,
} from "./verify.js";

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
      descriptors: [descriptors[0]!],
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
      descriptors: [descriptors[0]!],
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
      descriptors: [descriptors[1]!],
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
      descriptors: [descriptors[0]!],
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
        descriptors: [descriptors[0]!],
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
        descriptors: [descriptors[0]!],
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
