import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("repo-native Maestro MCP declarations", () => {
  it("uses Claude Code's plugin .mcp.json mechanism from the target root", async () => {
    const declaration = JSON.parse(
      await readFile(
        `${repoRoot}/agent-pack/plugins/maestro/.mcp.json`,
        "utf8",
      ),
    );
    expect(declaration).toEqual({
      mcpServers: {
        maestro: {
          type: "stdio",
          command: "pnpm",
          args: ["maestro", "--", "mcp"],
          cwd: "${CLAUDE_PROJECT_DIR}",
        },
      },
    });
    expect(JSON.stringify(declaration)).not.toContain("convex mcp start");
  });

  it("provides Codex's project config.toml MCP table for root projection", async () => {
    const config = await readFile(
      `${repoRoot}/agent-pack/hosts/codex/maestro-mcp.config.toml`,
      "utf8",
    );
    expect(config).toBe(
      [
        "[mcp_servers.maestro]",
        'command = "pnpm"',
        'args = ["maestro", "--", "mcp"]',
        'cwd = "."',
        "enabled = true",
        "",
      ].join("\n"),
    );
    expect(config).not.toContain("convex mcp start");
  });
});
