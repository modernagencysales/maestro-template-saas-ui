import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
} from "../contracts.js";
import { createRepositoryContext } from "../repoContext.js";
import { createMaestroMcpProjection } from "./projection.js";

const repo = createRepositoryContext({ cwd: "/target" });
const context = {
  schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  invocation: "mcp" as const,
  repo,
};

function command<
  const Id extends "preflight" | "plan-check" | "scaffold" | "verify",
>(
  id: Id,
  execute = vi.fn(async (args: unknown) => ({
    mutationPosture:
      id === "scaffold" ? ("preview" as const) : ("read-only" as const),
    exitClass: "success" as const,
    summary: `${id} passed.`,
    diagnostics: [],
    data: { received: JSON.stringify(args) },
  })),
) {
  return defineAgentPackCommand({
    id,
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (input: unknown) => ({ ok: true as const, args: input }),
    mutationPosture: () =>
      id === "scaffold" ? ("preview" as const) : ("read-only" as const),
    execute,
  });
}

function fixture() {
  const scaffoldExecute = vi.fn(
    async (args: unknown, received: typeof context) => ({
      mutationPosture: "preview" as const,
      exitClass: "success" as const,
      summary: "scaffold passed.",
      diagnostics: [],
      data: {
        received: JSON.stringify(args),
        invocation: received.invocation,
        root: received.repo.targetRoot,
      },
    }),
  );
  const commands = {
    preflight: command("preflight"),
    planCheck: command("plan-check"),
    scaffold: command("scaffold", scaffoldExecute),
    verify: command("verify"),
  };
  return {
    commands,
    scaffoldExecute,
    projection: createMaestroMcpProjection(commands, repo),
  };
}

describe("Maestro MCP projection", () => {
  it("publishes exactly the four reviewed read-oriented tools", () => {
    expect(
      fixture()
        .projection.tools()
        .map(({ name }) => name),
    ).toEqual([
      "maestro_preflight",
      "maestro_plan_check",
      "maestro_scaffold_preview",
      "maestro_verify",
    ]);
  });

  it("returns the same typed result as direct command execution", async () => {
    const { commands, projection } = fixture();
    const direct = await executeAgentPackCommand(
      commands.preflight,
      { mode: "fake" },
      context,
    );
    const projected = await projection.call("maestro_preflight", {
      mode: "fake",
    });
    expect(projected).toMatchObject({
      isError: false,
      structuredContent: direct,
    });
  });

  it("injects repository context and forces scaffold preview", async () => {
    const { projection, scaffoldExecute } = fixture();
    const result = await projection.call("maestro_scaffold_preview", {
      generatorId: "add-capability",
      args: { name: "previewOnly" },
    });
    expect(result.isError).toBe(false);
    expect(scaffoldExecute).toHaveBeenCalledWith(
      expect.objectContaining({ write: false }),
      context,
    );
  });

  it("rejects an explicit scaffold write before command execution", async () => {
    const { projection, scaffoldExecute } = fixture();
    const result = await projection.call("maestro_scaffold_preview", {
      generatorId: "add-capability",
      args: {},
      write: true,
    });
    expect(result).toMatchObject({
      isError: true,
      code: "MCP_FORBIDDEN_ARGUMENT",
    });
    expect(scaffoldExecute).not.toHaveBeenCalled();
  });

  it("permits declared plan generator commands without granting arbitrary execution", async () => {
    const result = await fixture().projection.call("maestro_plan_check", {
      plan: {
        feature: "x",
        slices: [
          {
            workPackages: [
              { generatorCommand: "pnpm template:add-capability" },
            ],
          },
        ],
        allTaskRefs: [],
      },
    });
    expect(result.isError).toBe(false);
  });

  it.each([
    ["identity", { identity: "user" }],
    ["workspace", { workspaceId: "workspace" }],
    ["token", { token: "value" }],
    ["function reference", { functionRef: "api.admin.run" }],
    ["arbitrary command", { command: "rm" }],
    ["mutating scaffold", { write: true }],
    ["production mode", { mode: "production" }],
    ["secret field", { apiKey: "value" }],
    ["production flag", { mode: "--prod" }],
  ])("rejects %s authority", async (_case, forbidden) => {
    const result = await fixture().projection.call(
      "maestro_preflight",
      forbidden,
    );
    expect(result).toMatchObject({
      isError: true,
      code: "MCP_FORBIDDEN_ARGUMENT",
    });
    expect(JSON.stringify(result)).not.toContain("value");
  });

  it("rejects unknown tools", async () => {
    await expect(
      fixture().projection.call("maestro_unknown", {}),
    ).resolves.toMatchObject({
      isError: true,
      code: "MCP_UNKNOWN_TOOL",
    });
  });
});
