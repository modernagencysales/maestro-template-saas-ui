import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it, vi } from "vitest";
import {
  START_HELP,
  createStartOutputBoundary,
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

  it("parses each explicit port override as an integer", async () => {
    const start = command();
    await runStartCli(
      start,
      [
        "start",
        "--mode",
        "local",
        "--web-port",
        "6173",
        "--convex-port",
        "4210",
        "--convex-site-port",
        "4211",
        "--readiness-port",
        "6174",
      ],
      "/customer",
    );

    expect(start.execute).toHaveBeenCalledWith(
      {
        mode: "local",
        ports: {
          web: 6173,
          convex: 4210,
          convexSite: 4211,
          readinessPresenter: 6174,
        },
      },
      expect.anything(),
    );
  });

  it("passes invalid, duplicate, and promotion modes to closed decoding", async () => {
    const start = command();
    for (const argv of [
      ["start", "--mode", "production"],
      ["start", "--mode", "fake", "--mode", "dev"],
      ["start", "--unknown"],
      ["start", "--web-port", "1023"],
      ["start", "--web-port", "5173.5"],
      ["start", "--web-port", "5173", "--web-port", "6173"],
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

  it("routes human readiness to progress while JSON stdout stays result-only", async () => {
    const stderrProgress = vi.fn();
    const output = createStartOutputBoundary(stderrProgress);
    const start = command();
    vi.mocked(start.execute).mockImplementation(async (args) => {
      output.write("[maestro] Ready at http://127.0.0.1:5173");
      output.write("[web] child log");
      return {
        mutationPosture: "read-only",
        exitClass: "success",
        summary: "Stopped.",
        diagnostics: [],
        data: { args: JSON.stringify(args) },
      };
    });
    const handler = createStartCliHandler(start, output);
    const json = await handler.run(["start", "--json"], "/customer");

    expect(stderrProgress).not.toHaveBeenCalled();
    expect(json.stdout.trim().split("\n")[0]).toBe("{");
    expect(JSON.parse(json.stdout)).toMatchObject({
      schemaVersion: 1,
      command: { id: "start", version: 1 },
    });

    const human = await handler.run(["start", "--human"], "/customer");
    expect(human.stdout).not.toContain("Ready at");
    expect(human.stderr).toBe("");
    expect(stderrProgress).toHaveBeenCalledWith(
      "[maestro] Ready at http://127.0.0.1:5173",
    );
    expect(stderrProgress).toHaveBeenCalledWith("[web] child log");
  });

  it("projects the accepted customer identity through canonical preflight defaults", () => {
    const canonical = vi.fn(() => {
      throw new Error("legacy instance required");
    });
    const customerDefault = vi.fn(
      (identity: { readonly name: string; readonly blueprint: string }) => ({
        ...identity,
        mode: "fake",
      }),
    );
    expect(
      parseStartTargetInstance(
        JSON.stringify({
          personalization: { name: "My App", firstOutcome: "Track requests" },
          blueprint: { id: "saas-application" },
        }),
        canonical,
        customerDefault,
      ),
    ).toEqual({
      name: "My App",
      blueprint: "saas-application",
      mode: "fake",
    });
    expect(customerDefault).toHaveBeenCalledWith({
      name: "My App",
      blueprint: "saas-application",
    });
    expect(() =>
      parseStartTargetInstance("{}", canonical, customerDefault),
    ).toThrow("legacy instance required");
  });
});
