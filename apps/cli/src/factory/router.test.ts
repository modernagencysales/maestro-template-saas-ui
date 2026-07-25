import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it, vi } from "vitest";
import {
  createFactoryCliHandler,
  dispatchFactoryCliCommand,
  runAgentPackCommandAsCli,
} from "./router";

describe("factory CLI adapter", () => {
  it("projects invalid input through the shared command executor", async () => {
    const command = defineAgentPackCommand({
      id: "test.invalid",
      schemaVersion: 1,
      decode: () => ({
        ok: false as const,
        diagnostics: [
          {
            code: "TEST_INVALID",
            severity: "error" as const,
            message: "Invalid fixture.",
            safeToContinue: true,
            nextAction: "Use valid fixture input.",
            rerun: "pnpm maestro -- test.invalid",
          },
        ],
      }),
      mutationPosture: () => "read-only" as const,
      execute: async () => {
        throw new Error("decode failures must not execute");
      },
    });
    const result = await runAgentPackCommandAsCli(
      command,
      {},
      {
        schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
        invocation: "cli",
        repo: {
          schemaVersion: 1,
          workingDirectory: "/fixture",
          sourceRoot: "/fixture",
          templateRoot: "/fixture",
          targetRoot: "/fixture",
        },
      },
      "json",
    );
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      command: { id: "test.invalid", version: 1 },
      exitClass: "invalidInvocation",
      diagnostics: [{ code: "TEST_INVALID" }],
    });
  });

  it("constructs registered handlers through the shared executor", async () => {
    const command = defineAgentPackCommand({
      id: "test.success",
      schemaVersion: 1,
      decode: () => ({ ok: true as const, args: {} }),
      mutationPosture: () => "read-only" as const,
      execute: async () => ({
        mutationPosture: "read-only" as const,
        exitClass: "success" as const,
        summary: "Factory command passed.",
        diagnostics: [],
        data: { passed: true },
      }),
    });
    const handler = createFactoryCliHandler(command);
    const result = await handler.run(["test.success"], "/fixture");
    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "Factory command passed.\n",
    });
  });

  it("leaves unknown commands to the legacy fallback", async () => {
    await expect(
      dispatchFactoryCliCommand([], ["legacy-command"], "/fixture"),
    ).resolves.toBeUndefined();
  });

  it("injects the registry and preserves the caller cwd for JSON commands", async () => {
    const run = vi.fn(async (_argv: readonly string[], cwd: string) => ({
      exitCode: 0 as const,
      stdout: `${JSON.stringify({ cwd })}\n`,
      stderr: "",
    }));
    const handlers = [{ command: "check", run }];

    const first = await dispatchFactoryCliCommand(
      handlers,
      ["check", "--json"],
      "/tmp/customer-a",
    );
    const second = await dispatchFactoryCliCommand(
      handlers,
      ["check", "--json"],
      "/tmp/customer-b",
    );

    expect(JSON.parse(first?.stdout ?? "{}")).toEqual({
      cwd: "/tmp/customer-a",
    });
    expect(JSON.parse(second?.stdout ?? "{}")).toEqual({
      cwd: "/tmp/customer-b",
    });
    expect(run.mock.calls.map((call) => call[1])).toEqual([
      "/tmp/customer-a",
      "/tmp/customer-b",
    ]);
  });
});
