import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  executeAgentPackCommand,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "../contracts.js";
import type { RepositoryContext } from "../repoContext.js";

export type MaestroMcpTool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
};

export type MaestroMcpToolResult = {
  readonly isError: boolean;
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly structuredContent?: unknown;
  readonly code?: string;
};

export type MaestroMcpProjection = {
  readonly tools: () => readonly MaestroMcpTool[];
  readonly call: (
    name: string,
    args: Readonly<Record<string, unknown>>,
  ) => Promise<MaestroMcpToolResult>;
};

const TOOLS = [
  {
    name: "maestro_preflight",
    description: "Read deterministic local repository readiness.",
    inputSchema: closedSchema({
      mode: { type: "string", enum: ["fake", "test"] },
    }),
  },
  {
    name: "maestro_scaffold_preview",
    description:
      "Preview exact reviewed generator output without writing files.",
    inputSchema: closedSchema(
      {
        generatorId: { type: "string" },
        args: { type: "object" },
        workflowRuleIds: { type: "array", items: { type: "string" } },
        workflowResolutions: { type: "array", items: { type: "object" } },
      },
      ["generatorId", "args"],
    ),
  },
  {
    name: "maestro_support_bundle_preview",
    description:
      "Preview the exact allowlisted local support bundle without writing or uploading it.",
    inputSchema: closedSchema({}),
  },
  {
    name: "maestro_verify",
    description:
      "Run the existing read-oriented focused or full verification contract.",
    inputSchema: closedSchema({
      scope: { type: "string", enum: ["focused", "full"] },
      changed: { type: "array", items: { type: "string" } },
    }),
  },
] as const satisfies readonly MaestroMcpTool[];

type Commands<
  PArgs,
  PData extends AgentPackJsonValue,
  SArgs,
  SData extends AgentPackJsonValue,
  BArgs,
  BData extends AgentPackJsonValue,
  VArgs,
  VData extends AgentPackJsonValue,
> = {
  readonly preflight?: AgentPackCommand<"preflight", PArgs, PData>;
  readonly scaffold?: AgentPackCommand<"scaffold", SArgs, SData>;
  readonly supportBundle?: AgentPackCommand<"support-bundle", BArgs, BData>;
  readonly verify?: AgentPackCommand<"verify", VArgs, VData>;
};

const toolCommandKeys = {
  maestro_preflight: "preflight",
  maestro_scaffold_preview: "scaffold",
  maestro_support_bundle_preview: "supportBundle",
  maestro_verify: "verify",
} as const;

export function createMaestroMcpProjection<
  PArgs,
  PData extends AgentPackJsonValue,
  SArgs,
  SData extends AgentPackJsonValue,
  BArgs,
  BData extends AgentPackJsonValue,
  VArgs,
  VData extends AgentPackJsonValue,
>(
  commands: Commands<PArgs, PData, SArgs, SData, BArgs, BData, VArgs, VData>,
  repo: RepositoryContext,
): MaestroMcpProjection {
  const context = {
    schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
    invocation: "mcp" as const,
    repo,
  };
  const tools = TOOLS.filter(
    ({ name }) => commands[toolCommandKeys[name]] !== undefined,
  );
  return {
    tools: () => tools,
    call: async (name, args) => {
      if (!tools.some((tool) => tool.name === name)) {
        return toolError("MCP_UNKNOWN_TOOL", "Unknown Maestro MCP tool.");
      }
      if (containsForbiddenAuthority(args)) {
        return toolError(
          "MCP_FORBIDDEN_ARGUMENT",
          "The request contains authority unavailable to this transport.",
        );
      }
      const decoded = decodeToolInput(name, args);
      if (!decoded.ok)
        return toolError("MCP_INVALID_ARGUMENT", decoded.message);
      switch (name) {
        case "maestro_preflight":
          return projectResult(
            await executeAgentPackCommand(
              requiredProjectedCommand(commands.preflight),
              decoded.input,
              context,
            ),
          );
        case "maestro_scaffold_preview":
          return projectResult(
            await executeAgentPackCommand(
              requiredProjectedCommand(commands.scaffold),
              decoded.input,
              context,
            ),
          );
        case "maestro_support_bundle_preview":
          return projectResult(
            await executeAgentPackCommand(
              requiredProjectedCommand(commands.supportBundle),
              decoded.input,
              context,
            ),
          );
        case "maestro_verify":
          return projectResult(
            await executeAgentPackCommand(
              requiredProjectedCommand(commands.verify),
              decoded.input,
              context,
            ),
          );
        default:
          return toolError("MCP_UNKNOWN_TOOL", "Unknown Maestro MCP tool.");
      }
    },
  };
}

