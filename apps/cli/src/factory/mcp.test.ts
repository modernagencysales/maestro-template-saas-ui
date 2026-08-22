import { Readable, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createMcpCliAdapter, runMcpCli } from "./mcp";
import type { McpCliStreams } from "./mcp";

describe("MCP CLI stdio adapter", () => {
  it("resolves the server repository from the CLI cwd", async () => {
    const serve = vi.fn(async ({ cwd, stdout }: McpCliStreams) => {
      stdout.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { cwd } })}\n`,
      );
    });
    const output: string[] = [];
    await runMcpCli(createMcpCliAdapter(serve), {
      stdin: Readable.from([]),
      stdout: writable(output),
      stderr: writable([]),
      cwd: "/tmp/customer-target",
    });
    expect(serve).toHaveBeenCalledOnce();
    expect(JSON.parse(output.join(""))).toMatchObject({
      result: { cwd: "/tmp/customer-target" },
    });
  });

  it("keeps malformed input out of diagnostics and stdout framing", async () => {
    const adapter = createMcpCliAdapter(
      async ({ stdout, stderr }: McpCliStreams) => {
        stdout.write('{"jsonrpc":"2.0","error":{"code":-32700}}\n');
        stderr.write("MCP_PROTOCOL_ERROR invalid-json\n");
      },
    );
    const output: string[] = [];
    const diagnostics: string[] = [];
    await runMcpCli(adapter, {
      stdin: Readable.from(["{secret"]),
      stdout: writable(output),
      stderr: writable(diagnostics),
      cwd: "/tmp/target",
    });
    expect(JSON.parse(output.join(""))).toMatchObject({
      error: { code: -32700 },
    });
    expect(diagnostics.join("")).toBe("MCP_PROTOCOL_ERROR invalid-json\n");
    expect(diagnostics.join("")).not.toContain("secret");
  });
});

function writable(chunks: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
}
