import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  it("audits the real disposable final target, not preview writes", async () => {
    const fixture = taggedRelease({ customerProjectionRoot: repositoryRoot });
    const release = adapter(fixture);
    const prepared = await prepare(fixture, release);
    if (!prepared.ok) throw new Error(prepared.message);
    const result = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    if (!result.ok) throw new Error(result.message);

    try {
      const tree = enumerateFinalCustomerTree(fixture.targetRoot);
      assertNoPathEscape(tree.root, tree.files);
      assertFinalCustomerFilesystem(tree);
      runFinalCustomerCompileGates(tree.root);
    } finally {
      rmSync(fixture.targetRoot, { recursive: true, force: true });
    }
    expect(existsSync(fixture.targetRoot)).toBe(false);
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
