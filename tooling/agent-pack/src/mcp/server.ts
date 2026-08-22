import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import {
  MCP_PROTOCOL_VERSION,
  mcpError,
  mcpResult,
  parseMcpMessage,
  type McpMessage,
  type McpResponse,
} from "./protocol.js";
import type { MaestroMcpProjection } from "./projection.js";

export type MaestroMcpServer = {
  readonly handle: (message: McpMessage) => Promise<McpResponse | undefined>;
};

export function createMaestroMcpServer(
  projection: MaestroMcpProjection,
): MaestroMcpServer {
  return {
    handle: async (message) => {
      if (message.id === undefined) return undefined;
      if (message.method === "initialize") {
        return validInitialize(message.params)
          ? mcpResult(message.id, {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "maestro-agent-pack", version: "1.0.0" },
            })
          : mcpError(message.id, -32602, "Invalid initialize parameters.");
      }
      if (message.method === "ping") return mcpResult(message.id, {});
      if (message.method === "tools/list") {
        return emptyParams(message.params)
          ? mcpResult(message.id, { tools: projection.tools() })
          : mcpError(message.id, -32602, "Invalid tools/list parameters.");
      }
      if (message.method === "tools/call") {
        const call = parseToolCall(message.params);
        return call === undefined
          ? mcpError(message.id, -32602, "Invalid tools/call parameters.")
          : mcpResult(message.id, await projection.call(call.name, call.args));
      }
      return mcpError(message.id, -32601, "Method not found.");
    },
  };
}

export async function serveMcpLines(input: {
  readonly lines: Iterable<string> | AsyncIterable<string>;
  readonly server: MaestroMcpServer;
  readonly writeStdout: (frame: string) => void;
  readonly writeStderr: (diagnostic: string) => void;
}): Promise<void> {
  for await (const line of input.lines) {
    const parsed = parseMcpMessage(line);
    if (!parsed.ok) {
      const invalidJson = parsed.diagnostic === "invalid-json";
      input.writeStdout(
        `${JSON.stringify(
          mcpError(
            null,
            invalidJson ? -32700 : -32600,
            invalidJson ? "Parse error." : "Invalid request.",
          ),
        )}\n`,
      );
      input.writeStderr(`MCP_PROTOCOL_ERROR ${parsed.diagnostic}\n`);
      continue;
    }
    try {
      const response = await input.server.handle(parsed.message);
      if (response !== undefined)
        input.writeStdout(`${JSON.stringify(response)}\n`);
    } catch {
      input.writeStdout(
        `${JSON.stringify(mcpError(parsed.message.id ?? null, -32603, "Internal error."))}\n`,
      );
      input.writeStderr("MCP_SERVER_ERROR internal\n");
    }
  }
}

export async function serveMcpStdio(input: {
  readonly stdin: Readable;
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly server: MaestroMcpServer;
}): Promise<void> {
  const lines = createInterface({ input: input.stdin, crlfDelay: Infinity });
  await serveMcpLines({
    lines,
    server: input.server,
    writeStdout: (frame) => input.stdout.write(frame),
    writeStderr: (diagnostic) => input.stderr.write(diagnostic),
  });
}

function validInitialize(
  params: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (
    params !== undefined &&
    typeof params.protocolVersion === "string" &&
    isRecord(params.clientInfo) &&
    isRecord(params.capabilities) &&
    Object.keys(params).every((key) =>
      ["protocolVersion", "clientInfo", "capabilities"].includes(key),
    )
  );
}

function emptyParams(
  params: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return params === undefined || Object.keys(params).length === 0;
}

function parseToolCall(params: Readonly<Record<string, unknown>> | undefined):
  | {
      readonly name: string;
      readonly args: Readonly<Record<string, unknown>>;
    }
  | undefined {
  if (
    params === undefined ||
    typeof params.name !== "string" ||
    (params.arguments !== undefined && !isRecord(params.arguments)) ||
    !Object.keys(params).every((key) => key === "name" || key === "arguments")
  )
    return undefined;
  return { name: params.name, args: params.arguments ?? {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
