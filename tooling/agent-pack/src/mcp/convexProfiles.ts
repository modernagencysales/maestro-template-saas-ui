import {
  buildConvexMcpLaunch,
  validateConvexToolInventory,
  type ConvexMcpProfileName,
  type ConvexMcpProfiles,
} from "../pluginContract.js";

export type HostCommand = {
  readonly command: string;
  readonly args: readonly string[];
};

export type ConvexProfilePreview =
  | {
      readonly profile: "fake";
      readonly enabled: false;
      readonly autoStart: false;
      readonly effects: readonly string[];
    }
  | {
      readonly profile: "inspect" | "dev-power";
      readonly enabled: true;
      readonly autoStart: false;
      readonly requiresConfirmation: boolean;
      readonly cwd: string;
      readonly effects: readonly string[];
      readonly launch: HostCommand;
      readonly claudeCode: {
        readonly add: HostCommand;
        readonly remove: HostCommand;
      };
      readonly codex: {
        readonly configToml: string;
        readonly remove: HostCommand;
      };
    };

export function createConvexProfilePreview(input: {
  readonly contract: ConvexMcpProfiles;
  readonly profile?: ConvexMcpProfileName;
  readonly observedTools: readonly string[];
  readonly repoRoot: string;
}): ConvexProfilePreview {
  validateConvexToolInventory(input.contract, input.observedTools);
  const profile = input.profile ?? "inspect";
  if (profile === "production") {
    throw new Error("production Convex MCP is unsupported");
  }
  if (profile === "fake") {
    return {
      profile,
      enabled: false,
      autoStart: false,
      effects: input.contract.profiles.fake.effects,
    };
  }
  const launch = buildConvexMcpLaunch(input.contract, profile);
  assertSafeLaunch(input.contract, launch.args);
  const command = { command: launch.command, args: launch.args };
  return {
    profile,
    enabled: true,
    autoStart: false,
    requiresConfirmation: profile === "dev-power",
    cwd: input.repoRoot,
    effects: input.contract.profiles[profile].effects,
    launch: command,
    claudeCode: {
      add: {
        command: "claude",
        args: [
          "mcp",
          "add",
          "--transport",
          "stdio",
          "--scope",
          "local",
          "convex",
          "--",
          launch.command,
          ...launch.args,
        ],
      },
      remove: {
        command: "claude",
        args: ["mcp", "remove", "--scope", "local", "convex"],
      },
    },
    codex: {
      configToml: renderCodexConvexConfig(input.repoRoot, launch),
      remove: { command: "codex", args: ["mcp", "remove", "convex"] },
    },
  };
}

function assertSafeLaunch(
  contract: ConvexMcpProfiles,
  args: readonly string[],
): void {
  const forbidden = contract.forbiddenFlags.filter((flag) =>
    args.includes(flag),
  );
  if (forbidden.length > 0) {
    throw new Error(`forbidden Convex MCP flags: ${forbidden.join(", ")}`);
  }
  for (const tool of contract.alwaysDisabled) {
    const disabled =
      args[args.indexOf("--disable-tools") + 1]?.split(",") ?? [];
    if (!disabled.includes(tool)) {
      throw new Error(`Convex MCP profile must disable ${tool}`);
    }
  }
}

function renderCodexConvexConfig(
  repoRoot: string,
  launch: HostCommand,
): string {
  return [
    "[mcp_servers.convex]",
    `command = ${JSON.stringify(launch.command)}`,
    `args = ${JSON.stringify(launch.args)}`,
    `cwd = ${JSON.stringify(repoRoot)}`,
    "enabled = true",
    "",
  ].join("\n");
}
