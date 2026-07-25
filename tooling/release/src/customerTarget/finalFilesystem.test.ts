import { spawnSync } from "node:child_process";
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

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

describe("final materialized customer filesystem", () => {
  it("audits the real disposable final target, not preview writes", () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-final-filesystem-"));
    const targetRoot = join(parent, "customer-app");
    const result = spawnSync(
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
        "--json",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    try {
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
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
      runFinalCustomerCompileGates(tree.root);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
    expect(existsSync(parent)).toBe(false);
  });

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
