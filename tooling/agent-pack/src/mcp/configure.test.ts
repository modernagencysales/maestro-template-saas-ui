import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  executeAgentPackCommand,
} from "../contracts.js";
import { parseConvexMcpProfiles } from "../pluginContract.js";
import { createRepositoryContext } from "../repoContext.js";
import {
  createMcpConfigureCommand,
  type McpConfigurationReceipt,
  type McpConfigurationStore,
} from "./configure.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const repo = createRepositoryContext({ cwd: repoRoot });
const context = {
  schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  invocation: "cli" as const,
  repo,
};

async function fixture(store: McpConfigurationStore = inertStore()) {
  const contract = parseConvexMcpProfiles(
    JSON.parse(
      await readFile(
        `${repoRoot}/docs/template/convex-mcp-profiles.json`,
        "utf8",
      ),
    ),
  );
  return {
    store,
    command: createMcpConfigureCommand({
      contract,
      observedTools: async () => contract.upstreamToolInventory,
      store,
    }),
  };
}

describe("MCP configure lifecycle", () => {
  it("returns a typed inspect preview by default without applying", async () => {
    const store = inertStore();
    const { command } = await fixture(store);
    const result = await executeAgentPackCommand(
      command,
      { host: "claude-code" },
      context,
    );
    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      diagnostics: [
        expect.objectContaining({
          code: "AGENT_PACK_PRIVACY_FIRST_RUN",
          severity: "info",
        }),
      ],
      data: {
        action: "preview",
        host: "claude-code",
        profile: "inspect",
        autoStart: false,
        privacy: {
          host: { kind: "claude-code" },
          providers: {
            selected: ["convex-dev"],
            explicitOptInRequired: true,
          },
        },
        receipt: {
          schemaVersion: 1,
          owner: "maestro-agent-pack",
          scope: "local",
          registration: "convex",
          repoRoot: repo.sourceRoot,
        },
      },
    });
    expect(store.apply).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("applies only with explicit write and emits a removable receipt", async () => {
    const store = inertStore();
    const { command } = await fixture(store);
    const result = await executeAgentPackCommand(
      command,
      {
        host: "codex",
        profile: "dev-power",
        write: true,
        privacyReviewed: true,
      },
      context,
    );
    expect(result).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      diagnostics: [
        expect.objectContaining({ code: "AGENT_PACK_PRIVACY_FIRST_RUN" }),
      ],
      data: {
        action: "apply",
        host: "codex",
        profile: "dev-power",
        status: "created",
        autoStart: false,
      },
    });
    expect(store.apply).toHaveBeenCalledOnce();
    const receipt = store.apply.mock.calls[0]?.[0];
    expect(receipt).toMatchObject({
      owner: "maestro-agent-pack",
      scope: "local",
      registration: "convex",
      host: "codex",
      repoRoot: repo.sourceRoot,
      profile: "dev-power",
    });
    expect(JSON.stringify(receipt)).not.toContain("production");
  });

  it("refuses apply until the host/provider disclosure is reviewed", async () => {
    const store = inertStore();
    const { command } = await fixture(store);
    const result = await executeAgentPackCommand(
      command,
      { host: "codex", write: true },
      context,
    );

    expect(result.exitClass).toBe("invalidInvocation");
    expect(store.apply).not.toHaveBeenCalled();
  });

  it("removes only the exact receipt-owned local registration", async () => {
    const store = inertStore();
    store.remove.mockResolvedValueOnce({ status: "removed" });
    const { command } = await fixture(store);
    const result = await executeAgentPackCommand(
      command,
      { host: "claude-code", remove: true },
      context,
    );
    expect(result).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      diagnostics: [],
      data: {
        action: "remove",
        host: "claude-code",
        status: "removed",
      },
    });
    expect(store.remove).toHaveBeenCalledWith({
      owner: "maestro-agent-pack",
      scope: "local",
      registration: "convex",
      host: "claude-code",
      repoRoot: repo.sourceRoot,
    });
    expect(store.apply).not.toHaveBeenCalled();
  });

  it("fails closed when owned configuration cannot be safely removed", async () => {
    const store = inertStore();
    store.remove.mockResolvedValueOnce({ status: "refused" });
    const { command } = await fixture(store);
    const result = await executeAgentPackCommand(
      command,
      { host: "codex", remove: true },
      context,
    );
    expect(result).toMatchObject({
      mutationPosture: "write",
      exitClass: "unavailableDependency",
      diagnostics: [
        expect.objectContaining({
          code: "MCP_CONFIG_REMOVE_REFUSED",
          safeToContinue: false,
        }),
      ],
    });
  });

  it.each([
    ["production", { host: "codex", profile: "production" }],
    ["fake", { host: "codex", profile: "fake" }],
    [
      "write and remove",
      { host: "codex", write: true, privacyReviewed: true, remove: true },
    ],
    ["remove profile", { host: "codex", remove: true, profile: "inspect" }],
    ["arbitrary path", { host: "codex", path: "/tmp/config" }],
    ["arbitrary command", { host: "codex", command: "convex" }],
    ["unknown host", { host: "other" }],
  ])("rejects %s authority", async (_case, input) => {
    const store = inertStore();
    const { command } = await fixture(store);
    const result = await executeAgentPackCommand(command, input, context);
    expect(result).toMatchObject({ exitClass: "invalidInvocation" });
    expect(store.apply).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("does not add configure as an MCP protocol tool", async () => {
    const source = await readFile(
      `${repoRoot}/tooling/agent-pack/src/mcp/projection.ts`,
      "utf8",
    );
    expect(source).not.toContain("maestro_mcp_configure");
  });
});

function inertStore() {
  return {
    apply: vi.fn(async (receipt: McpConfigurationReceipt) => {
      void receipt;
      return { status: "created" as const };
    }),
    remove: vi.fn(async () => ({ status: "absent" as const })),
  };
}
