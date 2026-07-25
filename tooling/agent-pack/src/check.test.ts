import { describe, expect, it } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
  type AgentPackArgumentResult,
} from "./contracts.js";
import { createCheckCommand } from "./check.js";
import type { PreflightInput } from "./preflight.js";
import { createRepositoryContext } from "./repoContext.js";
import type { VerifyInput } from "./verify.js";

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
});
