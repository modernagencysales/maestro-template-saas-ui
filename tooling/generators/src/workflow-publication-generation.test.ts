import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { buildWorkflowPublicationStack } from "./workflow-publication-generation";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const generatedPaths = [
  "docs/template/generated/provenance/add-workflow/publicationFixture.json",
  "docs/template/generated/workflow-publications.json",
  "docs/template/generated/workflows/publicationFixture.md",
  "docs/template/generated/workflows/publicationFixture.semantics.json",
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.authority.ts",
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.publication.json",
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.release.ts",
  "packages/convex/confect/workflows/publicationFixture/v1.authority.ts",
  "packages/convex/confect/workflows/publicationFixture/v1.publication.json",
  "packages/convex/confect/workflows/publicationFixture/v1.release.ts",
] as const;

describe("bounded workflow publication regeneration", () => {
  it("is deterministic and keeps the canonical two-release stack clean", async () => {
    const first = await buildWorkflowPublicationStack(repoRoot);
    const second = await buildWorkflowPublicationStack(repoRoot);

    expect(first.publicationCount).toBe(2);
    expect(first.files.map(({ path }) => path)).toEqual(generatedPaths);
    expect(first.files).toEqual(second.files);
    expect(first.drift).toEqual([]);
    expect(second.drift).toEqual([]);
  });

  it("keeps published v1 bytes immutable when current source changes", async () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "workflow-published-"));
    try {
      for (const path of generatedPaths) {
        const target = resolve(fixtureRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(resolve(repoRoot, path), target);
      }
      const descriptor = JSON.parse(
        readFileSync(resolve(fixtureRoot, generatedPaths[5]), "utf8"),
      ) as { readonly sourceClosure: { readonly roots: readonly string[] } };
      const firstRoot = descriptor.sourceClosure.roots[0];
      if (firstRoot === undefined)
        throw new Error("Fixture source root missing");
      const changedSource = resolve(fixtureRoot, firstRoot);
      mkdirSync(dirname(changedSource), { recursive: true });
      writeFileSync(changedSource, "changed current generator source\n");

      const before = new Map(
        generatedPaths.map((path) => [
          path,
          readFileSync(resolve(fixtureRoot, path), "utf8"),
        ]),
      );
      const result = await buildWorkflowPublicationStack(fixtureRoot);

      expect(result.drift).toEqual([]);
      expect(result.publicationCount).toBe(2);
      expect(result.files).toEqual(
        generatedPaths.map((path) => ({ path, content: before.get(path) })),
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
