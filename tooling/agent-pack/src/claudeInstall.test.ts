import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverHostProjection,
  installHostProjection,
  removeHostProjection,
} from "./hostInstall.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Claude Code skill-only installation", () => {
  it("stages only local skill sources with every active side effect disabled", async () => {
    const manifest: unknown = JSON.parse(
      await readFile(
        join(repoRoot, "agent-pack/hosts/claude-code/install-manifest.json"),
        "utf8",
      ),
    );
    const plugin: unknown = JSON.parse(
      await readFile(
        join(repoRoot, "agent-pack/plugins/maestro/.claude-plugin/plugin.json"),
        "utf8",
      ),
    );

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      host: "claude-code",
      safety: {
        network: false,
        hooks: false,
        mcp: false,
        convexAuthentication: false,
      },
    });
    expect(plugin).toEqual({
      name: "maestro",
      version: "0.1.0",
      description: expect.any(String),
      author: { name: "Maestro" },
    });
  });

  it("installs local context, discovers it, and removes only owned files", async () => {
    const fixture = await temporaryFixture();
    const { homeDir } = fixture;
    const unrelated = join(homeDir, ".claude", "unrelated.json");
    await mkdir(join(homeDir, ".claude"), { recursive: true });
    await writeFile(unrelated, '{"owner":"customer"}\n', "utf8");
    const beforeSource = await snapshot(fixture.checkoutDir);

    const receipt = await installHostProjection({
      host: "claude-code",
      repoRoot: fixture.checkoutDir,
      homeDir,
    });
    const installed = await discoverHostProjection({
      host: "claude-code",
      homeDir,
    });

    expect(installed.maestro).toBe(true);
    expect(installed.maestroConvex).toBe(true);
    expect(installed.officialConvexSkills).toEqual([
      "convex",
      "convex-create-component",
      "convex-migration-helper",
      "convex-performance-audit",
      "convex-quickstart",
      "convex-setup-auth",
    ]);
    expect(installed.mcpConfigured).toBe(false);
    expect(receipt.files.length).toBeGreaterThan(0);

    const result = await removeHostProjection(receipt);

    expect(result.refused).toEqual([]);
    expect([...result.removed].sort()).toEqual(
      receipt.files.map((file) => file.path).sort(),
    );
    expect(await readFile(unrelated, "utf8")).toBe('{"owner":"customer"}\n');
    expect(await snapshot(fixture.checkoutDir)).toEqual(beforeSource);
    expect(
      await discoverHostProjection({ host: "claude-code", homeDir }),
    ).toEqual({
      maestro: false,
      maestroConvex: false,
      officialConvexSkills: [],
      mcpConfigured: false,
    });
  });

  it("refuses to remove an owned file changed after installation", async () => {
    const fixture = await temporaryFixture();
    const { homeDir } = fixture;
    const receipt = await installHostProjection({
      host: "claude-code",
      repoRoot: fixture.checkoutDir,
      homeDir,
    });
    const changed = receipt.files[0];
    expect(changed).toBeDefined();
    if (changed === undefined) throw new Error("fixture installed no files");
    await writeFile(changed.path, "customer changed this file\n", "utf8");

    const result = await removeHostProjection(receipt);

    expect(result.refused).toContain(changed.path);
    expect(await readFile(changed.path, "utf8")).toBe(
      "customer changed this file\n",
    );
  });
});

async function temporaryFixture(): Promise<{
  checkoutDir: string;
  homeDir: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "maestro-claude-fixture-"));
  temporaryRoots.push(root);
  const checkoutDir = join(root, "checkout");
  const homeDir = await mkdtemp(join(root, "maestro-claude-code-"));
  await mkdir(checkoutDir, { recursive: true });
  await cp(join(repoRoot, "agent-pack"), join(checkoutDir, "agent-pack"), {
    recursive: true,
  });
  await writeFile(
    join(checkoutDir, "customer-code.ts"),
    "export const customerOwned = true;\n",
    "utf8",
  );
  return { checkoutDir, homeDir };
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  await visit(root, root, entries);
  return entries;
}

async function visit(
  root: string,
  current: string,
  entries: Record<string, string>,
): Promise<void> {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      await visit(root, path, entries);
    } else if (entry.isFile()) {
      entries[relative(root, path)] = await readFile(path, "utf8");
    }
  }
}
