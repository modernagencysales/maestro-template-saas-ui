import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRepositoryContext } from "../repoContext.js";
import type { VerificationExecFile } from "../verificationRunner.js";
import type { McpConfigurationReceipt } from "./configure.js";
import {
  createRepositoryLocalMcpConfigurationStore,
  readInstalledConvexMcpInventory,
} from "./nodeConfigure.js";

const inventory = [
  "data",
  "envGet",
  "envList",
  "envRemove",
  "envSet",
  "functionSpec",
  "insights",
  "logs",
  "run",
  "runOneoffQuery",
  "status",
  "tables",
] as const;

describe("repository-local MCP configuration store", () => {
  it("parses only the audited installed Convex inventory", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-mcp-inventory-"));
    const execFile = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: `Options:\n  --disable-tools <tool-names>  Comma separated list (options: ${inventory.join(", ")})\n`,
      stderr: "",
    }));
    await expect(
      readInstalledConvexMcpInventory({
        execFile,
        repo: createRepositoryContext({ cwd: root }),
      }),
    ).resolves.toEqual(inventory);
    expect(execFile).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "convex", "mcp", "start", "--help"],
      expect.objectContaining({ cwd: root }),
    );
  });

  it("fails closed for missing or malformed installed inventory", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-mcp-inventory-"));
    for (const result of [
      { exitCode: null, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "--disable-tools without inventory", stderr: "" },
    ] as const) {
      await expect(
        readInstalledConvexMcpInventory({
          execFile: async () => result,
          repo: createRepositoryContext({ cwd: root }),
        }),
      ).rejects.toThrow("installed Convex MCP inventory unavailable");
    }
  });

  it("preserves Maestro and unrelated TOML while owning only the Codex Convex section", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-mcp-codex-"));
    await mkdir(join(root, ".codex"), { recursive: true });
    const original = [
      "[mcp_servers.maestro]",
      'command = "pnpm"',
      'args = ["maestro", "--", "mcp"]',
      "",
      "[features]",
      "example = true",
      "",
    ].join("\n");
    await writeFile(join(root, ".codex/config.toml"), original);
    const store = createRepositoryLocalMcpConfigurationStore({
      execFile: unexpectedExec(),
    });
    const receipt = codexReceipt(root);

    await expect(store.apply(receipt)).resolves.toEqual({ status: "created" });
    const installed = await readFile(join(root, ".codex/config.toml"), "utf8");
    expect(installed).toContain(original);
    expect(installed).toContain("[mcp_servers.convex]");

    await writeFile(
      join(root, ".codex/config.toml"),
      installed.replace("enabled = true", "enabled = false"),
    );
    await expect(store.remove(key("codex", root))).resolves.toEqual({
      status: "refused",
    });
    await writeFile(join(root, ".codex/config.toml"), installed);
    await expect(store.remove(key("codex", root))).resolves.toEqual({
      status: "removed",
    });
    expect(await readFile(join(root, ".codex/config.toml"), "utf8")).toBe(
      original,
    );
  });

  it("refuses unowned Codex or Claude registrations", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-mcp-unowned-"));
    await mkdir(join(root, ".codex"), { recursive: true });
    await writeFile(
      join(root, ".codex/config.toml"),
      '[mcp_servers.convex]\ncommand = "other"\n',
    );
    const codex = createRepositoryLocalMcpConfigurationStore({
      execFile: unexpectedExec(),
    });
    await expect(codex.apply(codexReceipt(root))).resolves.toEqual({
      status: "refused",
    });

    const claude = createRepositoryLocalMcpConfigurationStore({
      execFile: claudeRuntime({ current: "changed-local-registration\n" }),
    });
    await expect(claude.apply(claudeReceipt(root))).resolves.toEqual({
      status: "refused",
    });
    await expect(claude.remove(key("claude-code", root))).resolves.toEqual({
      status: "refused",
    });
  });

  it("uses Claude local scope and refuses byte changes before exact removal", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-mcp-claude-"));
    const state = { current: undefined as string | undefined };
    const execFile = claudeRuntime(state);
    const store = createRepositoryLocalMcpConfigurationStore({ execFile });
    const receipt = claudeReceipt(root);

    await expect(store.apply(receipt)).resolves.toEqual({ status: "created" });
    expect(execFile).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["add", "--scope", "local", "convex"]),
      expect.objectContaining({ cwd: root }),
    );
    state.current = `${state.current}changed`;
    await expect(store.remove(key("claude-code", root))).resolves.toEqual({
      status: "refused",
    });
    state.current = "claude-local-convex\n";
    await expect(store.remove(key("claude-code", root))).resolves.toEqual({
      status: "removed",
    });
    expect(execFile).toHaveBeenCalledWith(
      "claude",
      ["mcp", "remove", "--scope", "local", "convex"],
      expect.objectContaining({ cwd: root }),
    );
  });
});

function key(host: "claude-code" | "codex", repoRoot: string) {
  return {
    owner: "maestro-agent-pack" as const,
    scope: "local" as const,
    registration: "convex" as const,
    host,
    repoRoot,
  };
}

function codexReceipt(repoRoot: string): McpConfigurationReceipt {
  return {
    schemaVersion: 1,
    owner: "maestro-agent-pack",
    scope: "local",
    registration: "convex",
    host: "codex",
    repoRoot,
    profile: "inspect",
    autoStart: false,
    installation: {
      kind: "managed-section",
      content: `[mcp_servers.convex]\ncommand = "pnpm"\nargs = ["exec", "convex", "mcp", "start", "--project-dir", ".", "--deployment", "dev", "--disable-tools", "data,envGet,envList,envRemove,envSet,logs,run,runOneoffQuery"]\ncwd = ${JSON.stringify(repoRoot)}\nenabled = true\n`,
    },
    removal: { command: "codex", args: ["mcp", "remove", "convex"] },
  };
}

function claudeReceipt(repoRoot: string): McpConfigurationReceipt {
  return {
    schemaVersion: 1,
    owner: "maestro-agent-pack",
    scope: "local",
    registration: "convex",
    host: "claude-code",
    repoRoot,
    profile: "inspect",
    autoStart: false,
    installation: {
      kind: "host-command",
      command: {
        command: "claude",
        args: [
          "mcp",
          "add",
          "--transport",
          "stdio",
          "--scope",
          "local",
          "convex",
          "--",
          "pnpm",
          "exec",
          "convex",
          "mcp",
          "start",
          "--project-dir",
          ".",
          "--deployment",
          "dev",
          "--disable-tools",
          "data,envGet,envList,envRemove,envSet,logs,run,runOneoffQuery",
        ],
      },
    },
    removal: {
      command: "claude",
      args: ["mcp", "remove", "--scope", "local", "convex"],
    },
  };
}

function unexpectedExec(): VerificationExecFile {
  return vi.fn(async () => {
    throw new Error("unexpected host command");
  });
}

function claudeRuntime(state: {
  current?: string;
}): ReturnType<typeof vi.fn<VerificationExecFile>> {
  return vi.fn<VerificationExecFile>(async (file, args) => {
    if (file !== "claude") return { exitCode: null, stdout: "", stderr: "" };
    if (args[1] === "get") {
      return state.current === undefined
        ? {
            exitCode: 1,
            stdout: "",
            stderr: "No MCP server found with name: convex",
          }
        : { exitCode: 0, stdout: state.current, stderr: "" };
    }
    if (args[1] === "add") {
      state.current = "claude-local-convex\n";
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    if (args[1] === "remove") {
      state.current = undefined;
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    return { exitCode: null, stdout: "", stderr: "" };
  });
}
