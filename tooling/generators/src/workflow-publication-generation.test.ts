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
  findCurrentPublicationMetadataDrift,
  findPublishedClosureDrift,
  PINNED_ISOLATED_PUBLICATION_AUTHORITY,
  pinnedPublicationAuthorityTestSeams,
  synchronizeReleaseAuthorityChecksums,
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

const pinnedRolesPath = "packages/convex/confect/access/roles.ts";
const pinnedRolesChecksum =
  "65b0f8bd279df7cb9157bc3249b7b17b9cbaa056797a0d0a2ef1c78778ed28a6";
const pinnedCapabilityDescriptorPath =
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.publication.json";

const metadataFixtureDrift = (
  path: string,
  current: string,
  tagged: string,
): readonly string[] => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "publication-metadata-"));
  try {
    const target = resolve(fixtureRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, current);
    return findCurrentPublicationMetadataDrift(fixtureRoot, [
      { path, content: Buffer.from(tagged) },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

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

  it("preserves ordinary worktree drift instead of masking it", () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "workflow-published-"));
    try {
      const fixtures = [
        "source.ts",
        "artifact.ts",
        "packages/convex/convex/_generated/api.js",
      ].map((path) => {
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
      writeFileSync(
        resolve(fixtureRoot, "packages/convex/convex/_generated/api.js"),
        "masked runtime projection drift\n",
      );
      expect(findPublishedClosureDrift(fixtureRoot, fixtures)).toEqual([
        "source.ts",
        "artifact.ts",
        "packages/convex/convex/_generated/api.js",
      ]);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("validates isolated published source from the pinned tag while current source evolves", async () => {
    const target = resolve(repoRoot, pinnedRolesPath);
    const currentChecksum = createHash("sha256")
      .update(readFileSync(target))
      .digest("hex");
    expect(currentChecksum).not.toBe(pinnedRolesChecksum);
    const result = await buildWorkflowPublicationStack(repoRoot);
    expect(result.drift).toEqual([]);
  });

  it("keeps immutable publication metadata byte-bound to the pinned tag", () => {
    const path = pinnedCapabilityDescriptorPath;
    const tagged = readFileSync(resolve(repoRoot, path), "utf8");
    expect(metadataFixtureDrift(path, `${tagged}\n`, tagged)).toEqual([path]);
  });

  it("compares current isolation metadata as bytes instead of authority", () => {
    const path = pinnedCapabilityDescriptorPath;
    const tagged = readFileSync(resolve(repoRoot, path), "utf8");
    const descriptor = JSON.parse(tagged) as { isolatedFixture: boolean };
    const current = `${JSON.stringify(
      { ...descriptor, isolatedFixture: false },
      null,
      2,
    )}\n`;
    expect(metadataFixtureDrift(path, current, tagged)).toEqual([path]);
  });

  it("reports malformed current metadata as byte drift", () => {
    const path = pinnedCapabilityDescriptorPath;
    const tagged = readFileSync(resolve(repoRoot, path), "utf8");
    expect(metadataFixtureDrift(path, "{", tagged)).toEqual([path]);
  });

  it("fails closed when the pinned isolated publication tag is unavailable", () => {
    expect(() =>
      pinnedPublicationAuthorityTestSeams.validateInputs(
        repoRoot,
        [{ path: pinnedRolesPath, checksum: pinnedRolesChecksum }],
        {
          ...PINNED_ISOLATED_PUBLICATION_AUTHORITY,
          tag: "maestro-template-missing-isolated-authority",
        },
      ),
    ).toThrow(/pinned isolated publication tag is unavailable/i);
  });

  it("fails closed when the pinned isolated publication tag moves", () => {
    expect(() =>
      pinnedPublicationAuthorityTestSeams.validateInputs(
        repoRoot,
        [{ path: pinnedRolesPath, checksum: pinnedRolesChecksum }],
        {
          ...PINNED_ISOLATED_PUBLICATION_AUTHORITY,
          tagObject: "0".repeat(40),
        },
      ),
    ).toThrow(/pinned isolated publication tag object mismatch/i);
  });

  it("fails closed when tagged isolated publication bytes do not match authority", () => {
    expect(() =>
      pinnedPublicationAuthorityTestSeams.validateInputs(repoRoot, [
        { path: pinnedRolesPath, checksum: "0".repeat(64) },
      ]),
    ).toThrow(
      /tagged isolated publication checksum mismatch.*confect\/access\/roles\.ts/i,
    );
  });

  it("fails closed when a tagged isolated publication blob is missing", () => {
    expect(() =>
      pinnedPublicationAuthorityTestSeams.validateInputs(repoRoot, [
        {
          path: "packages/convex/confect/missing-isolated-authority.ts",
          checksum: "0".repeat(64),
        },
      ]),
    ).toThrow(/pinned isolated publication blob is unavailable/i);
  });

  it("fails closed when a tagged publication descriptor is malformed", () => {
    expect(() =>
      pinnedPublicationAuthorityTestSeams.assertDescriptor(
        repoRoot,
        null,
        pinnedCapabilityDescriptorPath,
      ),
    ).toThrow(/pinned publication descriptor is malformed/i);
  });

  it("fails closed when tagged publication authority is not isolated", () => {
    const descriptor = JSON.parse(
      readFileSync(resolve(repoRoot, pinnedCapabilityDescriptorPath), "utf8"),
    ) as Record<string, unknown>;
    expect(() =>
      pinnedPublicationAuthorityTestSeams.assertDescriptor(
        repoRoot,
        { ...descriptor, isolatedFixture: false },
        pinnedCapabilityDescriptorPath,
      ),
    ).toThrow(/not a complete published isolated fixture/i);
  });

  it("repairs release checksums from authority after an interrupted regeneration", () => {
    const stale = `export const release = {
  sourceClosureChecksum:
    "${"1".repeat(64)}",
  capabilityBindings: [{ releaseChecksum: dependency.releaseChecksum }],
  releaseChecksum:
    "${"2".repeat(64)}",
};\n`;
    const repaired = synchronizeReleaseAuthorityChecksums(stale, {
      sourceClosure: {
        roots: [],
        modules: [],
        checksum: "a".repeat(64),
      },
      fingerprint: { releaseChecksum: "b".repeat(64) },
    });
    expect(repaired).toContain(`"${"a".repeat(64)}"`);
    expect(repaired).toContain(`"${"b".repeat(64)}"`);
    expect(repaired).toContain(
      "capabilityBindings: [{ releaseChecksum: dependency.releaseChecksum }]",
    );
  });

  it("keeps mutable generated schema and HTTP projections outside the published closure", async () => {
    const paths = [
      "packages/convex/confect/_generated/schema.ts",
      "packages/convex/convex/_generated/api.d.ts",
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

  it("keeps current policy resolution outside the immutable published closure", async () => {
    const path =
      "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts";
    const target = resolve(repoRoot, path);
    const original = readFileSync(target, "utf8");
    try {
      writeFileSync(target, `${original}\n// current policy evolution\n`);
      const result = await buildWorkflowPublicationStack(repoRoot);
      expect(result.drift).toEqual([]);
    } finally {
      writeFileSync(target, original);
    }
  });
});
