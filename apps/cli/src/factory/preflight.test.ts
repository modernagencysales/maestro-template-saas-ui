import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it } from "vitest";
import { runPreflightCli } from "./preflight";

const command = defineAgentPackCommand({
  id: "preflight",
  schemaVersion: AGENT_PACK_COMMAND_VERSION,
  decode: (input: unknown) =>
    typeof input === "object" &&
    input !== null &&
    "mode" in input &&
    ["fake", "test", "live"].includes(String(input.mode))
      ? { ok: true as const, args: { mode: String(input.mode) } }
      : {
          ok: false as const,
          diagnostics: [
            {
              code: "AGENT_PACK_PREFLIGHT_INVALID",
              severity: "error" as const,
              message: "Invalid preflight mode.",
              safeToContinue: false,
              nextAction: "Choose fake, test, or live.",
              rerun: "pnpm maestro -- preflight --mode fake",
            },
          ],
        },
  mutationPosture: () => "read-only" as const,
  execute: async ({ mode }) => ({
    mutationPosture: "read-only" as const,
    exitClass: "success" as const,
    summary: `Preflight passed in ${mode} mode.`,
    diagnostics: [],
    data: { mode },
  }),
});

describe("preflight CLI adapter", () => {
  it("projects JSON from the shared command result", async () => {
    const result = await runPreflightCli(
      command,
      ["preflight", "--mode", "test", "--json"],
      "/fixture",
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: { id: "preflight", version: 1 },
      mutationPosture: "read-only",
      data: { mode: "test" },
    });
  });

  it("renders human output without a second behavior path", async () => {
    await expect(
      runPreflightCli(command, ["preflight"], "/fixture"),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: "Preflight passed in fake mode.\n",
    });
  });

  it("returns the shared invalid-invocation envelope", async () => {
    const result = await runPreflightCli(
      command,
      ["preflight", "--mode", "production", "--json"],
      "/fixture",
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitClass: "invalidInvocation",
      diagnostics: [{ code: "AGENT_PACK_PREFLIGHT_INVALID" }],
    });
  });

  it.each([
    ["unknown option", ["preflight", "--wat", "--json"]],
    [
      "duplicate mode",
      ["preflight", "--mode", "fake", "--mode", "test", "--json"],
    ],
    ["missing mode", ["preflight", "--mode", "--json"]],
  ])("fails closed for %s", async (_name, argv) => {
    const result = await runPreflightCli(command, argv, "/fixture");
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitClass: "invalidInvocation",
      diagnostics: [{ code: "AGENT_PACK_PREFLIGHT_INVALID" }],
    });
  });
});
