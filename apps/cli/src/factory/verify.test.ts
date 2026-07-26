import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import { describe, expect, it } from "vitest";
import { runReceiptExportCli, runVerifyCli } from "./verify";

const verifyCommand = defineAgentPackCommand({
  id: "verify",
  schemaVersion: AGENT_PACK_COMMAND_VERSION,
  decode: (input: unknown) => {
    if (
      typeof input === "object" &&
      input !== null &&
      "scope" in input &&
      (input.scope === "focused" || input.scope === "full")
    ) {
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

  it("keeps receipt export preview-only unless write and fingerprint are explicit", async () => {
    const exportCommand = defineAgentPackCommand({
      id: "verify-export",
      schemaVersion: AGENT_PACK_COMMAND_VERSION,
      decode: (input: unknown) => ({
        ok: true as const,
        args: input as { readonly write: boolean },
      }),
      mutationPosture: (input: { readonly write: boolean }) =>
        input.write ? ("write" as const) : ("preview" as const),
      execute: async (input: { readonly write: boolean }) => ({
        mutationPosture: input.write
          ? ("write" as const)
          : ("preview" as const),
        exitClass: "success" as const,
        summary: "Receipt export ready.",
        diagnostics: [],
        data: input,
      }),
    });
    const preview = await runReceiptExportCli(
      exportCommand,
      ["verify-export", "--scope", "full", "--json"],
      "/fixture",
    );
    const write = await runReceiptExportCli(
      exportCommand,
      [
        "verify-export",
        "--scope",
        "full",
        "--fingerprint",
        `preflight_sha256:${"a".repeat(64)}`,
        "--write",
        "--json",
      ],
      "/fixture",
    );

    expect(JSON.parse(preview.stdout)).toMatchObject({
      mutationPosture: "preview",
      data: { scope: "full", changed: [], write: false },
    });
    expect(JSON.parse(write.stdout)).toMatchObject({
      mutationPosture: "write",
      data: {
        scope: "full",
        changed: [],
        write: true,
        fingerprint: expect.stringMatching(/^preflight_sha256:/),
      },
    });
  });

  it("defaults to concise focused verification", async () => {
    await expect(
      runVerifyCli(verifyCommand, ["verify"], "/fixture"),
    ).resolves.toMatchObject({ exitCode: 0, stdout: "Verification passed.\n" });
  });

  it("passes one explicit provider mode only to check", async () => {
    const checkCommand = defineAgentPackCommand({
      id: "check",
      schemaVersion: AGENT_PACK_COMMAND_VERSION,
      decode: (input: unknown) => ({ ok: true as const, args: input }),
      mutationPosture: () => "read-only" as const,
      execute: async (input) => ({
        mutationPosture: "read-only" as const,
        exitClass: "success" as const,
        summary: "Check passed.",
        diagnostics: [],
        data: input as AgentPackJsonValue,
      }),
    });

    const result = await runVerifyCli(
      checkCommand,
      ["check", "--mode", "test", "--json"],
      "/fixture",
    );

    expect(JSON.parse(result.stdout).data).toEqual({
      mode: "test",
      scope: "focused",
      changed: [],
    });
  });

  it.each([
    ["unknown option", ["verify", "--wat", "--json"]],
    [
      "duplicate scope",
      ["verify", "--scope", "focused", "--scope", "full", "--json"],
    ],
    ["missing changed value", ["verify", "--changed", "--json"]],
    [
      "empty changed segment",
      ["verify", "--changed", "apps/cli,,tooling", "--json"],
    ],
    [
      "full changed paths",
      ["verify", "--scope", "full", "--changed", "apps/cli", "--json"],
    ],
    ["verify mode", ["verify", "--mode", "fake", "--json"]],
  ])("fails closed for %s", async (_name, argv) => {
    const result = await runVerifyCli(verifyCommand, argv, "/fixture");
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitClass: "invalidInvocation",
      diagnostics: [{ code: "AGENT_PACK_VERIFY_INVALID" }],
    });
  });
});
