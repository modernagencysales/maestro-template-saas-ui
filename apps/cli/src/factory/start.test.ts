import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it, vi } from "vitest";
import {
  START_HELP,
  createStartCliHandler,
  parseStartTargetInstance,
  runStartCli,
} from "./start";

function command() {
  return defineAgentPackCommand({
    id: "start",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (input: unknown) => ({ ok: true as const, args: input }),
    mutationPosture: () => "read-only" as const,
    execute: vi.fn(async (args) => ({
      mutationPosture: "read-only" as const,
      exitClass: "success" as const,
      summary: `Start ${JSON.stringify(args)}.`,
      diagnostics: [],
      data: { args: JSON.stringify(args) },
    })),
  });
}

describe("start CLI adapter", () => {
  it("defaults to fake and accepts one explicit local mode", async () => {
    const start = command();
    await runStartCli(start, ["start"], "/customer");
    await runStartCli(start, ["start", "--mode", "local"], "/customer");

    expect(start.execute).toHaveBeenNthCalledWith(
      1,
      { mode: "fake" },
      expect.objectContaining({
        repo: expect.objectContaining({ targetRoot: "/customer" }),
      }),
    );
    expect(start.execute).toHaveBeenNthCalledWith(
      2,
      { mode: "local" },
      expect.anything(),
    );
  });

  it("passes invalid, duplicate, and promotion modes to closed decoding", async () => {
    const start = command();
    for (const argv of [
      ["start", "--mode", "production"],
      ["start", "--mode", "fake", "--mode", "dev"],
      ["start", "--unknown"],
    ]) {
      await runStartCli(start, argv, "/customer");
    }
    expect(start.execute).toHaveBeenNthCalledWith(
      1,
      { mode: "production" },
      expect.anything(),
    );
    expect(start.execute).toHaveBeenNthCalledWith(
      2,
      { mode: "__invalid__" },
      expect.anything(),
    );
    expect(start.execute).toHaveBeenNthCalledWith(
      3,
      { mode: "__invalid__" },
      expect.anything(),
    );
  });

  it("supports exact help and JSON rendering", async () => {
    const start = command();
    const handler = createStartCliHandler(start);
    await expect(
      handler.run(["start", "--help"], "/customer"),
    ).resolves.toEqual({
      exitCode: 0,
      stdout: START_HELP,
      stderr: "",
    });
    const json = await handler.run(["start", "--json"], "/customer");
    expect(JSON.parse(json.stdout)).toMatchObject({ command: { id: "start" } });
  });

  it("projects the accepted customer identity through canonical preflight defaults", () => {
    const canonical = vi.fn(() => {
      throw new Error("legacy instance required");
    });
    const customerDefault = vi.fn((name: string) => ({ name, mode: "fake" }));
    expect(
      parseStartTargetInstance(
        JSON.stringify({
          personalization: { name: "My App", firstOutcome: "Track requests" },
        }),
        canonical,
        customerDefault,
      ),
    ).toEqual({ name: "My App", mode: "fake" });
    expect(customerDefault).toHaveBeenCalledWith("My App");
    expect(() =>
      parseStartTargetInstance("{}", canonical, customerDefault),
    ).toThrow("legacy instance required");
  });
});
