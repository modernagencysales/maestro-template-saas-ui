import { executeAppMapImpact, executeAppMapMap } from "./surface";

export type AppMapMcpProjection = {
  readonly tools: () => readonly {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Readonly<Record<string, unknown>>;
  }[];
  readonly call: (
    name: string,
    args: Readonly<Record<string, unknown>>,
  ) => Promise<{
    readonly isError: boolean;
    readonly content: readonly {
      readonly type: "text";
      readonly text: string;
    }[];
    readonly structuredContent?: unknown;
    readonly code?: string;
  }>;
};

const closed = (properties: Readonly<Record<string, unknown>>) => ({
  type: "object",
  properties,
  additionalProperties: false,
});
const TOOLS = [
  {
    name: "maestro_app_map",
    description: "Read the deterministic canonical repository App Map.",
    inputSchema: closed({ revision: { type: "string" } }),
  },
  {
    name: "maestro_app_map_impact",
    description: "Read exact-base App Map change impact.",
    inputSchema: {
      ...closed({
        baseRevision: { type: "string" },
        trustedCiBaseRevision: { type: "string" },
        headRevision: { type: "string" },
      }),
      oneOf: [
        { required: ["baseRevision"] },
        { required: ["trustedCiBaseRevision"] },
      ],
    },
  },
  {
    name: "maestro_build_readiness",
    description:
      "Read Build Readiness grouped as Screens, Data, Automations, and Connections.",
    inputSchema: closed({ revision: { type: "string" } }),
  },
] as const;

export const createAppMapMcpProjection = (
  repoRoot: string,
): AppMapMcpProjection => ({
  tools: () => TOOLS,
  call: async (name, args) => {
    const unknown = () => ({
      isError: true as const,
      code: "MCP_UNKNOWN_TOOL",
      content: [{ type: "text" as const, text: "Unknown App Map MCP tool." }],
    });
    if (!TOOLS.some((tool) => tool.name === name)) return unknown();
    const allowed =
      name === "maestro_app_map_impact"
        ? ["baseRevision", "trustedCiBaseRevision", "headRevision"]
        : ["revision"];
    const invalidShape =
      Object.keys(args).some(
        (key) => !allowed.includes(key) || typeof args[key] !== "string",
      ) ||
      (name === "maestro_app_map_impact" &&
        (typeof args.baseRevision === "string") ===
          (typeof args.trustedCiBaseRevision === "string"));
    if (invalidShape)
      return {
        isError: true,
        code: "MCP_INVALID_ARGUMENT",
        content: [{ type: "text", text: "App Map arguments are not closed." }],
      };
    const text = (key: string): string | undefined =>
      typeof args[key] === "string" ? args[key] : undefined;
    const baseRevision = text("baseRevision");
    const trustedCiBaseRevision = text("trustedCiBaseRevision");
    const headRevision = text("headRevision");
    const revision = text("revision");
    const result =
      name === "maestro_app_map_impact"
        ? await executeAppMapImpact({
            repoRoot,
            ...(baseRevision === undefined
              ? {}
              : { explicitBaseRevision: baseRevision }),
            ...(trustedCiBaseRevision === undefined
              ? {}
              : { trustedCiBaseRevision }),
            ...(headRevision === undefined ? {} : { headRevision }),
          })
        : await executeAppMapMap({
            repoRoot,
            ...(revision === undefined ? {} : { revision }),
          });
    if (!result.ok)
      return {
        isError: true,
        code: result.code,
        content: [{ type: "text", text: result.human }],
      };
    const structuredContent =
      name === "maestro_build_readiness" &&
      typeof result.data === "object" &&
      result.data !== null &&
      "readiness" in result.data
        ? result.data.readiness
        : result.data;
    return {
      isError: false,
      content: [{ type: "text", text: result.human }],
      structuredContent,
    };
  },
});
