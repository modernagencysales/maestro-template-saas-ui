export const CONVEX_MCP_TOOLS = [
  "data",
  "envGet",
  "envList",
  "envRemove",
  "envSet",
  "functionSpec",
  "insights",
  "logs",
  "run",
  "runOneoffQuery",
  "status",
  "tables",
] as const;

export type ConvexMcpTool = (typeof CONVEX_MCP_TOOLS)[number];
export type ConvexMcpProfileName =
  "fake" | "inspect" | "dev-power" | "production";

export type ConvexMcpProfile = {
  readonly launch: "disabled" | "explicit-opt-in" | "unsupported";
  readonly deployment: "dev" | null;
  readonly allow: readonly ConvexMcpTool[];
  readonly deny: readonly ConvexMcpTool[];
  readonly effects: readonly string[];
};

export type ConvexMcpProfiles = {
  readonly schemaVersion: 1;
  readonly convexCliVersion: string;
  readonly projectDir: ".";
  readonly unknownToolPolicy: "fail-closed";
  readonly alwaysDisabled: readonly ConvexMcpTool[];
  readonly forbiddenFlags: readonly string[];
  readonly upstreamToolInventory: readonly ConvexMcpTool[];
  readonly profiles: Readonly<Record<ConvexMcpProfileName, ConvexMcpProfile>>;
};

export type ConvexMcpLaunch = {
  readonly command: "pnpm";
  readonly args: readonly string[];
};

const PROFILE_NAMES = ["fake", "inspect", "dev-power", "production"] as const;
const TOOL_SET: ReadonlySet<string> = new Set(CONVEX_MCP_TOOLS);

export function parseConvexMcpProfiles(input: unknown): ConvexMcpProfiles {
  const value = record(input, "Convex MCP profile contract");
  const inventory = toolArray(
    value.upstreamToolInventory,
    "upstreamToolInventory",
  );
  validateExactInventory(inventory);
  const alwaysDisabled = toolArray(value.alwaysDisabled, "alwaysDisabled");
  const profilesInput = record(value.profiles, "profiles");
  const profiles: Readonly<Record<ConvexMcpProfileName, ConvexMcpProfile>> = {
    fake: parseProfile(profilesInput.fake, "fake"),
    inspect: parseProfile(profilesInput.inspect, "inspect"),
    "dev-power": parseProfile(profilesInput["dev-power"], "dev-power"),
    production: parseProfile(profilesInput.production, "production"),
  };

  for (const name of PROFILE_NAMES) {
    validateProfile(name, profiles[name], inventory, alwaysDisabled);
  }

  if (value.schemaVersion !== 1) throw new TypeError("schemaVersion must be 1");
  if (value.projectDir !== ".") throw new TypeError("projectDir must be .");
  if (value.unknownToolPolicy !== "fail-closed") {
    throw new TypeError("unknownToolPolicy must be fail-closed");
  }

  return {
    schemaVersion: 1,
    convexCliVersion: string(value.convexCliVersion, "convexCliVersion"),
    projectDir: ".",
    unknownToolPolicy: "fail-closed",
    alwaysDisabled,
    forbiddenFlags: stringArray(value.forbiddenFlags, "forbiddenFlags"),
    upstreamToolInventory: inventory,
    profiles: {
      fake: profiles.fake,
      inspect: profiles.inspect,
      "dev-power": profiles["dev-power"],
      production: profiles.production,
    },
  };
}

export function validateConvexToolInventory(
  contract: ConvexMcpProfiles,
  observed: readonly string[],
): void {
  const expected: ReadonlySet<string> = new Set(contract.upstreamToolInventory);
  const unknown = observed.filter((tool) => !expected.has(tool));
  const missing = contract.upstreamToolInventory.filter(
    (tool) => !observed.includes(tool),
  );
  if (unknown.length > 0) {
    throw new Error(`unknown Convex MCP tools: ${unknown.join(", ")}`);
  }
  if (missing.length > 0) {
    throw new Error(`missing Convex MCP tools: ${missing.join(", ")}`);
  }
}

