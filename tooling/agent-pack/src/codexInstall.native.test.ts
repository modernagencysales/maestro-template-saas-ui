import { copyFile, cp, mkdir, readFile, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { TestContext } from "vitest";
import {
  createNativeHostFixture,
  destroyNativeHostFixture,
  listNativeHostFixtureFiles,
  probeNativeHostBinary,
  restoreNativeHostFixture,
  runNativeMcpHandshake,
  runNativeHostCommand,
  type NativeHostCommandResult,
  type NativeHostFixture,
} from "./nativeHostAcceptance.js";
import { validateOfficialConvexBundle } from "./officialConvex.js";
import {
  buildConvexMcpLaunch,
  parseConvexMcpProfiles,
  validateConvexToolInventory,
} from "./pluginContract.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const fixtures: NativeHostFixture[] = [];
const officialSkills = [
  "convex",
  "convex-create-component",
  "convex-migration-helper",
  "convex-performance-audit",
  "convex-quickstart",
  "convex-setup-auth",
] as const;

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(destroyNativeHostFixture));
});

describe("native Codex acceptance", () => {
  it("discovers repo instructions and skills, then installs and removes native plugins pre-auth", async (context) => {
    const fixture = await createNativeHostFixture("codex");
    fixtures.push(fixture);
    const version = await requireNativeBinary(context, fixture);
    expect(version).toMatch(/^codex-cli \d+\.\d+\.\d+$/);
    await prepareIsolatedMaestroProject(fixture);

    const auth = await runNativeHostCommand(fixture, ["login", "status"], {
      networkAccess: "forbid",
    });
    expectIsolatedOffline(auth);
    expect(auth.exitCode).toBe(1);
    expect(`${auth.stdout}\n${auth.stderr}`).toContain("Not logged in");

    const repoPrompt = await expectSuccess(fixture, [
      "-C",
      repoRoot,
      "debug",
      "prompt-input",
      "List applicable Maestro and Convex skills.",
    ]);
    const repoContext = JSON.stringify(JSON.parse(repoPrompt.stdout));
    expect(repoContext).toContain("# Agent Instructions");
    for (const skill of [...officialSkills, "maestro", "maestro-convex"]) {
      expect(repoContext).toContain(
        `${repoRoot}/.agents/skills/${skill}/SKILL.md`,
      );
    }

    const marketplace = await expectSuccess(fixture, [
      "plugin",
      "marketplace",
      "add",
      repoRoot,
      "--json",
    ]);
    expect(JSON.parse(marketplace.stdout)).toMatchObject({
      marketplaceName: "maestro-agent-pack",
      installedRoot: repoRoot,
      alreadyAdded: false,
    });

    const available = await expectSuccess(fixture, [
      "plugin",
      "list",
      "--available",
      "--json",
    ]);
    expect(JSON.parse(available.stdout)).toMatchObject({
      installed: [],
      available: [
        { pluginId: "maestro@maestro-agent-pack", installed: false },
        {
          pluginId: "maestro-convex@maestro-agent-pack",
          installed: false,
        },
      ],
    });

    for (const plugin of ["maestro", "maestro-convex"]) {
      const added = await expectSuccess(fixture, [
        "plugin",
        "add",
        `${plugin}@maestro-agent-pack`,
        "--json",
      ]);
      expect(JSON.parse(added.stdout)).toMatchObject({
        pluginId: `${plugin}@maestro-agent-pack`,
        version: "0.1.0",
      });
    }

    const installed = await expectSuccess(fixture, [
      "plugin",
      "list",
      "--json",
    ]);
    expect(JSON.parse(installed.stdout)).toMatchObject({
      installed: expect.arrayContaining([
        expect.objectContaining({
          pluginId: "maestro-convex@maestro-agent-pack",
          installed: true,
          enabled: true,
        }),
        expect.objectContaining({
          pluginId: "maestro@maestro-agent-pack",
          installed: true,
          enabled: true,
        }),
      ]),
    });
    await expectConvexContractsUnchanged();

    const pluginPrompt = await expectSuccess(fixture, [
      "-C",
      repoRoot,
      "debug",
      "prompt-input",
      "List applicable Maestro and Convex skills.",
    ]);
    const pluginContext = JSON.stringify(JSON.parse(pluginPrompt.stdout));
    expect(pluginContext).toContain("maestro:maestro");
    expect(pluginContext).toContain("maestro-convex:maestro-convex");
    expect(pluginContext).toContain(
      `${repoRoot}/.agents/skills/convex/SKILL.md`,
    );

    const mcp = await expectSuccess(fixture, [
      "-C",
      fixture.projectDir,
      "mcp",
      "list",
      "--json",
    ]);
    expect(JSON.parse(mcp.stdout)).toEqual([
      expect.objectContaining({ name: "maestro", enabled: true }),
    ]);
    expect(mcp.stdout).not.toContain('"name": "convex"');

    const maestroConfigResult = await expectSuccess(fixture, [
      "-C",
      fixture.projectDir,
      "mcp",
      "get",
      "maestro",
      "--json",
    ]);
    const maestroConfig = JSON.parse(maestroConfigResult.stdout) as unknown;
    expect(maestroConfig).toMatchObject({
      name: "maestro",
      enabled: true,
      disabled_reason: null,
      transport: {
        type: "stdio",
        command: "pnpm",
        args: ["--silent", "maestro", "--", "mcp"],
        env: null,
        env_vars: [],
        cwd: null,
      },
    });
    expect(JSON.stringify(maestroConfig)).not.toContain("CLAUDE_PROJECT_DIR");
    expect(JSON.stringify(maestroConfig)).not.toContain("/plugins/cache/");

    const handshake = await runNativeMcpHandshake(fixture, maestroConfig);
    expectIsolatedOffline(handshake.process);
    expect(handshake.process.cwd).toBe(fixture.projectDir);
    expect(handshake.initialize).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "maestro-agent-pack", version: "1.0.0" },
      },
    });
    expect(handshake.tools.map(({ name }) => name)).toEqual([
      "maestro_preflight",
      "maestro_scaffold_preview",
      "maestro_support_bundle_preview",
      "maestro_verify",
      "maestro_app_map",
      "maestro_app_map_impact",
      "maestro_build_readiness",
    ]);

    for (const plugin of ["maestro", "maestro-convex"]) {
      const removed = await expectSuccess(fixture, [
        "plugin",
        "remove",
        `${plugin}@maestro-agent-pack`,
        "--json",
      ]);
      expect(JSON.parse(removed.stdout)).toMatchObject({
        pluginId: `${plugin}@maestro-agent-pack`,
      });
      if (plugin === "maestro") {
        const contextOnlyMcp = await expectSuccess(fixture, [
          "-C",
          fixture.projectDir,
          "mcp",
          "list",
          "--json",
        ]);
        expect(JSON.parse(contextOnlyMcp.stdout)).toEqual([]);
        const removedMcp = await runNativeHostCommand(
          fixture,
          ["-C", fixture.projectDir, "mcp", "get", "maestro", "--json"],
          { networkAccess: "forbid" },
        );
        expectIsolatedOffline(removedMcp);
        expect(removedMcp.exitCode).not.toBe(0);
        expect(`${removedMcp.stdout}\n${removedMcp.stderr}`).toContain(
          "No MCP server named 'maestro' found",
        );
      }
    }
    await expectSuccess(fixture, [
      "plugin",
      "marketplace",
      "remove",
      "maestro-agent-pack",
      "--json",
    ]);

    const finalPlugins = await expectSuccess(fixture, [
      "plugin",
      "list",
      "--json",
    ]);
    const finalMarketplaces = await expectSuccess(fixture, [
      "plugin",
      "marketplace",
      "list",
      "--json",
    ]);
    expect(JSON.parse(finalPlugins.stdout)).toEqual({
      installed: [],
      available: [],
    });
    expect(JSON.parse(finalMarketplaces.stdout)).toEqual({
      marketplaces: [],
    });
    expect(
      (await listNativeHostFixtureFiles(fixture)).filter((path) =>
        path.includes("/plugins/"),
      ),
    ).toEqual([]);
    await expect(
      readFile(`${fixture.hostConfigDir}/config.toml`, "utf8"),
    ).resolves.toBe("");

    await restoreNativeHostFixture(fixture);
    expect(await listNativeHostFixtureFiles(fixture)).toEqual([]);
  }, 60_000);
});

