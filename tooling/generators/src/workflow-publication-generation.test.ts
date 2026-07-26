import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildWorkflowPublicationStack,
  findPublishedClosureDrift,
} from "./workflow-publication-generation";

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

  it("reports published source and artifact drift instead of masking it", () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "workflow-published-"));
    try {
      const fixtures = ["source.ts", "artifact.ts"].map((path) => {
        const target = resolve(fixtureRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, `published ${path}\n`);
        return {
          path,
          checksum: createHash("sha256")
            .update(readFileSync(target))
            .digest("hex"),
        };
      });
      expect(findPublishedClosureDrift(fixtureRoot, fixtures)).toEqual([]);
      writeFileSync(resolve(fixtureRoot, "source.ts"), "masked source drift\n");
      writeFileSync(
        resolve(fixtureRoot, "artifact.ts"),
        "masked artifact drift\n",
      );
      expect(findPublishedClosureDrift(fixtureRoot, fixtures)).toEqual([
        "source.ts",
        "artifact.ts",
      ]);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("keeps mutable generated schema and HTTP projections outside the published closure", async () => {
    const paths = [
      "packages/convex/confect/_generated/schema.ts",
      "packages/convex/confect/http.ts",
    ] as const;
    const originals = new Map(
      paths.map((path) => [
        path,
        readFileSync(resolve(repoRoot, path), "utf8"),
      ]),
    );
    try {
      for (const path of paths) {
        writeFileSync(
          resolve(repoRoot, path),
          `${originals.get(path)}\n// unrelated generated projection change\n`,
        );
      }
      const result = await buildWorkflowPublicationStack(repoRoot);
      expect(result.drift).toEqual([]);
    } finally {
      for (const [path, source] of originals) {
        writeFileSync(resolve(repoRoot, path), source);
      }
    }
  });
});
