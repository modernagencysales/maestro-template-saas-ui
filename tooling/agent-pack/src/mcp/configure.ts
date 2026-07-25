import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackCommandOutcome,
  type AgentPackDiagnostic,
  type AgentPackExecutionContext,
} from "../contracts.js";
import type {
  ConvexMcpProfileName,
  ConvexMcpProfiles,
} from "../pluginContract.js";
import {
  createConvexProfilePreview,
  type ConvexProfilePreview,
  type HostCommand,
} from "./convexProfiles.js";

export type McpConfigurationHost = "claude-code" | "codex";
export type McpConfigurationProfile = "inspect" | "dev-power";

export type McpConfigurationReceipt = {
  readonly schemaVersion: 1;
  readonly owner: "maestro-agent-pack";
  readonly scope: "local";
  readonly registration: "convex";
  readonly host: McpConfigurationHost;
  readonly repoRoot: string;
  readonly profile: McpConfigurationProfile;
  readonly autoStart: false;
  readonly installation:
    | { readonly kind: "host-command"; readonly command: HostCommand }
    | { readonly kind: "managed-section"; readonly content: string };
  readonly removal: HostCommand;
};

export type McpConfigurationStore = {
  readonly apply: (
    receipt: McpConfigurationReceipt,
  ) => Promise<{ readonly status: "created" | "unchanged" | "refused" }>;
  readonly remove: (key: {
    readonly owner: "maestro-agent-pack";
    readonly scope: "local";
    readonly registration: "convex";
    readonly host: McpConfigurationHost;
    readonly repoRoot: string;
  }) => Promise<{ readonly status: "removed" | "absent" | "refused" }>;
};

type ConfigureArgs =
  | {
      readonly action: "preview" | "apply";
      readonly host: McpConfigurationHost;
      readonly profile: McpConfigurationProfile;
    }
  | { readonly action: "remove"; readonly host: McpConfigurationHost };

type ConfigureData = {
  readonly action: "preview" | "apply" | "remove";
  readonly host: McpConfigurationHost;
  readonly profile: McpConfigurationProfile | null;
  readonly status:
    "preview" | "created" | "unchanged" | "removed" | "absent" | "refused";
  readonly autoStart: false;
  readonly receipt: McpConfigurationReceipt | null;
};

export function createMcpConfigureCommand(input: {
  readonly contract: ConvexMcpProfiles;
  readonly observedTools: (
    context: AgentPackExecutionContext,
  ) => Promise<readonly string[]>;
  readonly store: McpConfigurationStore;
}) {
  return defineAgentPackCommand<"mcp-configure", ConfigureArgs, ConfigureData>({
    id: "mcp-configure",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeConfigureArgs,
    mutationPosture: (args) =>
      args.action === "preview" ? ("preview" as const) : ("write" as const),
    execute: async (args, context) => executeConfigure(input, args, context),
  });
}

async function executeConfigure(
  dependencies: {
    readonly contract: ConvexMcpProfiles;
    readonly observedTools: (
      context: AgentPackExecutionContext,
    ) => Promise<readonly string[]>;
    readonly store: McpConfigurationStore;
  },
  args: ConfigureArgs,
  context: AgentPackExecutionContext,
): Promise<AgentPackCommandOutcome<ConfigureData>> {
  if (args.action === "remove") {
    try {
      const removed = await dependencies.store.remove(
        configurationKey(args.host, context),
      );
      if (removed.status === "refused") {
        return unavailable(
          args.host,
          null,
          "remove",
          "MCP_CONFIG_REMOVE_REFUSED",
          "The existing Convex MCP registration is not owned by its Maestro receipt.",
        );
      }
      return success({
        action: "remove",
        host: args.host,
        profile: null,
        status: removed.status,
        autoStart: false,
        receipt: null,
      });
    } catch {
      return unavailable(
        args.host,
        null,
        "remove",
        "MCP_CONFIG_STORE_UNAVAILABLE",
        "The local MCP configuration store is unavailable.",
      );
    }
  }

  let preview: ConvexProfilePreview;
  try {
    preview = createConvexProfilePreview({
      contract: dependencies.contract,
      profile: args.profile as ConvexMcpProfileName,
      observedTools: await dependencies.observedTools(context),
      repoRoot: context.repo.sourceRoot,
    });
  } catch {
    return unavailable(
      args.host,
      args.profile,
      args.action,
      "MCP_CONFIG_PROFILE_UNAVAILABLE",
      "The audited Convex MCP profile inventory is unavailable or changed.",
    );
  }
  if (!preview.enabled) {
    return unavailable(
      args.host,
      args.profile,
      args.action,
      "MCP_CONFIG_PROFILE_UNAVAILABLE",
      "The selected Convex MCP profile cannot be configured.",
    );
  }
  const receipt = createReceipt(args.host, args.profile, preview);
  if (args.action === "preview") {
    return success({
      action: "preview",
      host: args.host,
      profile: args.profile,
      status: "preview",
      autoStart: false,
      receipt,
    });
  }
  try {
    const applied = await dependencies.store.apply(receipt);
    if (applied.status === "refused") {
      return unavailable(
        args.host,
        args.profile,
        "apply",
        "MCP_CONFIG_APPLY_REFUSED",
        "The existing Convex MCP registration is not safely receipt-owned.",
      );
    }
    return success({
      action: "apply",
      host: args.host,
      profile: args.profile,
      status: applied.status,
      autoStart: false,
      receipt,
    });
  } catch {
    return unavailable(
      args.host,
      args.profile,
      "apply",
      "MCP_CONFIG_STORE_UNAVAILABLE",
      "The local MCP configuration store is unavailable.",
    );
  }
}

