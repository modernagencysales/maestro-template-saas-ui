import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  laneFileOwnershipIssues,
  laneHistoryShapeIssues,
  laneHistoryOwnershipIssues,
} from "../src/lane-ownership.js";
import { changedHandAuthoredSourceLines } from "../src/source-budget.js";

const git = (cwd: string, ...args: string[]): string => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
};

describe("lane file ownership", () => {
  it("accepts only exact manifest file locks", () => {
    expect(
      laneFileOwnershipIssues(
        [
          "docs/task.md",
          "packages/convex/confect/internal/example.ts",
          "packages/convex/convex/auth.config.ts",
          "packages/convex/convex/http.ts",
        ],
        [
          "@environment",
          "docs/task.md",
          "packages/convex/confect/internal/example.ts",
          "packages/convex/convex/auth.config.ts",
          "packages/convex/convex/http.ts",
        ],
      ),
    ).toEqual([]);
  });

  it("rejects undeclared and generated lane changes", () => {
    expect(
      laneFileOwnershipIssues(
        [
          "packages/convex/confect/_generated/schema.ts",
          "packages/convex/convex/internal/example.ts",
          "packages/template-core/src/generated/confectManifest.ts",
          "apps/web/src/routeTree.gen.ts",
          "tooling/quality/undeclared.mts",
        ],
        [
          "packages/convex/confect/internal/example.ts",
          "packages/convex/confect/_generated/schema.ts",
          "packages/template-core/src/generated/confectManifest.ts",
          "apps/web/src/routeTree.gen.ts",
        ],
      ),
    ).toEqual([
      "packages/convex/confect/_generated/schema.ts: generated output is integration-owned",
      "packages/convex/convex/internal/example.ts: generated output is integration-owned",
      "packages/template-core/src/generated/confectManifest.ts: generated output is integration-owned",
      "apps/web/src/routeTree.gen.ts: generated output is integration-owned",
      "tooling/quality/undeclared.mts: not declared in manifest fileLocks",
    ]);
  });

  it("rejects paths laundered through excluded history", () => {
    expect(
      laneHistoryOwnershipIssues(
        [
          {
            commit: "add-under-excluded-test-path",
            files: ["tooling/brain-factory/test/__slice__/payload.ts"],
          },
          {
            commit: "rename-into-owned-source",
            files: [
              "tooling/brain-factory/test/__slice__/payload.ts",
              "tooling/brain-factory/src/payload.ts",
            ],
          },
        ],
        ["tooling/brain-factory/src/payload.ts"],
      ),
    ).toEqual([
      "add-under-excluded-test-path: tooling/brain-factory/test/__slice__/payload.ts: not declared in manifest fileLocks",
      "rename-into-owned-source: tooling/brain-factory/test/__slice__/payload.ts: not declared in manifest fileLocks",
    ]);
  });

  it("inspects historical paths and budgets without rename collapsing", () => {
    const laneGates = readFileSync(
      resolve(import.meta.dirname, "../src/lane-gates.mts"),
      "utf8",
    );
    expect(laneGates).toMatch(
      /"diff-tree",[\s\S]*?"--root",[\s\S]*?"--no-commit-id",[\s\S]*?"--name-only",[\s\S]*?"-r",[\s\S]*?"--no-renames",[\s\S]*?commit/,
    );
    expect(laneGates).toMatch(
      /"show",[\s\S]*?"--no-renames",[\s\S]*?"--numstat",[\s\S]*?"--format=",[\s\S]*?commit/,
    );
    expect(laneGates).toContain("laneHistoryOwnershipIssues(");
    expect(laneGates).toContain("laneHistoryShapeIssues(");
  });

  it("proves excluded renames and merge commits against real Git history", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-lane-history-"));
    try {
      git(root, "init", "-q");
      git(root, "config", "user.email", "lane-history@example.test");
      git(root, "config", "user.name", "Lane History Test");
      writeFileSync(resolve(root, "README.md"), "base\n");
      git(root, "add", "README.md");
      git(root, "commit", "-qm", "base");
      const base = git(root, "rev-parse", "HEAD");
      const defaultBranch = git(root, "branch", "--show-current");

      mkdirSync(resolve(root, "tooling/brain-factory/test/__slice__"), {
        recursive: true,
      });
      writeFileSync(
        resolve(root, "tooling/brain-factory/test/__slice__/payload.ts"),
        `${"export const line = 1;\n".repeat(350)}`,
      );
      git(root, "add", ".");
      git(root, "commit", "-qm", "add excluded payload");
      const addCommit = git(root, "rev-parse", "HEAD");
      mkdirSync(resolve(root, "tooling/brain-factory/src"), {
        recursive: true,
      });
      git(
        root,
        "mv",
        "tooling/brain-factory/test/__slice__/payload.ts",
        "tooling/brain-factory/src/payload.ts",
      );
      git(root, "commit", "-qm", "rename payload into source");
      const renameCommit = git(root, "rev-parse", "HEAD");
      const renamePaths = git(
        root,
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--name-only",
        "-r",
        "--no-renames",
        renameCommit,
      ).split("\n");
      expect(
        laneHistoryOwnershipIssues(
          [{ commit: addCommit, files: renamePaths }],
          ["tooling/brain-factory/src/payload.ts"],
        ),
      ).toContain(
        `${addCommit}: tooling/brain-factory/test/__slice__/payload.ts: not declared in manifest fileLocks`,
      );
      expect(
        changedHandAuthoredSourceLines(
          git(
            root,
            "show",
            "--no-renames",
            "--numstat",
            "--format=",
            renameCommit,
          ),
        ),
      ).toBe(350);

      git(root, "branch", "feature", base);
      git(root, "switch", "-q", "feature");
      writeFileSync(resolve(root, "feature.txt"), "feature\n");
      git(root, "add", "feature.txt");
      git(root, "commit", "-qm", "feature");
      git(root, "switch", "-q", defaultBranch);
      writeFileSync(resolve(root, "main.txt"), "main\n");
      git(root, "add", "main.txt");
      git(root, "commit", "-qm", "main");
      git(root, "merge", "--no-ff", "--no-commit", "feature");
      writeFileSync(resolve(root, "merge-only.txt"), "merge resolution\n");
      git(root, "add", ".");
      git(root, "commit", "-qm", "merge feature");
      const mergeCommit = git(root, "rev-parse", "HEAD");
      const parents = git(root, "rev-list", "--parents", "-n", "1", mergeCommit)
        .split(/\s+/)
        .slice(1);
      expect(
        laneHistoryShapeIssues([
          { commit: mergeCommit, parentCount: parents.length },
        ]),
      ).toEqual([`${mergeCommit}: task slice commits must be linear`]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