async function requireNativeBinary(
  context: TestContext,
  fixture: NativeHostFixture,
): Promise<string> {
  const probe = await probeNativeHostBinary(fixture);
  if (probe.kind === "missing-binary") {
    context.skip(`missing native binary: ${probe.binary}`);
  }
  return probe.version;
}

async function expectSuccess(
  fixture: NativeHostFixture,
  args: readonly string[],
) {
  const result = await runNativeHostCommand(fixture, args, {
    networkAccess: "forbid",
  });
  expectIsolatedOffline(result);
  expect(
    result.exitCode,
    `${result.command}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  ).toBe(0);
  return result;
}

function expectIsolatedOffline(result: NativeHostCommandResult): void {
  expect(result.networkAccess).toBe("none");
  expect(result.environmentKeys).toEqual([
    "CI",
    "CODEX_HOME",
    "HOME",
    "LANG",
    "LC_ALL",
    "NO_COLOR",
    "PATH",
    "TERM",
    "TMPDIR",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
  ]);
}

async function prepareIsolatedMaestroProject(
  fixture: NativeHostFixture,
): Promise<void> {
  await copyFile(
    join(repoRoot, "package.json"),
    join(fixture.projectDir, "package.json"),
  );
  await cp(join(repoRoot, "apps/cli"), join(fixture.projectDir, "apps/cli"), {
    recursive: true,
  });
  await mkdir(join(fixture.projectDir, "docs/template"), { recursive: true });
  await copyFile(
    join(repoRoot, "docs/template/convex-mcp-profiles.json"),
    join(fixture.projectDir, "docs/template/convex-mcp-profiles.json"),
  );
  for (const directory of ["node_modules", "packages", "releases", "tooling"]) {
    await symlink(
      join(repoRoot, directory),
      join(fixture.projectDir, directory),
      "dir",
    );
  }
}

async function expectConvexContractsUnchanged(): Promise<void> {
  await expect(validateOfficialConvexBundle(repoRoot)).resolves.toEqual([]);
  expect(
    JSON.parse(await readFile(`${repoRoot}/convex.json`, "utf8")),
  ).toMatchObject({
    functions: "packages/convex/convex",
    aiFiles: { skills: { agents: ["claude-code", "codex"] } },
  });
  await expect(
    readFile(`${repoRoot}/packages/convex/convex.json`, "utf8"),
  ).rejects.toMatchObject({ code: "ENOENT" });

  const contract = parseConvexMcpProfiles(
    JSON.parse(
      await readFile(
        `${repoRoot}/docs/template/convex-mcp-profiles.json`,
        "utf8",
      ),
    ),
  );
  expect(() => buildConvexMcpLaunch(contract, "fake")).toThrow(
    "profile fake does not launch Convex MCP",
  );
  expect(() => buildConvexMcpLaunch(contract, "production")).toThrow(
    "profile production does not launch Convex MCP",
  );
  expect(contract.profiles.inspect.allow).not.toContain("data");
  expect(contract.profiles["dev-power"].allow).toContain("data");
  for (const profile of Object.values(contract.profiles)) {
    expect(profile.deny).toEqual(
      expect.arrayContaining(["envGet", "envList", "envRemove", "envSet"]),
    );
  }
  expect(() =>
    validateConvexToolInventory(contract, [
      ...contract.upstreamToolInventory,
      "unknownNativeInstallTool",
    ]),
  ).toThrow("unknown Convex MCP tools: unknownNativeInstallTool");
}