function decodeConfigureArgs(
  input: unknown,
): AgentPackArgumentResult<ConfigureArgs> {
  if (
    !isRecord(input) ||
    !hasOnly(input, ["host", "profile", "write", "remove"])
  ) {
    return invalidInvocation();
  }
  const host = input.host;
  const profile = input.profile ?? "inspect";
  const write = input.write ?? false;
  const remove = input.remove ?? false;
  if (
    (host !== "claude-code" && host !== "codex") ||
    (profile !== "inspect" && profile !== "dev-power") ||
    typeof write !== "boolean" ||
    typeof remove !== "boolean" ||
    (write && remove) ||
    (remove && input.profile !== undefined)
  ) {
    return invalidInvocation();
  }
  const safeHost: McpConfigurationHost = host;
  const safeProfile: McpConfigurationProfile = profile;
  return remove
    ? { ok: true, args: { action: "remove", host: safeHost } }
    : {
        ok: true,
        args: {
          action: write ? "apply" : "preview",
          host: safeHost,
          profile: safeProfile,
        },
      };
}

function createReceipt(
  host: McpConfigurationHost,
  profile: McpConfigurationProfile,
  preview: Extract<ConvexProfilePreview, { readonly enabled: true }>,
): McpConfigurationReceipt {
  return {
    schemaVersion: 1,
    owner: "maestro-agent-pack",
    scope: "local",
    registration: "convex",
    host,
    repoRoot: preview.cwd,
    profile,
    autoStart: false,
    installation:
      host === "claude-code"
        ? { kind: "host-command", command: preview.claudeCode.add }
        : { kind: "managed-section", content: preview.codex.configToml },
    removal:
      host === "claude-code" ? preview.claudeCode.remove : preview.codex.remove,
  };
}

function configurationKey(
  host: McpConfigurationHost,
  context: AgentPackExecutionContext,
) {
  return {
    owner: "maestro-agent-pack" as const,
    scope: "local" as const,
    registration: "convex" as const,
    host,
    repoRoot: context.repo.sourceRoot,
  };
}

function success(data: ConfigureData): AgentPackCommandOutcome<ConfigureData> {
  return {
    mutationPosture: data.action === "preview" ? "preview" : "write",
    exitClass: "success",
    summary:
      data.action === "preview"
        ? `Convex MCP ${data.profile} configuration previewed for ${data.host}.`
        : data.action === "apply"
          ? `Convex MCP ${data.profile} configuration ${data.status} for ${data.host}.`
          : `Convex MCP configuration ${data.status} for ${data.host}.`,
    diagnostics: [],
    data,
  };
}

function unavailable(
  host: McpConfigurationHost,
  profile: McpConfigurationProfile | null,
  action: ConfigureData["action"],
  code: string,
  message: string,
): AgentPackCommandOutcome<ConfigureData> {
  const diagnostic: AgentPackDiagnostic = {
    code,
    severity: "error",
    message,
    safeToContinue: false,
    nextAction:
      "Preserve the existing host configuration and inspect the local receipt.",
    rerun: `pnpm maestro -- mcp configure --host ${host}${
      action === "remove" ? " --remove" : ""
    }`,
  };
  return {
    mutationPosture: action === "preview" ? "preview" : "write",
    exitClass: "unavailableDependency",
    summary: `Convex MCP configuration ${action} is unavailable for ${host}.`,
    diagnostics: [diagnostic],
    data: {
      action,
      host,
      profile,
      status: "refused",
      autoStart: false,
      receipt: null,
    },
  };
}

function invalidInvocation() {
  return {
    ok: false as const,
    diagnostics: [
      {
        code: "MCP_CONFIG_INVALID_INVOCATION",
        severity: "error" as const,
        message:
          "MCP configure accepts one local host and a closed preview, write, or remove action.",
        safeToContinue: false,
        nextAction:
          "Use --host claude-code|codex with optional --profile inspect|dev-power and exactly one of --write or --remove.",
        rerun: "pnpm maestro -- mcp configure --help",
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
