import { describe, expect, it } from "vitest";

import { buildAppMap } from "./build";
import type {
  AppMapBuildInputV1,
  AppMapDiagnosticCode,
  AppMapEdgeV1,
  AppMapFactBatchV1,
} from "./schema";
import { readFixture } from "./test-fixtures";

const expectedFailures: readonly [string, AppMapDiagnosticCode][] = [
  ["dangling", "APP_MAP_DANGLING_EDGE"],
  ["unowned", "APP_MAP_UNOWNED_NODE"],
  ["parallel-authority", "APP_MAP_PARALLEL_AUTHORITY"],
  ["stale", "APP_MAP_STALE_FACT"],
];

const expectFailure = (input: unknown, code: string, factId?: string): void => {
  const result = buildAppMap(input);

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      ...(factId === undefined ? {} : { factId }),
      rerun: "pnpm check:app-map",
    }),
  );
  expect(result.diagnostics.every((entry) => entry.repair.length > 20)).toBe(
    true,
  );
};

const batchFor = (
  input: AppMapBuildInputV1,
  sourceId: string,
): AppMapFactBatchV1 => {
  const batch = input.batches.find((entry) => entry.source.id === sourceId);
  expect(batch).toBeDefined();
  if (!batch) throw new Error(`Missing test batch ${sourceId}.`);
  return batch;
};

const rebindEdge = (
  edge: AppMapEdgeV1,
  batch: AppMapFactBatchV1,
  id: string,
  factId: string,
): AppMapEdgeV1 => ({
  ...edge,
  id,
  provenance: {
    authority: "canonical",
    sourceId: batch.source.id,
    sourcePath: batch.source.path,
    sourceVersion: batch.source.version,
    sourceDigest: batch.source.digest,
    factId,
  },
});