function decodeToolInput(
  name: string,
  args: Readonly<Record<string, unknown>>,
):
  | { readonly ok: true; readonly input: unknown }
  | {
      readonly ok: false;
      readonly message: string;
    } {
  switch (name) {
    case "maestro_preflight":
      return decodePreflightInput(args);
    case "maestro_scaffold_preview":
      return decodeScaffoldInput(args);
    case "maestro_support_bundle_preview":
      return decodeSupportBundleInput(args);
    default:
      return decodeVerifyInput(args);
  }
}

function decodePreflightInput(args: Readonly<Record<string, unknown>>) {
  if (
    !hasOnly(args, ["mode"]) ||
    (args.mode !== undefined && args.mode !== "fake" && args.mode !== "test")
  ) {
    return invalidArguments();
  }
  return { ok: true as const, input: { mode: args.mode ?? "fake" } };
}

function decodeScaffoldInput(args: Readonly<Record<string, unknown>>) {
  if (
    !hasOnly(args, [
      "generatorId",
      "args",
      "workflowRuleIds",
      "workflowResolutions",
    ]) ||
    typeof args.generatorId !== "string" ||
    !isJsonRecord(args.args) ||
    (args.workflowRuleIds !== undefined &&
      !stringArray(args.workflowRuleIds)) ||
    (args.workflowResolutions !== undefined &&
      !Array.isArray(args.workflowResolutions))
  )
    return invalidArguments();
  return {
    ok: true as const,
    input: {
      generatorId: args.generatorId,
      args: args.args,
      write: false,
      workflowRuleIds: args.workflowRuleIds ?? [],
      workflowResolutions: args.workflowResolutions ?? [],
    },
  };
}

function decodeSupportBundleInput(args: Readonly<Record<string, unknown>>) {
  return hasOnly(args, [])
    ? { ok: true as const, input: { write: false } }
    : invalidArguments();
}

function decodeVerifyInput(args: Readonly<Record<string, unknown>>) {
  if (
    !hasOnly(args, ["scope", "changed"]) ||
    hasInvalidVerifyScope(args.scope) ||
    hasInvalidChangedPaths(args.changed) ||
    hasChangedPathsForFullScope(args.scope, args.changed)
  )
    return invalidArguments();
  return {
    ok: true as const,
    input: { scope: args.scope ?? "focused", changed: args.changed ?? [] },
  };
}

function hasInvalidVerifyScope(scope: unknown): boolean {
  return scope !== undefined && scope !== "focused" && scope !== "full";
}

function hasInvalidChangedPaths(changed: unknown): boolean {
  return changed !== undefined && !stringArray(changed);
}

function hasChangedPathsForFullScope(
  scope: unknown,
  changed: unknown,
): boolean {
  return scope === "full" && Array.isArray(changed) && changed.length > 0;
}

function requiredProjectedCommand<Command>(
  command: Command | undefined,
): Command {
  if (command === undefined) {
    throw new Error("projected MCP command is unavailable");
  }
  return command;
}

function projectResult(result: unknown): MaestroMcpToolResult {
  const exitClass = isRecord(result) ? result.exitClass : undefined;
  return {
    isError: !["success", "findings"].includes(String(exitClass)),
    structuredContent: result,
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

function toolError(code: string, message: string): MaestroMcpToolResult {
  return {
    isError: true,
    code,
    content: [{ type: "text", text: JSON.stringify({ code, message }) }],
  };
}

function containsForbiddenAuthority(value: unknown): boolean {
  if (typeof value === "string") {
    return [
      "production",
      "prod",
      "--prod",
      "--dangerously-enable-production-deployments",
      "--cautiously-allow-production-pii",
    ].includes(value);
  }
  if (Array.isArray(value)) return value.some(containsForbiddenAuthority);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.replace(/[-_]/g, "").toLowerCase();
    return (
      /token|secret|password|authorization|cookie|apikey/.test(normalized) ||
      [
        "identity",
        "userid",
        "workspace",
        "workspaceid",
        "functionref",
        "functionreference",
        "command",
        "cmd",
        "argv",
        "write",
        "production",
        "prod",
      ].includes(normalized) ||
      containsForbiddenAuthority(child)
    );
  });
}

function closedSchema(
  properties: Readonly<Record<string, unknown>>,
  required: readonly string[] = [],
) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length === 0 ? {} : { required }),
  };
}

function invalidArguments() {
  return {
    ok: false as const,
    message: "Arguments do not match the closed tool schema.",
  };
}

function hasOnly(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function stringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJsonRecord(
  value: unknown,
): value is Record<string, AgentPackJsonValue> {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AgentPackJsonValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every(isJsonValue)) ||
    isJsonRecord(value)
  );
}
