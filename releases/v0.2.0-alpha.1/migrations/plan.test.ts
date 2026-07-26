import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planReviewedReleaseMigration } from "./plan.js";

const manifest = (): unknown =>
  JSON.parse(
    readFileSync(new URL("./manifest.json", import.meta.url), "utf8"),
  ) as unknown;

const candidate = () => ({
  schemaVersion: 1,
  manifest: manifest(),
  origin: {
    version: "0.1.0-alpha.1",
    relation: "immediate-prior",
    releaseManifestHash:
      "sha256:0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93",
  },
  completedMigrationFingerprints: [],
});

const codes = (input: unknown): readonly string[] => {
  const result = planReviewedReleaseMigration(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("reviewed v0.1 to v0.2 release migration", () => {
  it("produces one deterministic inert plan without mutating input", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const first = planReviewedReleaseMigration(input);
    const reordered = planReviewedReleaseMigration({
      completedMigrationFingerprints: [],
      origin: { ...input.origin },
      manifest: input.manifest,
      schemaVersion: 1,
    });

    expect(first).toEqual(reordered);
    expect(first).toMatchObject({
      ok: true,
      mode: "plan-only",
      executionAvailable: false,
      status: "planned",
      transitionId: "template-0.1-to-0.2",
      fromVersion: "0.1.0-alpha.1",
      toVersion: "0.2.0-alpha.1",
      migrationFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      reviewedHashes: {
        fromReleaseManifest:
          "sha256:0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93",
        toReleaseManifest:
          "sha256:532c0da941bce540648b38c4fb868a35b7f37ff9d2623ff5778cd922866168f6",
      },
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("is idempotent for the exact completed migration fingerprint", () => {
    const first = planReviewedReleaseMigration(candidate());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      planReviewedReleaseMigration({
        ...candidate(),
        completedMigrationFingerprints: [first.migrationFingerprint],
      }),
    ).toMatchObject({
      ok: true,
      status: "already-applied",
      migrationFingerprint: first.migrationFingerprint,
      executionAvailable: false,
    });
  });

  it("rejects tampered reviewed hashes", () => {
    const input = candidate();
    const reviewed = input.manifest as {
      releaseManifests: { from: { sha256: string } };
    };
    reviewed.releaseManifests.from.sha256 = `sha256:${"9".repeat(64)}`;
    const before = JSON.stringify(input);
    expect(codes(input)).toEqual(["RELEASE_MIGRATION_REVIEW_MISMATCH"]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(["unknown", "older", "skipped", "newer"] as const)(
    "fails closed for unsupported %s origins",
    (relation) => {
      const input = candidate();
      expect(
        codes({ ...input, origin: { ...input.origin, relation } }),
      ).toEqual(["RELEASE_MIGRATION_ORIGIN_UNSUPPORTED"]);
    },
  );

  it("fails closed for a non-prior version or unreviewed completion", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        origin: { ...input.origin, version: "0.1.0-alpha.other" },
      }),
    ).toEqual(["RELEASE_MIGRATION_ORIGIN_UNSUPPORTED"]);
    expect(
      codes({
        ...input,
        completedMigrationFingerprints: [`sha256:${"8".repeat(64)}`],
      }),
    ).toEqual(["RELEASE_MIGRATION_COMPLETION_UNREVIEWED"]);
  });

  it("uses a closed contract", () => {
    expect(codes({ ...candidate(), write: true })).toEqual([
      "RELEASE_MIGRATION_INPUT_INVALID",
    ]);
  });
});
