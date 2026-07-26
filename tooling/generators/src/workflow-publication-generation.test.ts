import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
});
