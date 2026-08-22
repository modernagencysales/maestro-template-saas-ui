import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  deriveWorkflowStepInstanceSuffix,
  defineWorkflowGraphV2,
  stableWorkflowStepName,
  workflowNode,
  type DefineWorkflowGraphV2Input,
} from "../confect/workflows/_kit/workflowBuilder";
import {
  inlineTransactionPreset,
  reviewedInlineTransaction,
} from "../confect/workflows/_kit/inlineTransactions";
import { defineWorkflowReferenceRegistry } from "../confect/workflows/_kit/workflowReferences";

const refs = defineWorkflowReferenceRegistry({
  capabilities: {
    sendBrief: "capability.sendBrief.v2",
    writeReceipt: "capability.writeReceipt.v2",
  },
  workflows: { child: "workflow.child.v1" },
  events: { approval: "event.approval.v1" },
});

const base = {
  label: "Step",
  payloadPolicy: {
    maxInputBytes: 64_000,
    maxResultBytes: 64_000,
    resultMode: "inline" as const,
  },
  semanticRuleIds: ["WF-NODE-KIND"],
} as const;

describe("typed workflow V2 constructors", () => {
  it("constructs only the fields supported by each node kind", () => {
    expect(
      workflowNode.action({
        ...base,
        id: "action",
        kind: "capability",
        functionKind: "action",
        capability: refs.capabilities.sendBrief,
        stepName: "action.v2",
        failurePolicy: { kind: "fail" },
        retry: { maxAttempts: 3, initialBackoffMs: 250, base: 2 },
      }),
    ).toMatchObject({
      functionKind: "action",
      capability: refs.capabilities.sendBrief,
    });
    expect(
      workflowNode.inlineMutation(
        {
          ...base,
          id: "write",
          kind: "capability",
          functionKind: "mutation",
          capability: refs.capabilities.writeReceipt,
          stepName: "write.v2",
          failurePolicy: { kind: "fail" },
        },
        "tiny",
      ),
    ).toMatchObject({ transaction: { kind: "inline" } });
    expect(
      workflowNode.advanced.inlineMutation(
        {
          ...base,
          id: "reviewed-write",
          kind: "capability",
          functionKind: "mutation",
          capability: refs.capabilities.writeReceipt,
          stepName: "reviewed-write.v2",
          failurePolicy: { kind: "fail" },
        },
        reviewedInlineTransaction({ documentsRead: 2, documentsWritten: 1 }),
      ),
    ).toMatchObject({
      transaction: { limitsProfile: "reviewed-explicit" },
    });
  });

  it("makes unsafe inline combinations type-negative", () => {
    workflowNode.action({
      ...base,
      id: "bad-action",
      kind: "capability",
      functionKind: "action",
      capability: refs.capabilities.sendBrief,
      stepName: "bad-action.v2",
      failurePolicy: { kind: "fail" },
      // @ts-expect-error AP-002: action nodes never expose inline transaction posture.
      transaction: inlineTransactionPreset("tiny"),
    });
    workflowNode.inlineQuery(
      {
        ...base,
        id: "bad-schedule",
        kind: "capability",
        functionKind: "query",
        capability: refs.capabilities.sendBrief,
        stepName: "bad-schedule.v2",
        failurePolicy: { kind: "fail" },
        // @ts-expect-error AP-002: inline nodes cannot be scheduled.
        schedule: { kind: "runAfter", delayMs: 1 },
      },
      "tiny",
    );
    workflowNode.query({
      ...base,
      id: "bad-limits",
      kind: "capability",
      functionKind: "query",
      capability: refs.capabilities.sendBrief,
      stepName: "bad-limits.v2",
      failurePolicy: { kind: "fail" },
      // @ts-expect-error AP-002: independent novice APIs do not accept raw limits.
      limits: { documentsRead: 1 },
    });
    expect(() => reviewedInlineTransaction({})).toThrow("at least one");
    expect(() =>
      reviewedInlineTransaction({ documentsRead: Number.POSITIVE_INFINITY }),
    ).toThrow("finite positive integer");
    expect(() => reviewedInlineTransaction({ documentsRead: -1 })).toThrow(
      "finite positive integer",
    );
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
    expect(Result.getOrThrow(result)).toMatchObject({
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
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.findings).toContain("duplicate stepName: same.v2");
    }
  });

  it.each(["agent", "delay", "event", "subworkflow"] as const)(
    "rejects routed failure policy on %s nodes without a compiler",
    (kind) => {
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
      const unsupportedNode = {
        ...base,
        id: kind,
        kind,
        stepName: `${kind}.v2`,
        failurePolicy: {
          kind: "error-edge",
          edgeId: `${kind}_output`,
          failure: {
            _tag: "WorkflowSettledFailure",
            code: "NODE_FAILED",
            message: "Node could not complete.",
          },
        },
      } as const;
      const result = defineWorkflowGraphV2({
        ...graphInput(
          [
            source,
            unsupportedNode,
            output,
          ] as unknown as DefineWorkflowGraphV2Input["nodes"],
          [
            edge(`source_${kind}`, "source", kind),
            edge(`${kind}_output`, kind, "output"),
          ],
        ),
      } as unknown as DefineWorkflowGraphV2Input);
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.findings).toContain(
          `WF-NODE-FAILURE-POLICY: node ${kind} supports fail only; repair: move typed failure routing to a capability node`,
        );
      }
    },
  );

  it.each([
    [
      "no default",
      [{ name: "interactive", mode: "eager-first-poll", default: false }],
    ],
    [
      "multiple defaults",
      [
        { name: "interactive", mode: "eager-first-poll", default: true },
        { name: "queued", mode: "queued", default: true },
      ],
    ],
    [
      "duplicate names",
      [
        { name: "interactive", mode: "eager-first-poll", default: true },
        { name: "interactive", mode: "queued", default: false },
      ],
    ],
    [
      "queued interactive profile",
      [{ name: "interactive", mode: "queued", default: true }],
    ],
  ] as const)("rejects kickoff profiles with %s", (_name, kickoffProfiles) => {
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
      ...graphInput(
        [source, output],
        [edge("source_output", "source", "output")],
      ),
      kickoffProfiles,
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("derives stable versioned addresses and deterministic repeated-instance suffixes", () => {
    expect(stableWorkflowStepName({ name: "send-brief", version: 2 })).toBe(
      "send-brief.v2",
    );
    expect(
      stableWorkflowStepName({
        name: "send-brief",
        version: 2,
        instanceSuffix: deriveWorkflowStepInstanceSuffix({
          kind: "identity",
          value: "source-42",
        }),
      }),
    ).toBe("send-brief.v2.i-k9-source-42");
    expect(
      deriveWorkflowStepInstanceSuffix({ kind: "ordinal", value: 12 }),
    ).toBe("n000012");
  });

  it("rejects unstable step addresses and dangling edges with tagged findings", () => {
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
    const dangling = defineWorkflowGraphV2(
      graphInput([source, output], [edge("lost", "source", "missing")]),
    );
    expect(Result.isFailure(dangling)).toBe(true);
    if (Result.isFailure(dangling)) {
      expect(dangling.failure.findings).toContainEqual({
        _tag: "DanglingEdgeV2",
        edgeId: "lost",
        endpoint: "target",
        nodeId: "missing",
      });
    }

    const unstable = defineWorkflowGraphV2({
      ...graphInput([source, output], [edge("ok", "source", "output")]),
      nodes: [{ ...source, stepName: "source" }, output],
    });
    expect(Result.isFailure(unstable)).toBe(true);
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
      failurePolicy: { kind: "fail" },
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
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result))
        expect(result.failure.findings).toContain(finding);
    }
  });

  it("redacts rejected graph input from schema mismatch findings", () => {
    const rejectedValue = "must-not-appear-in-parser-output";
    const result = defineWorkflowGraphV2({
      ...graphInput([], []),
      nodes: [{ unexpected: rejectedValue }],
    } as unknown as DefineWorkflowGraphV2Input);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.findings).toEqual(["V2 graph schema mismatch"]);
      expect(JSON.stringify(result.failure.findings)).not.toContain(
        rejectedValue,
      );
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
workflowNode.source({
  ...base,
  id: "bad",
  kind: "source",
  stepName: "bad.v2",
  // @ts-expect-error AP-002 fixture: retry is unavailable on source nodes.
  retry: false,
});
// @ts-expect-error AP-002 fixture: executable nodes require an explicit failure policy.
workflowNode.action({
  ...base,
  id: "missing-failure-policy",
  kind: "capability",
  functionKind: "action",
  capability: refs.capabilities.sendBrief,
  stepName: "missing-failure-policy.v2",
});
workflowNode.inlineMutation(
  {
    ...base,
    id: "bad-inline",
    kind: "capability",
    functionKind: "mutation",
    capability: refs.capabilities.writeReceipt,
    stepName: "bad-inline.v2",
    failurePolicy: { kind: "fail" },
    // @ts-expect-error AP-002 fixture: inline mutations cannot be scheduled.
    schedule: { kind: "runAfter", delayMs: 1 },
  },
  "tiny",
);
workflowNode.subworkflow({
  ...base,
  id: "bad-child",
  kind: "subworkflow",
  workflow: refs.workflows.child,
  childVersion: 1,
  stepName: "bad-child.v1",
  failurePolicy: { kind: "fail" },
  // @ts-expect-error AP-002 fixture: pinned 0.4.4 children cannot be scheduled.
  schedule: { kind: "runAfter", delayMs: 1 },
});
workflowNode.agent({
  ...base,
  id: "bad-agent",
  kind: "agent",
  agent: refs.capabilities.sendBrief,
  stepName: "bad-agent.v1",
  failurePolicy: { kind: "fail" },
  // @ts-expect-error AP-002 fixture: agent nodes cannot expose action retry.
  retry: { maxAttempts: 2, initialBackoffMs: 1, base: 2 },
});
workflowNode.delay({
  ...base,
  id: "bad-delay-route",
  kind: "delay",
  stepName: "bad-delay-route.v2",
  delayMs: 1,
  failurePolicy: {
    // @ts-expect-error AP-002 fixture: only capability nodes compile routed failures.
    kind: "error-edge",
    edgeId: "delay-error",
    failure: {
      _tag: "WorkflowSettledFailure",
      code: "DELAY_FAILED",
      message: "Delay could not complete.",
    },
  },
});
