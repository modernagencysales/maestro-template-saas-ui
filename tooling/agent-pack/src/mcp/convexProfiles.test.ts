import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseConvexMcpProfiles } from "../pluginContract.js";
import { createConvexProfilePreview } from "./convexProfiles.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function contract() {
  return parseConvexMcpProfiles(
    JSON.parse(
      await readFile(
        `${repoRoot}/docs/template/convex-mcp-profiles.json`,
        "utf8",
      ),
    ),
  );
}

describe("Convex MCP profile projection", () => {
  it("defaults explicit opt-in preview to inspect without launching", async () => {
    const profiles = await contract();
    const preview = createConvexProfilePreview({
      contract: profiles,
      observedTools: profiles.upstreamToolInventory,
      repoRoot,
    });
    expect(preview).toMatchObject({
      profile: "inspect",
      enabled: true,
      cwd: repoRoot,
      autoStart: false,
      requiresConfirmation: false,
      launch: { command: "pnpm" },
    });
    expect(preview.claudeCode.add.args).toContain("--scope");
    expect(preview.claudeCode.add.args).toContain("local");
    expect(preview.claudeCode.remove.args).toEqual([
      "mcp",
      "remove",
      "--scope",
      "local",
      "convex",
    ]);
  });

  it("keeps fake mode free of Convex MCP configuration or process", async () => {
    const profiles = await contract();
    expect(
      createConvexProfilePreview({
        contract: profiles,
        profile: "fake",
        observedTools: profiles.upstreamToolInventory,
        repoRoot,
      }),
    ).toEqual({
      profile: "fake",
      enabled: false,
      autoStart: false,
      effects: profiles.profiles.fake.effects,
    });
  });

  it("separates dev-power with explicit effects and confirmation", async () => {
    const profiles = await contract();
    const preview = createConvexProfilePreview({
      contract: profiles,
      profile: "dev-power",
      observedTools: profiles.upstreamToolInventory,
      repoRoot,
    });
    expect(preview).toMatchObject({
      profile: "dev-power",
      enabled: true,
      autoStart: false,
      requiresConfirmation: true,
    });
    expect(preview.effects.join(" ")).toContain("mutate development data");
  });

  it("always disables environment-value tools and production flags", async () => {
    const profiles = await contract();
    for (const profile of ["inspect", "dev-power"] as const) {
      const preview = createConvexProfilePreview({
        contract: profiles,
        profile,
        observedTools: profiles.upstreamToolInventory,
        repoRoot,
      });
      if (!preview.enabled) throw new Error("profile unexpectedly disabled");
      expect(preview.launch.args.join(" ")).toContain(
        "envGet,envList,envRemove,envSet",
      );
      expect(preview.launch.args).not.toEqual(
        expect.arrayContaining(profiles.forbiddenFlags),
      );
    }
  });

  it("fails closed for unknown inventory and production", async () => {
    const profiles = await contract();
    expect(() =>
      createConvexProfilePreview({
        contract: profiles,
        observedTools: [...profiles.upstreamToolInventory, "newTool"],
        repoRoot,
      }),
    ).toThrow("unknown Convex MCP tools");
    expect(() =>
      createConvexProfilePreview({
        contract: profiles,
        profile: "production",
        observedTools: profiles.upstreamToolInventory,
        repoRoot,
      }),
    ).toThrow("production Convex MCP is unsupported");
  });
});