export function buildConvexMcpLaunch(
  contract: ConvexMcpProfiles,
  name: ConvexMcpProfileName,
): ConvexMcpLaunch {
  const profile = contract.profiles[name];
  if (profile.launch !== "explicit-opt-in" || profile.deployment !== "dev") {
    throw new Error(`profile ${name} does not launch Convex MCP`);
  }
  return {
    command: "pnpm",
    args: [
      "exec",
      "convex",
      "mcp",
      "start",
      "--project-dir",
      contract.projectDir,
      "--deployment",
      profile.deployment,
      "--disable-tools",
      profile.deny.join(","),
    ],
  };
}

function parseProfile(input: unknown, name: string): ConvexMcpProfile {
  const value = record(input, `profiles.${name}`);
  const launch = value.launch;
  if (
    launch !== "disabled" &&
    launch !== "explicit-opt-in" &&
    launch !== "unsupported"
  ) {
    throw new TypeError(`profiles.${name}.launch is invalid`);
  }
  const deployment = value.deployment;
  if (deployment !== null && deployment !== "dev") {
    throw new TypeError(`profiles.${name}.deployment must be dev or null`);
  }
  return {
    launch,
    deployment,
    allow: toolArray(value.allow, `profiles.${name}.allow`),
    deny: toolArray(value.deny, `profiles.${name}.deny`),
    effects: stringArray(value.effects, `profiles.${name}.effects`),
  };
}

function validateProfile(
  name: ConvexMcpProfileName,
  profile: ConvexMcpProfile,
  inventory: readonly ConvexMcpTool[],
  alwaysDisabled: readonly ConvexMcpTool[],
): void {
  const allow = new Set(profile.allow);
  const deny = new Set(profile.deny);
  const overlap = profile.allow.filter((tool) => deny.has(tool));
  const uncovered = inventory.filter(
    (tool) => !allow.has(tool) && !deny.has(tool),
  );
  if (overlap.length > 0 || uncovered.length > 0) {
    throw new TypeError(`profile ${name} must partition the tool inventory`);
  }
  for (const tool of alwaysDisabled) {
    if (allow.has(tool) || !deny.has(tool)) {
      throw new TypeError(`profile ${name} must disable ${tool}`);
    }
  }
  if (
    (name === "fake" && profile.launch !== "disabled") ||
    (name === "production" && profile.launch !== "unsupported")
  ) {
    throw new TypeError(`profile ${name} has an unsafe launch policy`);
  }
}

function validateExactInventory(inventory: readonly ConvexMcpTool[]): void {
  const observed: ReadonlySet<string> = new Set(inventory);
  const missing = CONVEX_MCP_TOOLS.filter((tool) => !observed.has(tool));
  if (missing.length > 0) {
    throw new TypeError(
      `upstreamToolInventory is missing: ${missing.join(", ")}`,
    );
  }
}

function record(input: unknown, name: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${name} must be an object`);
  }
  return Object.fromEntries(Object.entries(input));
}

function string(input: unknown, name: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return input;
}

function stringArray(input: unknown, name: string): readonly string[] {
  if (!Array.isArray(input) || input.some((item) => typeof item !== "string")) {
    throw new TypeError(`${name} must be a string array`);
  }
  return [...input];
}

function toolArray(input: unknown, name: string): readonly ConvexMcpTool[] {
  const values = stringArray(input, name);
  const unknown = values.filter((value) => !TOOL_SET.has(value));
  if (unknown.length > 0) {
    throw new TypeError(
      `${name} contains unknown tools: ${unknown.join(", ")}`,
    );
  }
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${name} contains duplicate tools`);
  }
  return values.filter((value): value is ConvexMcpTool => TOOL_SET.has(value));
}
