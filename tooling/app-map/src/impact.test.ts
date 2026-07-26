import { describe, expect, it } from "vitest";

import { buildAppMapImpact } from "./impact";
import type { AppMapBuildInputV1, AppMapEdgeV1, AppMapNodeV1 } from "./schema";
import { readFixture } from "./test-fixtures";

const input = (
  changedPaths: readonly string[],
  mapInput: AppMapBuildInputV1 = readFixture("valid"),
) => ({
  schemaVersion: 1 as const,
  baseRevision: "1111111111111111111111111111111111111111",
  mapInput,
  changedPaths,
});

const withFacts = (
  sourceId: string,
  nodes: readonly Omit<AppMapNodeV1, "provenance">[],
  edges: readonly Omit<AppMapEdgeV1, "provenance">[],
  fixture: AppMapBuildInputV1 = readFixture("valid"),
): AppMapBuildInputV1 => {
  const source = fixture.batches.find((batch) => batch.source.id === sourceId);
  if (source === undefined) throw new Error(`Missing source ${sourceId}.`);
  const provenance = (factId: string) => ({
    authority: "canonical" as const,
    sourceId: source.source.id,
    sourcePath: source.source.path,
    sourceVersion: source.source.version,
    sourceDigest: source.source.digest,
    factId,
  });
  return {
    ...fixture,
    batches: fixture.batches.map((batch) =>
      batch.source.id === sourceId
        ? {
            ...batch,
            nodes: [
              ...batch.nodes,
              ...nodes.map((node) => ({
                ...node,
                provenance: provenance(`test/nodes/${node.id}`),
              })),
            ],
            edges: [
              ...batch.edges,
              ...edges.map((edge) => ({
                ...edge,
                provenance: provenance(`test/edges/${edge.id}`),
              })),
            ],
          }
        : batch,
    ),
  };
};

