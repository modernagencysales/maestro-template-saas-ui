import { describe, expect, it } from "vitest";
import type { MaestroMcpProjection } from "./projection.js";
import { createMaestroMcpServer, serveMcpLines } from "./server.js";

const projection: MaestroMcpProjection = {
  tools: () => [
    {
      name: "maestro_preflight",
      description: "Read readiness.",
      inputSchema: { type: "object" },
    },
  ],
  call: async () => ({
    isError: false,
    structuredContent: { ok: true },
    content: [{ type: "text", text: '{"ok":true}' }],
  }),
};

describe("Maestro MCP server", () => {
  it("negotiates, lists, and calls tools with JSON-RPC frames", async () => {
    const server = createMaestroMcpServer(projection);
    await expect(
      server.handle({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          clientInfo: { name: "fixture", version: "1" },
          capabilities: {},
        },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { serverInfo: { name: "maestro-agent-pack" } },
    });
    await expect(
      server.handle({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    ).resolves.toMatchObject({
      result: { tools: [{ name: "maestro_preflight" }] },
    });
    await expect(
      server.handle({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "maestro_preflight", arguments: {} },
      }),
    ).resolves.toMatchObject({
      result: { structuredContent: { ok: true } },
    });
  });

  it("rejects unknown methods and malformed call parameters", async () => {
    const server = createMaestroMcpServer(projection);
    await expect(
      server.handle({ jsonrpc: "2.0", id: 1, method: "unknown", params: {} }),
    ).resolves.toMatchObject({ error: { code: -32601 } });
    await expect(
      server.handle({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: 42 },
      }),
    ).resolves.toMatchObject({ error: { code: -32602 } });
  });

  it("writes only protocol frames to stdout and redacted diagnostics to stderr", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    await serveMcpLines({
      lines: [
        "{",
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      ],
      server: createMaestroMcpServer(projection),
      writeStdout: (frame) => stdout.push(frame),
      writeStderr: (diagnostic) => stderr.push(diagnostic),
    });
    expect(stdout).toHaveLength(2);
    expect(stdout.every((frame) => JSON.parse(frame).jsonrpc === "2.0")).toBe(
      true,
    );
    expect(stderr).toEqual(["MCP_PROTOCOL_ERROR invalid-json\n"]);
    expect(stderr.join("")).not.toContain("{");
  });
});
