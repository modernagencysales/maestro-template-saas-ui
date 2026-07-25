import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runCliAsync } from "../index";
import { CREATE_HELP } from "./create";
import { createFactoryCliComposition } from "./composition";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("create root integration", () => {
  it("registers the exact six-command factory inventory", () => {
    expect(
      createFactoryCliComposition(() => ({})).handlers.map(
        ({ command }) => command,
      ),
    ).toEqual([
      "create",
      "preflight",
      "verify",
      "check",
      "plan-check",
      "scaffold",
    ]);
  });

  it("routes the exact create help", async () => {
    await expect(
      runCliAsync(["create", "--help"], undefined, repoRoot),
    ).resolves.toEqual({
      exitCode: 0,
      stdout: CREATE_HELP,
      stderr: "",
    });
    expect((await runCliAsync(["help"])).stdout).toContain(CREATE_HELP.trim());
  });

  it("keeps default preview non-mutating and fails closed for the fixture-only release", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-root-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer-app");
    const result = await runCliAsync(
      [
        "create",
        target,
        "--name",
        "My App",
        "--outcome",
        "Track client requests",
        "--json",
      ],
      undefined,
      repoRoot,
    );

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mutationPosture: "preview",
      exitClass: "blockedMutation",
      diagnostics: [{ code: "AGENT_PACK_CREATE_RELEASE_UNAVAILABLE" }],
      data: null,
    });
    expect(existsSync(target)).toBe(false);
  });

  it("pins the release workspace dependency in package and lock importer", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "apps/cli/package.json"), "utf8"),
    );
    expect(packageJson.dependencies["@maestro-template/release-tooling"]).toBe(
      "workspace:*",
    );
    expect(readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8")).toContain(
      [
        '      "@maestro-template/release-tooling":',
        "        specifier: workspace:*",
        "        version: link:../../tooling/release",
      ].join("\n"),
    );
  });
});
