import { describe, expect, it, vi } from "vitest";

import { parseGitNameStatus, readGitChangedPaths } from "./gitDiff";

describe("explicit-base Git diff", () => {
  it("parses additions, modifications, deletions, and both sides of moves", () => {
    expect(
      parseGitNameStatus(
        "M\0apps/web/src/a.ts\0A\0new.ts\0D\0old.ts\0R100\0before.ts\0after.ts\0",
      ),
    ).toEqual({
      ok: true,
      changedPaths: [
        "after.ts",
        "apps/web/src/a.ts",
        "before.ts",
        "new.ts",
        "old.ts",
      ],
    });
  });

  it.each([
    ["U\0conflicted.ts\0"],
    ["M\0../outside\0"],
    ["R100\0only-one-path\0"],
    ["M\0unterminated"],
  ])("fails closed for unsafe or malformed name-status output", (output) => {
    expect(parseGitNameStatus(output)).toMatchObject({
      ok: false,
      diagnostic: { code: "APP_MAP_GIT_DIFF_INVALID" },
    });
  });

  it("runs a three-dot diff only with explicit reviewed revisions", async () => {
    const run = vi.fn(async () => ({
      stdout: "M\0docs/template/data-resources.json\0",
    }));
    const result = await readGitChangedPaths(
      {
        repoRoot: "/fixture/repo",
        baseRevision: "1111111111111111111111111111111111111111",
        headRevision: "2222222222222222222222222222222222222222",
      },
      run,
    );

    expect(result).toEqual({
      ok: true,
      baseRevision: "1111111111111111111111111111111111111111",
      headRevision: "2222222222222222222222222222222222222222",
      changedPaths: ["docs/template/data-resources.json"],
    });
    expect(run).toHaveBeenCalledWith(
      "git",
      [
        "diff",
        "--name-status",
        "-z",
        "--find-renames",
        "1111111111111111111111111111111111111111...2222222222222222222222222222222222222222",
        "--",
      ],
      { cwd: "/fixture/repo", maxBuffer: 16 * 1024 * 1024 },
    );
  });

  it.each([
    [{ repoRoot: "/fixture", headRevision: "2".repeat(40) }],
    [
      {
        repoRoot: "/fixture",
        baseRevision: "origin/main",
        headRevision: "2".repeat(40),
      },
    ],
  ])("rejects an absent or ambiguous comparison base", async (candidate) => {
    const run = vi.fn();
    expect(await readGitChangedPaths(candidate, run)).toMatchObject({
      ok: false,
      diagnostic: { code: "APP_MAP_GIT_DIFF_BASE_REQUIRED" },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("redacts Git runner failures", async () => {
    const run = vi.fn(async () => {
      throw new Error("secret remote URL");
    });
    const result = await readGitChangedPaths(
      {
        repoRoot: "/fixture",
        baseRevision: "1".repeat(40),
        headRevision: "2".repeat(40),
      },
      run,
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: "APP_MAP_GIT_DIFF_UNAVAILABLE" },
    });
    expect(JSON.stringify(result)).not.toContain("secret remote URL");
  });
});
