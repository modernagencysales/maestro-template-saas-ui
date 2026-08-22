import { describe, expect, it } from "vitest";

import { buildBranchHygieneManifest } from "./branch-hygiene.mts";

const generatedAt = "2026-08-22T12:00:00.000Z";

describe("branch hygiene manifest", () => {
  it("keeps canonical and unmerged branches", () => {
    const manifest = buildBranchHygieneManifest({
      baseRef: "origin/main",
      canonicalBranches: ["main"],
      protectedBranches: ["main"],
      generatedAt,
      staleBefore: "2026-07-23T12:00:00.000Z",
      branches: [
        {
          name: "main",
          sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          committedAt: "2026-08-22T10:00:00.000Z",
          mergedIntoBase: true,
        },
        {
          name: "codex/current-work",
          sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          committedAt: "2026-08-21T10:00:00.000Z",
          mergedIntoBase: false,
        },
      ],
    });

    expect(manifest.branches).toEqual([
      expect.objectContaining({
        name: "codex/current-work",
        disposition: "keep",
        reasons: ["not-merged-into-base", "recent"],
      }),
      expect.objectContaining({ name: "main", disposition: "keep" }),
    ]);
  });

  it("separates stale unmerged branches for archival review", () => {
    const manifest = buildBranchHygieneManifest({
      baseRef: "origin/main",
      canonicalBranches: ["main"],
      protectedBranches: ["main"],
      generatedAt,
      staleBefore: "2026-07-23T12:00:00.000Z",
      branches: [
        {
          name: "product/superseded-work",
          sha: "ffffffffffffffffffffffffffffffffffffffff",
          committedAt: "2026-07-01T10:00:00.000Z",
          mergedIntoBase: false,
        },
      ],
    });

    expect(manifest.branches).toEqual([
      expect.objectContaining({
        name: "product/superseded-work",
        disposition: "review-archive",
        reasons: ["not-merged-into-base", "older-than-stale-threshold"],
      }),
    ]);
    expect(manifest.recoveryTags).toHaveLength(1);
    expect(manifest.deletionEnabled).toBe(false);
  });

  it("proposes review only for stale merged branches", () => {
    const manifest = buildBranchHygieneManifest({
      baseRef: "origin/main",
      canonicalBranches: ["main"],
      protectedBranches: ["main"],
      generatedAt,
      staleBefore: "2026-07-23T12:00:00.000Z",
      branches: [
        {
          name: "codex/old-work",
          sha: "cccccccccccccccccccccccccccccccccccccccc",
          committedAt: "2026-07-01T10:00:00.000Z",
          mergedIntoBase: true,
        },
        {
          name: "codex/recent-work",
          sha: "dddddddddddddddddddddddddddddddddddddddd",
          committedAt: "2026-08-20T10:00:00.000Z",
          mergedIntoBase: true,
        },
      ],
    });

    expect(manifest.branches).toEqual([
      expect.objectContaining({
        name: "codex/old-work",
        disposition: "review-delete",
        reasons: ["merged-into-base", "older-than-stale-threshold"],
      }),
      expect.objectContaining({
        name: "codex/recent-work",
        disposition: "keep",
        reasons: ["recent"],
      }),
    ]);
  });

  it("creates one recovery tag per unique candidate SHA", () => {
    const manifest = buildBranchHygieneManifest({
      baseRef: "origin/main",
      canonicalBranches: ["main"],
      protectedBranches: ["main"],
      generatedAt,
      staleBefore: "2026-07-23T12:00:00.000Z",
      branches: [
        {
          name: "archive/duplicate-a",
          sha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          committedAt: "2026-07-01T10:00:00.000Z",
          mergedIntoBase: true,
        },
        {
          name: "codex/duplicate-b",
          sha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          committedAt: "2026-07-01T10:00:00.000Z",
          mergedIntoBase: true,
        },
      ],
    });

    expect(manifest.recoveryTags).toEqual([
      {
        sha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        tag: "archive/branch-cleanup-20260822-eeeeeeeeeeee",
        branches: ["archive/duplicate-a", "codex/duplicate-b"],
      },
    ]);
    expect(manifest.deletionEnabled).toBe(false);
  });
});
