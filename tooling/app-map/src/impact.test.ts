import { describe, expect, it } from "vitest";

import { buildAppMapImpact } from "./impact";
import { readFixture } from "./test-fixtures";

const input = (changedPaths: readonly string[]) => ({
  schemaVersion: 1 as const,
  baseRevision: "1111111111111111111111111111111111111111",
  mapInput: readFixture("valid"),
  changedPaths,
});

describe("deterministic App Map impact", () => {
  it("projects direct and transitive impact from canonical provenance", () => {
    const result = buildAppMapImpact(
      input(["docs/template/data-resources.json"]),
    );

    expect(result).toEqual({
      ok: true,
      impact: {
        schemaVersion: 1,
        baseRevision: "1111111111111111111111111111111111111111",
        subjectRevision: "e9c9123",
        complete: true,
        risk: "high",
        changedPaths: ["docs/template/data-resources.json"],
        nodes: {
          direct: ["system:knowledge-brain", "table:brainPages"],
          generated: [],
          transitive: ["route:/knowledge"],
        },
        affected: {
          systems: ["system:knowledge-brain"],
          durableData: ["table:brainPages"],
          workflowVersions: [],
          providers: [],
          publicContracts: [],
          routes: ["route:/knowledge"],
          headlessSurfaces: [],
          semanticRuleIds: [],
          adrs: [],
        },
        unknownPaths: [],
        focusedGates: [
          "pnpm check:app-map",
          "pnpm check:data-resources",
          "pnpm check:system-catalog",
          "pnpm --dir apps/web test",
        ],
      },
    });
  });

  it("states unmapped paths and refuses a complete blast-radius claim", () => {
    const result = buildAppMapImpact(
      input(["docs/notes/unregistered-decision.md"]),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: {
        complete: false,
        risk: "unknown",
        nodes: { direct: [], generated: [], transitive: [] },
        unknownPaths: ["docs/notes/unregistered-decision.md"],
        focusedGates: ["pnpm check:app-map"],
      },
    });
  });

  it("is byte-stable for reordered and repeated changed paths", () => {
    const first = buildAppMapImpact(
      input([
        "apps/web/src/routeTree.gen.ts",
        "docs/template/data-resources.json",
      ]),
    );
    const second = buildAppMapImpact(
      input([
        "docs/template/data-resources.json",
        "apps/web/src/routeTree.gen.ts",
        "docs/template/data-resources.json",
      ]),
    );

    expect(first).toEqual(second);
  });

  it.each([
    [{ ...input([]), baseRevision: "origin/main" }],
    [{ ...input([]), changedPaths: ["../outside"] }],
    [{ ...input([]), extra: true }],
    [{ ...input([]), mapInput: { ...readFixture("valid"), batches: [] } }],
  ])("fails closed for invalid or incomplete input", (candidate) => {
    expect(buildAppMapImpact(candidate)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "APP_MAP_IMPACT_INVALID_INPUT" }],
    });
  });
});
