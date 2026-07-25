import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";

import {
  defineWorkflowGraphV2,
  workflowNode,
  type DefineWorkflowGraphV2Input,
} from "../confect/workflows/_kit/workflowBuilder";

const base = {
  label: "Step",
  payloadPolicy: {
    maxInputBytes: 64_000,
    maxResultBytes: 64_000,
    resultMode: "inline" as const,
  },
  semanticRuleIds: ["WF-NODE-KIND"],
};

describe("typed workflow V2 constructors", () => {
  it("constructs only the fields supported by each node kind", () => {
    expect(
      workflowNode.action({
        ...base,
        id: "action",
        kind: "capability",
        functionKind: "action",
        capability: "sendBrief",
        stepName: "action.v2",
        retry: { maxAttempts: 3, initialBackoffMs: 250, base: 2 },
      }),
    ).toMatchObject({ functionKind: "action", capability: "sendBrief" });
    expect(
      workflowNode.inlineMutation({
        ...base,
        id: "write",
        kind: "capability",
        functionKind: "mutation",
        capability: "writeReceipt",
        stepName: "write.v2",
        transaction: {
          kind: "inline",
          limits: { documentsRead: 2, documentsWritten: 1 },
        },
      }),
    ).toMatchObject({ transaction: { kind: "inline" } });
  });

  it("builds a strictly decoded graph with one generated interactive profile", () => {
    const source = workflowNode.source({
      ...base,
      id: "source",
      kind: "source",
      stepName: "source.v2",
    });
    const output = workflowNode.output({
      ...base,
      id: "output",
      kind: "output",
      stepName: "output.v2",
    });
    const result = defineWorkflowGraphV2({
      id: "workflow_builder",
      version: 2,
      startNodeId: "source",
      argsSchemaName: "builder.v2.args",
      returnSchemaName: "builder.v2.return",
      principalSchemaName: "workflowPrincipal.v1",
      policyPosture: {
        kind: "none",
        reason: "No policy-dependent decisions.",
      },
      nodes: [source, output],
      edges: [
        { id: "source_output", sourceNodeId: "source", targetNodeId: "output" },
      ],
      joins: [],
    });
    expect(Either.getOrThrow(result)).toMatchObject({
      schemaVersion: 2,
      unstableArgs: { enabled: false },
      kickoffProfiles: [
        { name: "interactive", mode: "eager-first-poll", default: true },
      ],
    });
  });

  it("rejects duplicate stable step addresses", () => {
    const result = defineWorkflowGraphV2({
      id: "workflow_duplicate_steps",
      version: 2,
      startNodeId: "source",
      argsSchemaName: "duplicate.v2.args",
      returnSchemaName: "duplicate.v2.return",
      principalSchemaName: "workflowPrincipal.v1",
      policyPosture: { kind: "none", reason: "No policy decisions." },
      nodes: [
        workflowNode.source({
          ...base,
          id: "source",
          kind: "source",
          stepName: "same.v2",
        }),
        workflowNode.output({
          ...base,
          id: "output",
          kind: "output",
          stepName: "same.v2",
        }),
      ],
      edges: [
        { id: "source_output", sourceNodeId: "source", targetNodeId: "output" },
      ],
      joins: [],
    });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.findings).toContain("duplicate stepName: same.v2");
    }
  });

  it("rejects invalid source, terminal, reachability, cycle, and any-join topology", () => {
    const source = workflowNode.source({
      ...base,
      id: "source",
      kind: "source",
      stepName: "source.v2",
    });
    const output = workflowNode.output({
      ...base,
      id: "output",
      kind: "output",
      stepName: "output.v2",
    });
    const detached = workflowNode.delay({
      ...base,
      id: "detached",
      kind: "delay",
      stepName: "detached.v2",
      delayMs: 1,
    });
    const cases: readonly [DefineWorkflowGraphV2Input, string][] = [
      [graphInput([output], []), "exactly one source node is required"],
      [
        graphInput(
          [source, output],
          [
            edge("source_output", "source", "output"),
            edge("output_source", "output", "source"),
          ],
        ),
        "output node output cannot have outgoing edges",
      ],
      [
        graphInput(
          [source, detached, output],
          [edge("source_output", "source", "output")],
        ),
        "node detached is unreachable from source",
      ],
      [
        graphInput(
          [source, detached, output],
          [
            edge("source_detached", "source", "detached"),
            edge("detached_source", "detached", "source"),
          ],
        ),
        "workflow graph must be acyclic",
      ],
      [
        graphInput(
          [source, detached, output],
          [
            edge("source_detached", "source", "detached"),
            edge("detached_output", "detached", "output"),
          ],
          [
            {
              nodeId: "output",
              strategy: "any-successful",
              sourceNodeIds: ["source", "detached"],
            },
          ],
        ),
        "any-successful joins require a typed mutually-exclusive branch or reviewed loser policy",
      ],
    ];

    for (const [input, finding] of cases) {
      const result = defineWorkflowGraphV2(input);
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result))
        expect(result.left.findings).toContain(finding);
    }
  });
});

const graphInput = (
  nodes: DefineWorkflowGraphV2Input["nodes"],
  edges: DefineWorkflowGraphV2Input["edges"],
  joins: DefineWorkflowGraphV2Input["joins"] = [],
): DefineWorkflowGraphV2Input => ({
  id: "workflow_topology",
  version: 2,
  startNodeId: "source",
  argsSchemaName: "topology.v2.args",
  returnSchemaName: "topology.v2.return",
  principalSchemaName: "workflowPrincipal.v1",
  policyPosture: { kind: "none", reason: "No policy decisions." },
  nodes,
  edges,
  joins,
});

const edge = (id: string, sourceNodeId: string, targetNodeId: string) => ({
  id,
  sourceNodeId,
  targetNodeId,
});

// AP-002 negative type fixtures: these suppressions are the assertion mechanism.
// @ts-expect-error retry is unavailable on source nodes.
workflowNode.source({
  ...base,
  id: "bad",
  kind: "source",
  stepName: "bad.v2",
  retry: false,
});
workflowNode.inlineMutation({
  ...base,
  id: "bad-inline",
  kind: "capability",
  functionKind: "mutation",
  capability: "bad",
  stepName: "bad-inline.v2",
  transaction: { kind: "inline", limits: {} },
  // @ts-expect-error AP-002 fixture: inline mutations cannot be scheduled.
  schedule: { kind: "runAfter", delayMs: 1 },
});
workflowNode.subworkflow({
  ...base,
  id: "bad-child",
  kind: "subworkflow",
  workflow: "child",
  childVersion: 1,
  stepName: "bad-child.v1",
  // @ts-expect-error AP-002 fixture: pinned 0.4.4 children cannot be scheduled.
  schedule: { kind: "runAfter", delayMs: 1 },
});
