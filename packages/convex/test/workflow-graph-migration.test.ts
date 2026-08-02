import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  LegacyDurableWorkflowGraph,
  decodeLegacyWorkflowGraph,
  migrateLegacyWorkflowGraph,
} from "../confect/workflows/graphMigration";
import { decodeDurableWorkflowGraphV2 } from "../confect/workflows/graph";
import { defineWorkflowReferenceRegistry } from "../confect/workflows/_kit/workflowReferences";

const refs = defineWorkflowReferenceRegistry({
  capabilities: { sourceGroundedBrief: "capability.sourceGroundedBrief.v2" },
  workflows: {},
  events: {},
});

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

const migrationOptions = {
  argsSchemaName: "legacyReceipt.v2.args",
  returnSchemaName: "legacyReceipt.v2.return",
  principalSchemaName: "workflowPrincipal.v1",
  policyPosture: {
    kind: "none" as const,
    reason: "Legacy graph has no policy-dependent decisions.",
  },
  payloadPolicy: {
    maxInputBytes: 64_000,
    maxResultBytes: 64_000,
    resultMode: "inline" as const,
  },
};

describe("legacy durable workflow graph migration", () => {
  it("decodes the complete V1 shape behind an explicit compatibility schema", () => {
    expect(
      Schema.decodeUnknownSync(LegacyDurableWorkflowGraph)(legacyGraph),
    ).toEqual(legacyGraph);
    expect(Result.getOrThrow(decodeLegacyWorkflowGraph(legacyGraph))).toEqual(
      legacyGraph,
    );
  });

  it("adds stable V2 step addresses without enabling discarded V1 retry metadata", () => {
    const migrated = Result.getOrThrow(
      migrateLegacyWorkflowGraph(legacyGraph, migrationOptions),
    );
    const decoded = decodeDurableWorkflowGraphV2(migrated);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isFailure(decoded)) throw new Error("expected migrated V2 graph");
    expect(decoded.value).toEqual({
      schemaVersion: 2,
      id: legacyGraph.id,
      version: legacyGraph.version,
      startNodeId: legacyGraph.startNodeId,
      argsSchemaName: migrationOptions.argsSchemaName,
      returnSchemaName: migrationOptions.returnSchemaName,
      principalSchemaName: migrationOptions.principalSchemaName,
      policyPosture: migrationOptions.policyPosture,
      kickoffProfiles: [
        { name: "interactive", mode: "eager-first-poll", default: true },
      ],
      unstableArgs: { enabled: false },
      nodes: [
        {
          id: "source",
          kind: "source",
          label: "Legacy source",
          stepName: "source.v1",
          payloadPolicy: migrationOptions.payloadPolicy,
          semanticRuleIds: ["WF-NODE-KIND"],
        },
        {
          id: "receipt",
          kind: "output",
          label: "Legacy receipt",
          stepName: "receipt.v1",
          payloadPolicy: migrationOptions.payloadPolicy,
          semanticRuleIds: ["WF-NODE-KIND"],
        },
      ],
      edges: legacyGraph.edges,
      joins: legacyGraph.joins,
    });
  });

  it("requires explicit capability kind resolution instead of guessing from a V1 ref", () => {
    const graph = {
      ...legacyGraph,
      nodes: [
        legacyGraph.nodes[0],
        {
          id: "brief",
          kind: "capability",
          label: "Brief",
          capability: "sourceGroundedBrief",
          retry: { maxAttempts: 2, backoffMs: 10 },
        },
        legacyGraph.nodes[1],
      ],
      edges: [
        {
          id: "source_brief",
          sourceNodeId: "source",
          targetNodeId: "brief",
        },
        {
          id: "brief_receipt",
          sourceNodeId: "brief",
          targetNodeId: "receipt",
        },
      ],
    };
    const unresolved = migrateLegacyWorkflowGraph(graph, migrationOptions);
    expect(Result.isFailure(unresolved)).toBe(true);
    if (Result.isFailure(unresolved)) {
      expect(unresolved.failure.issue).toContain(
        "missing capability binding for sourceGroundedBrief",
      );
    }

    const migrated = migrateLegacyWorkflowGraph(graph, {
      ...migrationOptions,
      capabilityBindings: {
        sourceGroundedBrief: {
          kind: "action",
          reference: refs.capabilities.sourceGroundedBrief,
        },
      },
    });
    expect(Result.getOrThrow(migrated).nodes[1]).toMatchObject({
      kind: "capability",
      functionKind: "action",
      capability: refs.capabilities.sourceGroundedBrief,
    });
    expect(Result.getOrThrow(migrated).nodes[1]).not.toHaveProperty("retry");
  });

  it("rejects inputs that claim V2 instead of silently downgrading them", () => {
    const result = decodeLegacyWorkflowGraph({
      ...legacyGraph,
      schemaVersion: 2,
    });
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issue).toContain("cannot be decoded as legacy V1");
    }
  });
});
