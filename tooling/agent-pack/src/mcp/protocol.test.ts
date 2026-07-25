import { describe, expect, it } from "vitest";
import { parseMcpMessage } from "./protocol.js";

describe("MCP protocol parser", () => {
  it("accepts one closed JSON-RPC request", () => {
    expect(
      parseMcpMessage(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      ),
    ).toEqual({
      ok: true,
      message: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    });
  });

  it.each([
    ["malformed JSON", "{"],
    ["batch", "[]"],
    ["wrong version", '{"jsonrpc":"1.0","id":1,"method":"ping"}'],
    ["missing method", '{"jsonrpc":"2.0","id":1}'],
    ["invalid id", '{"jsonrpc":"2.0","id":{},"method":"ping"}'],
    ["extra field", '{"jsonrpc":"2.0","id":1,"method":"ping","token":"x"}'],
  ])("rejects %s", (_case, frame) => {
    expect(parseMcpMessage(frame)).toMatchObject({ ok: false });
  });
});
