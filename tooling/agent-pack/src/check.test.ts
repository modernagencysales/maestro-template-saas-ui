import { describe, expect, it } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
  type AgentPackArgumentResult,
} from "./contracts.js";
import { createCheckCommand } from "./check.js";
import type { DiagnosticDescriptor } from "./diagnostics.js";
import type { PreflightInput } from "./preflight.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  createVerifyCommand,
  type VerificationRunRequest,
  type VerifyInput,
} from "./verify.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/fixture" }),
};

function commands(advisory = false) {
  const preflight = defineAgentPackCommand({
    id: "preflight",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (): AgentPackArgumentResult<PreflightInput> => ({
      ok: true,
      args: { mode: "fake" },
    }),
    mutationPosture: () => "read-only" as const,
    execute: async () => ({
      mutationPosture: "read-only" as const,
      exitClass: "success" as const,
      summary: "Preflight passed.",
      diagnostics: [],
      data: {
        fingerprint: "preflight_sha256:fixture",
        safeToMutate: true,
        worksNow: "What works now: sample data is saved locally.",
        demoOnly: "What is demo-only: provider actions use sample data.",
        nextAction: "pnpm maestro -- check",
        facts: {},
      },
    }),
  });
  const verify = defineAgentPackCommand({
    id: "verify",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (): AgentPackArgumentResult<VerifyInput> => ({
      ok: true,
      args: { scope: "focused", changed: [] },
    }),
    mutationPosture: () => "read-only" as const,
    execute: async () => ({
      mutationPosture: "read-only" as const,
      exitClass: advisory ? ("findings" as const) : ("success" as const),
      summary: advisory ? "Advisory review suggested." : "Verification passed.",
      diagnostics: advisory
        ? [
            {
              code: "taste",
              severity: "warning" as const,
              message: "Review suggested.",
              safeToContinue: true,
              nextAction: "Review the finding.",
              rerun: "pnpm taste:eval",
            },
          ]
        : [],
      data: {
        receipt: { schemaVersion: 1 },
        summary: { status: advisory ? "pass-with-advisories" : "pass" },
        requiredBlocking: false,
      },
    }),
  });
  return { preflight, verify };
}

describe("novice check composition", () => {
  it("finishes preflight before verification can persist evidence", async () => {
    const base = commands();
    const events: string[] = [];
    let releasePreflight = () => {};
    let markPreflightStarted = () => {};
    const preflightStarted = new Promise<void>((resolve) => {
      markPreflightStarted = resolve;
    });
    const preflightGate = new Promise<void>((resolve) => {
      releasePreflight = resolve;
    });
    const preflight = {
      ...base.preflight,
      execute: async (...args: Parameters<typeof base.preflight.execute>) => {
        events.push("preflight:start");
        markPreflightStarted();
        await preflightGate;
        events.push("preflight:end");
        return base.preflight.execute(...args);
      },
    };
    const verify = {
      ...base.verify,
      execute: async (...args: Parameters<typeof base.verify.execute>) => {
        events.push("verify:start");
        return base.verify.execute(...args);
      },
    };

    const execution = executeAgentPackCommand(
      createCheckCommand({ preflight, verify }),
      { mode: "fake", scope: "focused", changed: [] },
      context,
    );
    await preflightStarted;

    expect(events).toEqual(["preflight:start"]);

    releasePreflight();
    await execution;
    expect(events).toEqual([
      "preflight:start",
      "preflight:end",
      "verify:start",
    ]);
  });

  it("returns success with no diagnostics from the shared commands", async () => {
    const result = await executeAgentPackCommand(
      createCheckCommand(commands()),
      { mode: "fake", scope: "focused", changed: [] },
      context,
    );
    expect(result).toMatchObject({
      exitClass: "success",
      diagnostics: [],
      data: {
        safeToMutate: true,
        requiredBlocking: false,
        preflightFingerprint: "preflight_sha256:fixture",
      },
    });
  });

  it("keeps advisory warnings as findings without required blocking", async () => {
    const result = await executeAgentPackCommand(
      createCheckCommand(commands(true)),
      { mode: "fake", scope: "focused", changed: [] },
      context,
    );
    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ severity: "warning", safeToContinue: true }],
      data: { safeToMutate: true, requiredBlocking: false },
    });
  });

  it("keeps an empty focused check on the explicit minimal gate set", async () => {
    const descriptors: readonly DiagnosticDescriptor[] = [
      {
        gateId: "agent-pack",
        posture: "required",
        evidenceClass: "behavioral",
        canonicalDoc: "docs/template/preflight.md",
        repairHint: "Fix the reported Agent Pack invariant.",
        argv: ["pnpm", "check:agent-pack"],
        rerun: ["pnpm", "check:agent-pack"],
        defaultFocused: true,
      },
      {
        gateId: "web",
        posture: "required",
        evidenceClass: "behavioral",
        canonicalDoc: "docs/template/preflight.md",
        repairHint: "Fix the reported web invariant.",
        argv: ["pnpm", "check:web"],
        rerun: ["pnpm", "check:web"],
      },
    ];
    const requests: VerificationRunRequest[] = [];
    const verify = createVerifyCommand({
      descriptors,
      runner: {
        inspect: async () => ({
          createdAt: "2026-07-25T12:00:00.000Z",
          subject: { commit: "abc1234", dirty: false },
          repositoryFingerprint: "repository_sha256:fixture",
          environmentFingerprint: "environment_sha256:fixture",
          providerPostureFingerprint: "providers_sha256:fixture",
        }),
        run: async (request) => {
          requests.push(request);
          return request.descriptors.map(({ gateId }) => ({
            gateId,
            status: "pass" as const,
            message: "Passed.",
          }));
        },
      },
    });

    await executeAgentPackCommand(
      createCheckCommand({ preflight: commands().preflight, verify }),
      { mode: "fake", scope: "focused", changed: [] },
      context,
    );

    expect(requests[0]?.descriptors.map(({ gateId }) => gateId)).toEqual([
      "agent-pack",
    ]);
  });
});
