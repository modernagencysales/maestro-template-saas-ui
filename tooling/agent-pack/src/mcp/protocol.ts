export const MCP_PROTOCOL_VERSION = "2025-06-18" as const;

export type McpId = string | number;
export type McpMessage = {
  readonly jsonrpc: "2.0";
  readonly id?: McpId;
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

export type McpResponse =
  | {
      readonly jsonrpc: "2.0";
      readonly id: McpId | null;
      readonly result: unknown;
    }
  | {
      readonly jsonrpc: "2.0";
      readonly id: McpId | null;
      readonly error: {
        readonly code: number;
        readonly message: string;
      };
    };

export type McpParseResult =
  | { readonly ok: true; readonly message: McpMessage }
  | {
      readonly ok: false;
      readonly diagnostic: "invalid-json" | "invalid-request";
    };

export function parseMcpMessage(frame: string): McpParseResult {
  let value: unknown;
  try {
    value = JSON.parse(frame);
  } catch {
    return { ok: false, diagnostic: "invalid-json" };
  }
  if (!isRecord(value)) return { ok: false, diagnostic: "invalid-request" };
  const allowed = new Set(["jsonrpc", "id", "method", "params"]);
  if (
    value.jsonrpc !== "2.0" ||
    typeof value.method !== "string" ||
    value.method.length === 0 ||
    !Object.keys(value).every((key) => allowed.has(key)) ||
    (value.id !== undefined &&
      typeof value.id !== "string" &&
      typeof value.id !== "number") ||
    (value.params !== undefined && !isRecord(value.params))
  ) {
    return { ok: false, diagnostic: "invalid-request" };
  }
  return {
    ok: true,
    message: {
      jsonrpc: "2.0",
      ...(value.id === undefined ? {} : { id: value.id }),
      method: value.method,
      ...(value.params === undefined ? {} : { params: value.params }),
    },
  };
}

export function mcpError(
  id: McpId | null,
  code: number,
  message: string,
): McpResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function mcpResult(id: McpId, result: unknown): McpResponse {
  return { jsonrpc: "2.0", id, result };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
