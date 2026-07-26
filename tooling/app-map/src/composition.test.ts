import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CURRENT_TEMPLATE_INSTANCE_VERSIONS,
  TEMPLATE_INSTANCE_COMPATIBILITY,
  TEMPLATE_INSTANCE_PROVENANCE,
  serializeTemplateInstance,
} from "@maestro-template/template-core/templateInstance";
import { afterEach, describe, expect, it } from "vitest";
import { serializeAppMap } from "./build";
import { composeAppMap } from "./composition";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true });
});

const fixtureRepository = (): {
  readonly root: string;
  readonly revision: string;
} => {
  const root = mkdtempSync(join(tmpdir(), "app-map-composition-"));
  temporary.push(root);
  const sourceRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  execFileSync("git", ["clone", "--shared", "--no-checkout", sourceRoot, root]);
  execFileSync("git", ["read-tree", "HEAD"], { cwd: root });
  writeFileSync(
    join(root, "template-instance.json"),
    serializeTemplateInstance({
      schemaVersion: 2,
      versions: { ...CURRENT_TEMPLATE_INSTANCE_VERSIONS },
      release: {
        version: "0.2.0-alpha.1",
        tag: "maestro-template-v0.2.0-alpha.1",
      },
      compatibility: structuredClone(TEMPLATE_INSTANCE_COMPATIBILITY),
      support: {
        state: "supported",
        deprecationDate: null,
        releaseAvailability: "unavailable",
        releaseEvidence: "workspace-only",
      },
      provenance: { ...TEMPLATE_INSTANCE_PROVENANCE },
    }),
  );
  execFileSync("git", ["add", "template-instance.json"], { cwd: root });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=App Map Test",
      "-c",
      "user.email=app-map@example.invalid",
      "commit",
      "-m",
      "fixture",
    ],
    { cwd: root },
  );
  return {
    root,
    revision: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
  };
};

describe("closed App Map composition", () => {
  it("loads all eleven exact-revision sources and builds byte-stably", async () => {
    const fixture = fixtureRepository();
    const first = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    // Exact-revision composition must ignore dirty canonical working-tree bytes.
    writeFileSync(join(fixture.root, "template-instance.json"), "{}\n");
    const second = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    expect(first.ok, first.ok ? undefined : first.message).toBe(true);
    expect(second.ok, second.ok ? undefined : second.message).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.input.batches).toHaveLength(11);
    for (const batch of first.input.batches) {
      const facts = [...batch.nodes, ...batch.edges];
      if (batch.source.id === "template-instance") {
        expect(facts).toHaveLength(0);
        continue;
      }
      expect(
        facts.length,
        `${batch.source.id} must project facts`,
      ).toBeGreaterThan(0);
      expect(
        facts.every(
          (fact) =>
            fact.provenance.sourceId === batch.source.id &&
            fact.provenance.sourceVersion === fixture.revision &&
            fact.provenance.sourceDigest === batch.source.digest,
        ),
      ).toBe(true);
    }
    expect(
      first.input.batches.find(
        ({ source }) => source.id === "template-instance",
      ),
    ).toMatchObject({ nodes: [], edges: [] });
    expect(serializeAppMap(first.build.map)).toBe(
      serializeAppMap(second.build.map),
    );
  });

  it("rejects symbolic revisions before reading canonical sources", async () => {
    await expect(
      composeAppMap({ repoRoot: process.cwd(), revision: "HEAD" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "APP_MAP_COMPOSITION_INVALID",
    });
  });
});
