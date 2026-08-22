import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
} from "../contracts.js";
import { createRepositoryContext } from "../repoContext.js";
import { createSupportBundleCommand } from "../privacy/supportBundleCommand.js";
import { createMaestroMcpProjection } from "./projection.js";

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const repo = createRepositoryContext({ cwd: "/target" });
const context = {
  schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  invocation: "mcp" as const,
  repo,
};

function command<
  const Id extends "preflight" | "scaffold" | "support-bundle" | "verify",
>(
  id: Id,
  execute = vi.fn(async (args: unknown) => ({
    mutationPosture:
      id === "scaffold" || id === "support-bundle"
        ? ("preview" as const)
        : ("read-only" as const),
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
      id === "scaffold" || id === "support-bundle"
        ? ("preview" as const)
        : ("read-only" as const),
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
    scaffold: command("scaffold", scaffoldExecute),
    supportBundle: command("support-bundle"),
    verify: command("verify"),
  };
  return {
    commands,
    scaffoldExecute,
    projection: createMaestroMcpProjection(commands, repo),
  };
}

describe("Maestro MCP projection", () => {
  it("ignores the removed plan-check command even if a caller supplies it", async () => {
    const obsoletePlanExecute = vi.fn(async () => ({
      mutationPosture: "read-only" as const,
      exitClass: "success" as const,
      summary: "obsolete plan check ran",
      diagnostics: [],
      data: null,
    }));
    const obsoletePlanCheck = defineAgentPackCommand({
      id: "plan-check",
      schemaVersion: AGENT_PACK_COMMAND_VERSION,
      decode: (input: unknown) => ({ ok: true as const, args: input }),
      mutationPosture: () => "read-only" as const,
      execute: obsoletePlanExecute,
    });
    const projection = createMaestroMcpProjection(
      { ...fixture().commands, planCheck: obsoletePlanCheck } as never,
      repo,
    );

    expect(projection.tools().map(({ name }) => name)).not.toContain(
      "maestro_plan_check",
    );
    await expect(
      projection.call("maestro_plan_check", {}),
    ).resolves.toMatchObject({ isError: true, code: "MCP_UNKNOWN_TOOL" });
    expect(obsoletePlanExecute).not.toHaveBeenCalled();
  });

  it("publishes only commands retained by a customer composition", async () => {
    const commands = fixture().commands;
    const projection = createMaestroMcpProjection(
      {
        preflight: commands.preflight,
        supportBundle: commands.supportBundle,
        verify: commands.verify,
      },
      repo,
    );

    expect(projection.tools().map(({ name }) => name)).toEqual([
      "maestro_preflight",
      "maestro_support_bundle_preview",
      "maestro_verify",
    ]);
    await expect(
      projection.call("maestro_plan_check", {}),
    ).resolves.toMatchObject({ isError: true, code: "MCP_UNKNOWN_TOOL" });
  });

  it("publishes exactly the reviewed read and preview tools", () => {
    expect(
      fixture()
        .projection.tools()
        .map(({ name }) => name),
    ).toEqual([
      "maestro_preflight",
      "maestro_scaffold_preview",
      "maestro_support_bundle_preview",
      "maestro_verify",
    ]);
  });

  it("projects support preview with an empty schema and no write authority", async () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-mcp-support-"));
    temporaryRoots.push(root);
    const exporter = { export: vi.fn(async () => ({ bytes: 1 })) };
    const commands = {
      ...fixture().commands,
      supportBundle: createSupportBundleCommand({
        load: async () => ({ host: { kind: "unknown" }, providers: [] }),
        exporter,
      }),
    };
    const projection = createMaestroMcpProjection(
      commands,
      createRepositoryContext({ cwd: root }),
    );
    expect(
      projection
        .tools()
        .find(({ name }) => name === "maestro_support_bundle_preview"),
    ).toMatchObject({
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    });

    await expect(
      projection.call("maestro_support_bundle_preview", {}),
    ).resolves.toMatchObject({
      isError: false,
      structuredContent: {
        mutationPosture: "preview",
        data: { write: false, exportedBytes: null },
      },
    });
    expect(exporter.export).not.toHaveBeenCalled();
    expect(existsSync(join(root, ".maestro"))).toBe(false);
  });

  it.each([
    { write: true },
    { output: ".maestro/support/canary.json" },
    { export: true },
    { previewFingerprint: `support_preview_sha256:${"0".repeat(64)}` },
  ])("rejects MCP support export authority %#", async (authority) => {
    const { projection, commands } = fixture();
    const result = await projection.call(
      "maestro_support_bundle_preview",
      authority,
    );
    expect(result).toMatchObject({ isError: true });
    expect(commands.supportBundle.execute).not.toHaveBeenCalled();
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
