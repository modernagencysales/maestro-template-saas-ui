import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCustomerCliComposition } from "./customerComposition";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const frame = (id: number, method: string, params: unknown) =>
  `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;

describe("customer MCP stdio composition", () => {
  it("initializes, lists, calls, and rejects malformed or unknown input", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writable = (chunks: string[]) =>
      new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(String(chunk));
          callback();
        },
      });
    const input = [
      frame(1, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "customer-test", version: "1" },
        capabilities: {},
      }),
      frame(2, "tools/list", {}),
      frame(3, "tools/call", {
        name: "maestro_support_bundle_preview",
        arguments: {},
      }),
      frame(4, "tools/call", { name: "missing_customer_tool", arguments: {} }),
      frame(5, "tools/call", { name: 42 }),
    ];

    await createCustomerCliComposition(() => ({})).mcp.serve({
      stdin: Readable.from(input),
      stdout: writable(stdout),
      stderr: writable(stderr),
      cwd: repositoryRoot,
    });

    const responses = stdout
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(responses).toHaveLength(5);
    expect(responses[0]).toMatchObject({
      id: 1,
      result: { serverInfo: { name: "maestro-agent-pack" } },
    });
    expect(responses[1]).toMatchObject({
      id: 2,
      result: {
        tools: [
          { name: "maestro_preflight" },
          { name: "maestro_support_bundle_preview" },
          { name: "maestro_verify" },
        ],
      },
    });
    expect(responses[2]).toMatchObject({
      id: 3,
      result: { isError: false },
    });
    expect(responses[3]).toMatchObject({
      id: 4,
      result: { isError: true, code: "MCP_UNKNOWN_TOOL" },
    });
    expect(responses[4]).toMatchObject({ id: 5, error: { code: -32602 } });
    expect(stderr).toEqual([]);
  });
});