describe("deterministic App Map impact", () => {
  it("projects schema impact from canonical provenance", () => {
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

  it("computes cycle-safe multi-hop ownership closure for route changes", () => {
    const mapInput = withFacts(
      "product-topology",
      [],
      [
        {
          id: "depends-on:table:brainPages->route:/knowledge",
          kind: "depends-on",
          from: "table:brainPages",
          to: "route:/knowledge",
        },
      ],
    );
    const result = buildAppMapImpact(
      input(["apps/web/src/routeTree.gen.ts"], mapInput),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: {
        nodes: {
          direct: ["route:/knowledge"],
          generated: [],
          transitive: ["system:knowledge-brain", "table:brainPages"],
        },
        affected: {
          systems: ["system:knowledge-brain"],
          durableData: ["table:brainPages"],
          routes: ["route:/knowledge"],
          workflowVersions: [],
        },
      },
    });
  });

  it("reports workflow-registry edge facts as direct impact", () => {
    const result = buildAppMapImpact(
      input([
        "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
      ]),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: {
        affected: {
          workflowVersions: ["workflow:source-grounded-brief@1"],
          durableData: ["table:brainPages"],
        },
      },
    });
  });

  it("reports capability impact from the generated contract manifest", () => {
    const capabilityInput = withFacts(
      "confect-contracts",
      [
        {
          id: "capability:knowledge.search",
          kind: "capability",
          group: "Automations",
          label: "Knowledge search",
          version: "1",
        },
      ],
      [],
    );
    const mapInput = withFacts(
      "product-topology",
      [],
      [
        {
          id: "owns:system:knowledge-brain->capability:knowledge.search",
          kind: "owns",
          from: "system:knowledge-brain",
          to: "capability:knowledge.search",
        },
      ],
      capabilityInput,
    );
    const result = buildAppMapImpact(
      input(
        ["packages/template-core/src/generated/confectManifest.ts"],
        mapInput,
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: {
        affected: { publicContracts: ["capability:knowledge.search"] },
        focusedGates: [
          "pnpm check:app-map",
          "pnpm check:data-resources",
          "pnpm check:system-catalog",
          "pnpm --dir apps/web test",
          "pnpm check:headless-surface-contract",
        ],
      },
    });
  });

  it("keeps generated provenance distinct from transitive impact", () => {
    const mapInput = withFacts(
      "generator-provenance",
      [],
      [
        {
          id: "generated-by:route:/knowledge->workflow:source-grounded-brief@1",
          kind: "generated-by",
          from: "route:/knowledge",
          to: "workflow:source-grounded-brief@1",
        },
      ],
    );
    const result = buildAppMapImpact(
      input(["apps/web/src/routeTree.gen.ts"], mapInput),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: {
        nodes: {
          direct: ["route:/knowledge"],
          generated: ["workflow:source-grounded-brief@1"],
        },
      },
    });
  });

  it("reports provider impact from product topology", () => {
    const mapInput = withFacts(
      "product-topology",
      [
        {
          id: "provider:search",
          kind: "provider",
          group: "Connections",
          label: "Search provider",
          version: "1",
        },
      ],
      [
        {
          id: "owns:system:access-and-tenancy->provider:search",
          kind: "owns",
          from: "system:access-and-tenancy",
          to: "provider:search",
        },
      ],
    );
    const result = buildAppMapImpact(
      input(["docs/template/product-topology.json"], mapInput),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: { affected: { providers: ["provider:search"] } },
    });
  });

  it("does not traverse invokes, projects, or persists edges", () => {
    const productInput = withFacts(
      "product-topology",
      [
        {
          id: "capability:isolated",
          kind: "capability",
          group: "Automations",
          label: "Isolated capability",
          version: "1",
        },
        {
          id: "provider:isolated",
          kind: "provider",
          group: "Connections",
          label: "Isolated provider",
          version: "1",
        },
      ],
      [
        {
          id: "owns:system:workflow-runtime->capability:isolated",
          kind: "owns",
          from: "system:workflow-runtime",
          to: "capability:isolated",
        },
        {
          id: "invokes:route:/knowledge->capability:isolated",
          kind: "invokes",
          from: "route:/knowledge",
          to: "capability:isolated",
        },
        {
          id: "owns:system:access-and-tenancy->provider:isolated",
          kind: "owns",
          from: "system:access-and-tenancy",
          to: "provider:isolated",
        },
        {
          id: "projects:route:/knowledge->provider:isolated",
          kind: "projects",
          from: "route:/knowledge",
          to: "provider:isolated",
        },
      ],
    );
    const mapInput = withFacts(
      "workflow-registry",
      [],
      [
        {
          id: "persists:route:/knowledge->workflow:source-grounded-brief@1",
          kind: "persists",
          from: "route:/knowledge",
          to: "workflow:source-grounded-brief@1",
        },
      ],
      productInput,
    );
    const result = buildAppMapImpact(
      input(["apps/web/src/routeTree.gen.ts"], mapInput),
    );

    expect(result).toMatchObject({
      ok: true,
      impact: {
        affected: {
          providers: [],
          publicContracts: [],
          workflowVersions: [],
        },
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

  it("treats docs-only paths outside the closed manifest as explicit unknowns", () => {
    expect(
      buildAppMapImpact(input(["docs/template/app-factory-guide.md"])),
    ).toMatchObject({
      ok: true,
      impact: {
        complete: false,
        risk: "unknown",
        unknownPaths: ["docs/template/app-factory-guide.md"],
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

  it.each(["1".repeat(40), "a".repeat(64)])(
    "accepts an exact lowercase Git revision",
    (baseRevision) => {
      expect(buildAppMapImpact({ ...input([]), baseRevision })).toMatchObject({
        ok: true,
        impact: { baseRevision },
      });
    },
  );

  it.each([
    [{ ...input([]), baseRevision: "origin/main" }],
    [{ ...input([]), baseRevision: "1".repeat(7) }],
    [{ ...input([]), baseRevision: "1".repeat(39) }],
    [{ ...input([]), baseRevision: "1".repeat(41) }],
    [{ ...input([]), baseRevision: "1".repeat(63) }],
    [{ ...input([]), baseRevision: "A".repeat(40) }],
    [{ ...input([]), baseRevision: `${"1".repeat(39)}z` }],
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
