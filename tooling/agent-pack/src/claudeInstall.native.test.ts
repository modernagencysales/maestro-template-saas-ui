import { readFile } from "node:fs/promises";
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
  runNativeHostCommand,
  type NativeHostCommandResult,
  type NativeHostFixture,
} from "./nativeHostAcceptance.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const fixtures: NativeHostFixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(destroyNativeHostFixture));
});

describe("native Claude Code acceptance", () => {
  it("strictly parses, installs, discovers, and removes the local marketplace pre-auth", async (context) => {
    const fixture = await createNativeHostFixture("claude-code");
    fixtures.push(fixture);
    const version = await requireNativeBinary(context, fixture);
    expect(version).toMatch(/^\d+\.\d+\.\d+ \(Claude Code\)$/);

    const auth = await runNativeHostCommand(fixture, ["auth", "status"], {
      networkAccess: "forbid",
    });
    expectIsolatedOffline(auth);
    expect(auth.exitCode).toBe(1);
    expect(auth.stdout).toContain('"loggedIn": false');

    await expectSuccess(
      fixture,
      ["plugin", "validate", "--strict", repoRoot],
      repoRoot,
    );
    await expectSuccess(
      fixture,
      ["plugin", "marketplace", "add", "./", "--scope", "user"],
      repoRoot,
    );

    const available = await expectSuccess(fixture, [
      "plugin",
      "list",
      "--available",
      "--json",
    ]);
    expect(JSON.parse(available.stdout)).toMatchObject({
      installed: [],
      available: [
        { pluginId: "maestro@maestro-agent-pack" },
        { pluginId: "maestro-convex@maestro-agent-pack" },
      ],
    });

    await expectSuccess(fixture, [
      "plugin",
      "install",
      "maestro@maestro-agent-pack",
      "--scope",
      "user",
    ]);
    await expectSuccess(fixture, [
      "plugin",
      "install",
      "maestro-convex@maestro-agent-pack",
      "--scope",
      "user",
    ]);

    const installed = await expectSuccess(fixture, [
      "plugin",
      "list",
      "--json",
    ]);
    expect(JSON.parse(installed.stdout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "maestro@maestro-agent-pack",
          enabled: true,
        }),
        expect.objectContaining({
          id: "maestro-convex@maestro-agent-pack",
          enabled: true,
        }),
      ]),
    );

    const maestroDetails = await expectSuccess(fixture, [
      "plugin",
      "details",
      "maestro@maestro-agent-pack",
    ]);
    expect(maestroDetails.stdout).toMatch(/Skills \(1\)\s+maestro/);
    expect(maestroDetails.stdout).toMatch(/MCP servers \(1\)\s+maestro/);

    const convexDetails = await expectSuccess(fixture, [
      "plugin",
      "details",
      "maestro-convex@maestro-agent-pack",
    ]);
    expect(convexDetails.stdout).toMatch(/Skills \(1\)\s+maestro-convex/);
    expect(convexDetails.stdout).toContain("MCP servers (0)");

    await expectSuccess(fixture, [
      "plugin",
      "uninstall",
      "maestro@maestro-agent-pack",
      "--scope",
      "user",
      "--yes",
    ]);

    const debugFile = join(fixture.hostConfigDir, "skill-discovery.log");
    const invocation = await runNativeHostCommand(
      fixture,
      [
        "-p",
        "--no-session-persistence",
        "--output-format",
        "json",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--debug-file",
        debugFile,
        "List the applicable official Convex skills.",
      ],
      { cwd: repoRoot, networkAccess: "forbid" },
    );
    expectIsolatedOffline(invocation);
    expect(invocation.exitCode).toBe(1);
    expect(invocation.stdout).toContain("Not logged in · Please run /login");
    const debug = await readFile(debugFile, "utf8");
    expect(debug).toContain(`project=[${join(repoRoot, ".claude/skills")}]`);
    expect(debug).toMatch(
      /Loaded 7 unique skills \(7 unconditional, 0 conditional, managed: 0, user: 0, project: 7/,
    );
    expect(debug).toContain("getPluginSkills: Processing 1 enabled plugins");
    expect(debug).toContain("Total plugin skills loaded: 1");

    await expectSuccess(fixture, [
      "plugin",
      "uninstall",
      "maestro-convex@maestro-agent-pack",
      "--scope",
      "user",
      "--yes",
    ]);
    await expectSuccess(fixture, [
      "plugin",
      "marketplace",
      "remove",
      "maestro-agent-pack",
      "--scope",
      "user",
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
    expect(JSON.parse(finalPlugins.stdout)).toEqual([]);
    expect(JSON.parse(finalMarketplaces.stdout)).toEqual([]);
    expect(
      (await listNativeHostFixtureFiles(fixture)).every((path) =>
        path.startsWith("host-config/"),
      ),
    ).toBe(true);

    await restoreNativeHostFixture(fixture);
    expect(await listNativeHostFixtureFiles(fixture)).toEqual([]);
  }, 60_000);

  it("keeps every conditional Maestro reference resolvable", async () => {
    await expect(
      readFile(
        join(
          repoRoot,
          "agent-pack/plugins/maestro/skills/maestro/references/host-safety.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("# Host Safety");
    await expect(
      readFile(
        join(
          repoRoot,
          "agent-pack/plugins/maestro/skills/maestro/references/workflow-authoring.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("# Workflow Authoring");
    await expect(
      readFile(join(repoRoot, "agent-pack/references/convex.md"), "utf8"),
    ).resolves.toContain("# Convex coaching reference");
    await expect(
      readFile(
        join(repoRoot, "docs/template/convex-workflow-compatibility.md"),
        "utf8",
      ),
    ).resolves.toContain("# Convex Workflow Compatibility");
  });
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
  cwd?: string,
) {
  const result = await runNativeHostCommand(fixture, args, {
    cwd,
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
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    "CLAUDE_CONFIG_DIR",
    "DISABLE_AUTOUPDATER",
    "HOME",
    "HTTPS_PROXY",
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
