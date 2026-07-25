import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it } from "vitest";
import { runVerifyCli } from "./verify";

const verifyCommand = defineAgentPackCommand({
  id: "verify",
  schemaVersion: AGENT_PACK_COMMAND_VERSION,
  decode: (input: unknown) => {
    if (typeof input === "object" && input !== null && "scope" in input) {
      return {
        ok: true as const,
        args: {
          scope: String(input.scope),
          changed:
            "changed" in input && Array.isArray(input.changed)
              ? input.changed.map(String)
              : [],
        },
      };
    }
    return {
      ok: false as const,
      diagnostics: [
        {
          code: "AGENT_PACK_VERIFY_INVALID",
          severity: "error" as const,
          message: "Invalid verification scope.",
          safeToContinue: false,
          nextAction: "Choose focused or full.",
          rerun: "pnpm maestro -- verify --scope focused",
        },
      ],
    };
  },
  mutationPosture: () => "read-only" as const,
  execute: async (input) => ({
    mutationPosture: "read-only" as const,
    exitClass: "success" as const,
    summary: "Verification passed.",
    diagnostics: [],
    data: input,
  }),
});

describe("verify CLI adapter", () => {
  it("projects focused changed paths through the shared command", async () => {
    const result = await runVerifyCli(
      verifyCommand,
      [
        "verify",
        "--scope",
        "focused",
        "--changed",
        "apps/cli,tooling/agent-pack",
        "--json",
      ],
      "/fixture",
    );

    expect(JSON.parse(result.stdout)).toMatchObject({
      command: { id: "verify", version: 1 },
      data: {
        scope: "focused",
        changed: ["apps/cli", "tooling/agent-pack"],
      },
    });
  });

  it("defaults to concise focused verification", async () => {
    await expect(
      runVerifyCli(verifyCommand, ["verify"], "/fixture"),
    ).resolves.toMatchObject({ exitCode: 0, stdout: "Verification passed.\n" });
  });
});
