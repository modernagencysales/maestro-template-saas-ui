import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildConvexMcpLaunch,
  parseConvexMcpProfiles,
  validateConvexToolInventory,
} from "./pluginContract.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(`${repoRoot}/${path}`, "utf8"));
}

describe("maestro-convex skill-only plugin", () => {
  it("contains only metadata and skills", async () => {
    const manifest = (await readJson(
      "agent-pack/plugins/maestro-convex/.claude-plugin/plugin.json",
    )) as Record<string, unknown>;

    expect(manifest.name).toBe("maestro-convex");
    expect(Object.keys(manifest).sort()).toEqual([
      "description",
      "name",
      "version",
    ]);
  });
});

describe("Convex MCP profile contract", () => {
  it("pins the audited upstream inventory and root project", async () => {
    const contract = parseConvexMcpProfiles(
      await readJson("docs/template/convex-mcp-profiles.json"),
    );

    expect(contract.convexCliVersion).toBe("1.42.1");
    expect(contract.projectDir).toBe(".");
    expect(contract.upstreamToolInventory).toEqual([
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
    ]);
  });

  it("keeps inspect metadata-only and environment values always disabled", async () => {
    const contract = parseConvexMcpProfiles(
      await readJson("docs/template/convex-mcp-profiles.json"),
    );

    expect(contract.profiles.inspect.allow).toEqual([
      "functionSpec",
      "insights",
      "status",
      "tables",
    ]);
    for (const profile of Object.values(contract.profiles)) {
      expect(profile.deny).toEqual(
        expect.arrayContaining(["envGet", "envList", "envRemove", "envSet"]),
      );
    }
  });

  it("refuses fake, production, and unknown upstream tools", async () => {
    const input = await readJson("docs/template/convex-mcp-profiles.json");
    const contract = parseConvexMcpProfiles(input);

    expect(() => buildConvexMcpLaunch(contract, "fake")).toThrow(
      "profile fake does not launch Convex MCP",
    );
    expect(() => buildConvexMcpLaunch(contract, "production")).toThrow(
      "profile production does not launch Convex MCP",
    );
    expect(() =>
      validateConvexToolInventory(contract, [
        ...contract.upstreamToolInventory,
        "newUpstreamTool",
      ]),
    ).toThrow("unknown Convex MCP tools: newUpstreamTool");
  });

  it("builds an explicit personal-dev launch without production flags", async () => {
    const contract = parseConvexMcpProfiles(
      await readJson("docs/template/convex-mcp-profiles.json"),
    );
    const launch = buildConvexMcpLaunch(contract, "inspect");

    expect(launch.command).toBe("pnpm");
    expect(launch.args).toEqual([
      "exec",
      "convex",
      "mcp",
      "start",
      "--project-dir",
      ".",
      "--deployment",
      "dev",
      "--disable-tools",
      contract.profiles.inspect.deny.join(","),
    ]);
    expect(launch.args).not.toContain("--prod");
    expect(launch.args).not.toContain(
      "--dangerously-enable-production-deployments",
    );
    expect(launch.args).not.toContain("--cautiously-allow-production-pii");
  });
});
