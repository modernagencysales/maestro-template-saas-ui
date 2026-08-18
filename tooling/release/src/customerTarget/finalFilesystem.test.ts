import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  adapter,
  prepare,
  taggedRelease,
} from "./createAdapter.testFixtures.js";
import {
  assertFinalCustomerFilesystem,
  assertNoPathEscape,
  enumerateFinalCustomerTree,
  runFinalCustomerCompileGates,
} from "./finalFilesystem.test-support.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const offlinePnpmBin = "/private/tmp/maestro-pnpm-10-bin";
const installedStoreDir = readFileSync(
  join(repositoryRoot, "node_modules/.modules.yaml"),
  "utf8",
).match(/^storeDir: (.+)$/m)?.[1];
const offlinePnpmEnvironment = {
  ...process.env,
  PATH: `${offlinePnpmBin}:${process.env.PATH ?? ""}`,
  npm_config_store_dir: installedStoreDir,
};

const installOffline = async (root: string): Promise<void> => {
  try {
    await execFileAsync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      {
        cwd: root,
        env: offlinePnpmEnvironment,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
  } catch (error) {
    const failure = error as Error & {
      readonly stdout?: string;
      readonly stderr?: string;
    };
    throw new Error(
      [failure.message, failure.stdout, failure.stderr]
        .filter((value): value is string => Boolean(value))
        .join("\n"),
    );
  }
};

describe("final materialized customer filesystem", () => {
  it("audits the real disposable final target, not preview writes", async () => {
    expect(installedStoreDir).toBeTruthy();
    const parent = mkdtempSync(join(tmpdir(), "maestro-final-filesystem-"));
    try {
      const pnpmVersion = await execFileAsync("pnpm", ["--version"], {
        encoding: "utf8",
        env: offlinePnpmEnvironment,
      });
      expect(pnpmVersion.stdout.trim()).toBe("10.12.1");
      const releaseRoot = join(parent, "release");
      const targetRoot = join(parent, "customer-app");
      await execFileAsync("git", [
        "clone",
        "--quiet",
        "--shared",
        repositoryRoot,
        releaseRoot,
      ]);
      await execFileAsync(
        "git",
        ["checkout", "--quiet", "--detach", "maestro-template-v0.2.0-alpha.2"],
        { cwd: releaseRoot },
      );
      await installOffline(releaseRoot);
      await execFileAsync(
        "pnpm",
        [
          "maestro",
          "--",
          "create",
          targetRoot,
          "--name",
          "Final Filesystem Audit",
          "--outcome",
          "Audit the materialized customer artifact",
          "--write",
          "--privacy-reviewed",
          "--json",
        ],
        {
          cwd: releaseRoot,
          encoding: "utf8",
          env: offlinePnpmEnvironment,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const tree = enumerateFinalCustomerTree(targetRoot);
      assertNoPathEscape(tree.root, tree.files);
      expect(tree.files).not.toContain(
        "tooling/agent-pack/src/pluginContract.ts",
      );
      expect(
        tree.files.filter(
          (path) =>
            path === "tooling/agent-pack/src/mcp" ||
            path.startsWith("tooling/agent-pack/src/mcp/"),
        ),
      ).toEqual([]);
      assertFinalCustomerFilesystem(tree);
      if (installedStoreDir === undefined)
        throw new Error("The installed pnpm store is unavailable");
      await runFinalCustomerCompileGates(tree.root, installedStoreDir);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
    expect(existsSync(parent)).toBe(false);
  }, 900_000);

  it("applies blueprint removal after a forbidden base copy", async () => {
    const forbidden = "tooling/agent-pack/src/pluginContract.ts";
    const fixture = taggedRelease({
      extraCopies: { [forbidden]: "forbidden base bytes\n" },
      blueprintRemovals: [forbidden],
    });
    expect(fixture.baseOperations).toContain(forbidden);
    const release = adapter(fixture);
    const prepared = await prepare(fixture, release);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.preview.omissions).toContain(forbidden);
    const result = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    if (!result.ok) throw new Error(result.message);
    expect(existsSync(resolve(fixture.targetRoot, forbidden))).toBe(false);
    const journal = JSON.parse(
      readFileSync(
        resolve(fixture.targetRoot, ".maestro-create-journal.json"),
        "utf8",
      ),
    ) as { files: { path: string; sha256: string }[] };
    expect(journal.files.map(({ path }) => path)).not.toContain(forbidden);
  });
});
