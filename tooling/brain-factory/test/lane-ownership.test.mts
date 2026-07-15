import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  laneFileOwnershipIssues,
  laneHistoryOwnershipIssues,
} from "../src/lane-ownership.js";

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
  });
});
