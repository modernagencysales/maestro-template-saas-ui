import { describe, expect, it, vi } from "vitest";
import {
  createMcpConfigureCliAdapter,
  MCP_CONFIGURE_HELP,
} from "./mcpConfigure";

describe("MCP configure CLI adapter", () => {
  it("previews inspect by default through the injected command runner", async () => {
    const run = vi.fn(async () => ({
      exitCode: 0 as const,
      stdout: "preview\n",
      stderr: "",
    }));
    const adapter = createMcpConfigureCliAdapter(run);
    await expect(
      adapter.run(["configure", "--host", "claude-code"], "/repo"),
    ).resolves.toEqual({ exitCode: 0, stdout: "preview\n", stderr: "" });
    expect(run).toHaveBeenCalledWith(
      { host: "claude-code", profile: "inspect" },
      "/repo",
      "human",
    );
  });

  it("maps only explicit write and exact remove lifecycle flags", async () => {
    const run = vi.fn(async () => ({
      exitCode: 0 as const,
      stdout: "ok\n",
      stderr: "",
    }));
    const adapter = createMcpConfigureCliAdapter(run);
    await adapter.run(
      [
        "configure",
        "--host",
        "codex",
        "--profile",
        "dev-power",
        "--write",
        "--privacy-reviewed",
        "--json",
      ],
      "/repo",
    );
    await adapter.run(
      ["configure", "--host", "claude-code", "--remove", "--details"],
      "/repo",
    );
    expect(run).toHaveBeenNthCalledWith(
      1,
      {
        host: "codex",
        profile: "dev-power",
        write: true,
        privacyReviewed: true,
      },
      "/repo",
      "json",
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      { host: "claude-code", remove: true },
      "/repo",
      "details",
    );
  });

  it.each([
    [
      "write plus remove",
      [
        "configure",
        "--host",
        "codex",
        "--write",
        "--privacy-reviewed",
        "--remove",
      ],
    ],
    [
      "write without privacy review",
      ["configure", "--host", "codex", "--write"],
    ],
    [
      "privacy review without write",
      ["configure", "--host", "codex", "--privacy-reviewed"],
    ],
    [
      "remove plus profile",
      ["configure", "--host", "codex", "--remove", "--profile", "inspect"],
    ],
    ["production", ["configure", "--host", "codex", "--profile", "production"]],
    ["path", ["configure", "--host", "codex", "--path", "/tmp/config"]],
    ["command", ["configure", "--host", "codex", "--command", "convex"]],
    ["unknown", ["configure", "--host", "other"]],
  ])("passes an invalid closed input for %s", async (_case, argv) => {
    const run = vi.fn(async () => ({
      exitCode: 2 as const,
      stdout: "",
      stderr: "invalid\n",
    }));
    const adapter = createMcpConfigureCliAdapter(run);
    await adapter.run(argv, "/repo");
    expect(run).toHaveBeenCalledWith({}, "/repo", "human");
  });

  it("returns exact help without invoking the command", async () => {
    const run = vi.fn();
    const adapter = createMcpConfigureCliAdapter(run);
    await expect(
      adapter.run(["configure", "--help"], "/repo"),
    ).resolves.toEqual({
      exitCode: 0,
      stdout: MCP_CONFIGURE_HELP,
      stderr: "",
    });
    expect(run).not.toHaveBeenCalled();
  });
});
