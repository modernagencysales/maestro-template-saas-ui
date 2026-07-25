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
    environmentFingerprint: "env:fixture",
    providerPostureFingerprint: "providers:fake",
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
});