describe("App Map validation", () => {
  it.each(expectedFailures)(
    "fails closed for the %s fixture with an actionable diagnostic",
    (fixture, code) => {
      const result = buildAppMap(readFixture(fixture));

      expect(result.ok).toBe(false);
      if (result.ok) return;

      const diagnostic = result.diagnostics.find(
        (candidate) => candidate.code === code,
      );
      expect(diagnostic).toMatchObject({
        code,
        rerun: "pnpm check:app-map",
      });
      expect(diagnostic?.factId.length).toBeGreaterThan(0);
      expect(diagnostic?.repair.length).toBeGreaterThan(20);
    },
  );

  it("rejects a node whose canonical provenance is absent", () => {
    const input = readFixture("valid");
    const firstBatch = input.batches[0];
    const firstNode = firstBatch?.nodes[0];
    expect(firstBatch).toBeDefined();
    expect(firstNode).toBeDefined();
    if (!firstBatch || !firstNode) return;

    const invalid = {
      ...input,
      batches: [
        {
          ...firstBatch,
          nodes: [{ ...firstNode, provenance: undefined }],
        },
        ...input.batches.slice(1),
      ],
    } as unknown as AppMapBuildInputV1;
    const result = buildAppMap(invalid);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "APP_MAP_INVALID_FACT",
        factId: "system:access-and-tenancy",
        rerun: "pnpm check:app-map",
      }),
    );
  });

  it("rejects an empty canonical inventory", () => {
    const input = readFixture("valid");
    expectFailure(
      { ...input, batches: [] },
      "APP_MAP_INVALID_FACT",
      "source:system-catalog",
    );
  });

  it("rejects each missing mandatory authority", () => {
    const input = readFixture("valid");
    const missing = input.batches[0];
    expect(missing).toBeDefined();
    if (!missing) return;

    expectFailure(
      {
        ...input,
        batches: input.batches.filter(
          (batch) => batch.source.id !== missing.source.id,
        ),
      },
      "APP_MAP_INVALID_FACT",
      `source:${missing.source.id}`,
    );
  });

  it("rejects duplicate mandatory adapter/source authority", () => {
    const input = readFixture("valid");
    const duplicate = input.batches[0];
    expect(duplicate).toBeDefined();
    if (!duplicate) return;

    expectFailure(
      { ...input, batches: [...input.batches, duplicate] },
      "APP_MAP_PARALLEL_AUTHORITY",
      duplicate.source.id,
    );
  });

  it("rejects an unknown source ID with self-consistent provenance", () => {
    const input = readFixture("valid");
    const original = input.batches[0];
    expect(original).toBeDefined();
    if (!original) return;

    const unknown = {
      ...original,
      adapterId: "attacker-facts",
      source: { ...original.source, id: "attacker-source" },
      nodes: original.nodes.map((node) => ({
        ...node,
        provenance: { ...node.provenance, sourceId: "attacker-source" },
      })),
      edges: original.edges.map((edge) => ({
        ...edge,
        provenance: { ...edge.provenance, sourceId: "attacker-source" },
      })),
    };
    expectFailure(
      { ...input, batches: [...input.batches.slice(1), unknown] },
      "APP_MAP_INVALID_FACT",
      "source:attacker-source",
    );
  });

  it("rejects an unknown adapter ID for a known source", () => {
    const input = readFixture("valid");
    const original = batchFor(input, "system-catalog");
    const changed = { ...original, adapterId: "attacker-facts" };

    expectFailure(
      {
        ...input,
        batches: input.batches.map((batch) =>
          batch.source.id === original.source.id ? changed : batch,
        ),
      },
      "APP_MAP_INVALID_FACT",
      "source:system-catalog",
    );
  });

  it("rejects a self-consistent attacker-renamed canonical path", () => {
    const input = readFixture("valid");
    const original = batchFor(input, "product-topology");
    const renamedPath = "attacker/product-topology.json";
    const renamed = {
      ...original,
      source: { ...original.source, path: renamedPath },
      nodes: original.nodes.map((node) => ({
        ...node,
        provenance: { ...node.provenance, sourcePath: renamedPath },
      })),
      edges: original.edges.map((edge) => ({
        ...edge,
        provenance: { ...edge.provenance, sourcePath: renamedPath },
      })),
    };

    expectFailure(
      {
        ...input,
        batches: input.batches.map((batch) =>
          batch.source.id === original.source.id ? renamed : batch,
        ),
      },
      "APP_MAP_INVALID_FACT",
      "source:product-topology",
    );
  });

  it.each([
    [
      "adapter",
      (batch: AppMapFactBatchV1) => ({
        ...batch,
        adapterId: "route-tree-facts",
      }),
    ],
    [
      "adapter version",
      (batch: AppMapFactBatchV1) => ({ ...batch, adapterVersion: 2 }),
    ],
    [
      "source kind",
      (batch: AppMapFactBatchV1) => ({
        ...batch,
        source: { ...batch.source, kind: "product-topology" },
      }),
    ],
    [
      "source subject",
      (batch: AppMapFactBatchV1) => ({
        ...batch,
        source: { ...batch.source, subject: "attacker-subject" },
      }),
    ],
    [
      "source owner",
      (batch: AppMapFactBatchV1) => ({
        ...batch,
        source: { ...batch.source, owner: "attacker-owner" },
      }),
    ],
    [
      "source digest contract",
      (batch: AppMapFactBatchV1) => ({
        ...batch,
        source: {
          ...batch.source,
          digestContract: "sha256-canonical-tree-v1",
        },
      }),
    ],
  ] as const)("rejects an inconsistent %s descriptor", (_label, mutate) => {
    const input = readFixture("valid");
    const original = batchFor(input, "system-catalog");
    const changed = mutate(original);

    expectFailure(
      {
        ...input,
        batches: input.batches.map((batch) =>
          batch.source.id === original.source.id ? changed : batch,
        ),
      },
      "APP_MAP_INVALID_FACT",
      "source:system-catalog",
    );
  });

  it("rejects duplicate semantic relations with different IDs", () => {
    const input = readFixture("valid");
    const original = batchFor(input, "product-topology");
    const edge = original.edges[0];
    expect(edge).toBeDefined();
    if (!edge) return;
    const duplicate = rebindEdge(
      edge,
      original,
      `${edge.id}:duplicate`,
      `${edge.provenance.factId}/duplicate`,
    );

    expectFailure(
      {
        ...input,
        batches: input.batches.map((batch) =>
          batch.source.id === original.source.id
            ? { ...batch, edges: [...batch.edges, duplicate] }
            : batch,
        ),
      },
      "APP_MAP_PARALLEL_AUTHORITY",
      `relation:${edge.kind}:${edge.from}->${edge.to}`,
    );
  });

  it("rejects the same semantic relation from parallel authorities", () => {
    const input = readFixture("valid");
    const original = batchFor(input, "product-topology");
    const parallel = batchFor(input, "workflow-registry");
    const edge = original.edges[0];
    expect(edge).toBeDefined();
    if (!edge) return;
    const duplicate = rebindEdge(
      edge,
      parallel,
      `${edge.id}:parallel`,
      "workflows/parallel-ownership",
    );

    expectFailure(
      {
        ...input,
        batches: input.batches.map((batch) =>
          batch.source.id === parallel.source.id
            ? { ...batch, edges: [...batch.edges, duplicate] }
            : batch,
        ),
      },
      "APP_MAP_PARALLEL_AUTHORITY",
      `relation:${edge.kind}:${edge.from}->${edge.to}`,
    );
  });

  it("rejects topology facts outside a source's manifest scope", () => {
    const input = readFixture("valid");
    const routeTree = batchFor(input, "route-tree");
    const instance = batchFor(input, "template-instance");
    const route = routeTree.nodes.find((node) => node.kind === "route");
    expect(route).toBeDefined();
    if (!route) return;

    const unauthorized = {
      ...route,
      id: "route:/attacker",
      provenance: {
        authority: "canonical" as const,
        sourceId: instance.source.id,
        sourcePath: instance.source.path,
        sourceVersion: instance.source.version,
        sourceDigest: instance.source.digest,
        factId: "routes/attacker",
      },
    };
    expectFailure(
      {
        ...input,
        batches: input.batches.map((batch) =>
          batch.source.id === instance.source.id
            ? { ...batch, nodes: [unauthorized] }
            : batch,
        ),
      },
      "APP_MAP_INVALID_FACT",
      "routes/attacker",
    );
  });

  it.each([
    ["input", (input: AppMapBuildInputV1) => ({ ...input, emittedAt: "now" })],
    [
      "input manifest",
      (input: AppMapBuildInputV1) => ({
        ...input,
        inputManifest: { ...input.inputManifest, emittedAt: "now" },
      }),
    ],
    [
      "subject",
      (input: AppMapBuildInputV1) => ({
        ...input,
        subject: { ...input.subject, emittedAt: "now" },
      }),
    ],
    [
      "batch",
      (input: AppMapBuildInputV1) => ({
        ...input,
        batches: [
          { ...input.batches[0], emittedAt: "now" },
          ...input.batches.slice(1),
        ],
      }),
    ],
    [
      "source",
      (input: AppMapBuildInputV1) => ({
        ...input,
        batches: [
          {
            ...input.batches[0],
            source: { ...input.batches[0]?.source, emittedAt: "now" },
          },
          ...input.batches.slice(1),
        ],
      }),
    ],
    [
      "node",
      (input: AppMapBuildInputV1) => {
        const batch = batchFor(input, "system-catalog");
        return {
          ...input,
          batches: input.batches.map((entry) =>
            entry.source.id === batch.source.id
              ? {
                  ...entry,
                  nodes: [
                    { ...entry.nodes[0], emittedAt: "now" },
                    ...entry.nodes.slice(1),
                  ],
                }
              : entry,
          ),
        };
      },
    ],
    [
      "edge",
      (input: AppMapBuildInputV1) => {
        const batch = batchFor(input, "product-topology");
        return {
          ...input,
          batches: input.batches.map((entry) =>
            entry.source.id === batch.source.id
              ? {
                  ...entry,
                  edges: [
                    { ...entry.edges[0], emittedAt: "now" },
                    ...entry.edges.slice(1),
                  ],
                }
              : entry,
          ),
        };
      },
    ],
    [
      "provenance",
      (input: AppMapBuildInputV1) => {
        const batch = batchFor(input, "system-catalog");
        return {
          ...input,
          batches: input.batches.map((entry) =>
            entry.source.id === batch.source.id
              ? {
                  ...entry,
                  nodes: [
                    {
                      ...entry.nodes[0],
                      provenance: {
                        ...entry.nodes[0]?.provenance,
                        emittedAt: "now",
                      },
                    },
                    ...entry.nodes.slice(1),
                  ],
                }
              : entry,
          ),
        };
      },
    ],
  ] as const)("rejects unknown fields on the %s object", (_label, mutate) => {
    expectFailure(mutate(readFixture("valid")), "APP_MAP_INVALID_FACT");
  });
});
