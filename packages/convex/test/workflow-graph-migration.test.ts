import * as Either from "effect/Either";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  LegacyDurableWorkflowGraph,
  decodeLegacyWorkflowGraph,
  migrateLegacyWorkflowGraph,
} from "../confect/workflows/graphMigration";

const legacyGraph = {
  id: "workflow_legacy_receipt",
  version: 1,
  startNodeId: "source",
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Legacy source",
      retry: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: "receipt",
      kind: "output",
      label: "Legacy receipt",
      retry: { maxAttempts: 3, backoffMs: 250 },
    },
  ],
  edges: [
    {
      id: "source_receipt",
      sourceNodeId: "source",
      targetNodeId: "receipt",
    },
  ],
  joins: [],
} as const;

describe("legacy durable workflow graph migration", () => {
  it("decodes the complete V1 shape behind an explicit compatibility schema", () => {
    expect(
      Schema.decodeUnknownSync(LegacyDurableWorkflowGraph)(legacyGraph),
    ).toEqual(legacyGraph);
    expect(Either.getOrThrow(decodeLegacyWorkflowGraph(legacyGraph))).toEqual(
      legacyGraph,
    );
  });

  it("adds stable V2 step addresses without enabling discarded V1 retry metadata", () => {
    expect(Either.getOrThrow(migrateLegacyWorkflowGraph(legacyGraph))).toEqual({
      schemaVersion: 2,
      id: legacyGraph.id,
      version: legacyGraph.version,
      startNodeId: legacyGraph.startNodeId,
      nodes: [
        {
          id: "source",
          kind: "source",
          label: "Legacy source",
          stepName: "source.v1",
        },
        {
          id: "receipt",
          kind: "output",
          label: "Legacy receipt",
          stepName: "receipt.v1",
        },
      ],
      edges: legacyGraph.edges,
      joins: legacyGraph.joins,
    });
  });

  it("rejects inputs that claim V2 instead of silently downgrading them", () => {
    const result = decodeLegacyWorkflowGraph({
      ...legacyGraph,
      schemaVersion: 2,
    });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.issue).toContain("cannot be decoded as legacy V1");
    }
  });
});
