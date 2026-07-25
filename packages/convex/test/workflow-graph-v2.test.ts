import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";

import {
  decodeDurableWorkflowGraphV2,
  type DurableWorkflowGraphV2,
} from "../confect/workflows/graph";
import { defineWorkflowReferenceRegistry } from "../confect/workflows/_kit/workflowReferences";

const refs = defineWorkflowReferenceRegistry({
  capabilities: {
    sendBrief: "capability.sendBrief.v2",
    agentSeat: "capability.agentSeat.v1",
  },
  workflows: { child: "workflow.child.v1" },
  events: { approval: "event.approval.v1" },
});

const payloadPolicy = {
  maxInputBytes: 64_000,
  maxResultBytes: 64_000,
  resultMode: "inline",
} as const;

const validGraph = {
  schemaVersion: 2,
  id: "workflow_v2_receipt",
  version: 2,
  startNodeId: "source",
  argsSchemaName: "workflowV2Receipt.v2.args",
  returnSchemaName: "workflowV2Receipt.v2.return",
  principalSchemaName: "workflowPrincipal.v1",
  policyPosture: {
    kind: "none",
    reason: "No policy-dependent decisions.",
  },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
  ],
  unstableArgs: { enabled: false },
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Source",
      stepName: "source.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NODE-KIND"],
    },
    {
      id: "receipt",
      kind: "output",
      label: "Receipt",
      stepName: "receipt.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NODE-KIND"],
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
} as const satisfies DurableWorkflowGraphV2;

describe("durable workflow graph V2 schema", () => {
  it("decodes the versioned discriminated graph contract", () => {
    expect(Either.getOrThrow(decodeDurableWorkflowGraphV2(validGraph))).toEqual(
      validGraph,
    );
  });

  it.each([
    {
      name: "retry on a source",
      node: {
        ...validGraph.nodes[0],
        retry: { maxAttempts: 2, initialBackoffMs: 10, base: 2 },
      },
    },
    {
      name: "transaction limits on an output",
      node: {
        ...validGraph.nodes[1],
        transactionLimits: { documentsRead: 1 },
      },
    },
    {
      name: "event schema on a source",
      node: { ...validGraph.nodes[0], eventSchemaName: "approval.v1" },
    },
    {
      name: "child version on an output",
      node: { ...validGraph.nodes[1], childVersion: 3 },
    },
  ])("rejects $name", ({ node }) => {
    const result = decodeDurableWorkflowGraphV2({
      ...validGraph,
      nodes: [node, validGraph.nodes[1]],
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("accepts action retry but rejects it on query capability nodes", () => {
    const action = {
      id: "act",
      kind: "capability",
      functionKind: "action",
      capability: refs.capabilities.sendBrief,
      label: "Send brief",
      stepName: "act.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-STEP-ACTION"],
      retry: { maxAttempts: 3, initialBackoffMs: 250, base: 2 },
    } as const;
    expect(
      Either.isRight(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [validGraph.nodes[0], action, validGraph.nodes[1]],
        }),
      ),
    ).toBe(true);
    expect(
      Either.isLeft(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [
            validGraph.nodes[0],
            { ...action, functionKind: "query" },
            validGraph.nodes[1],
          ],
        }),
      ),
    ).toBe(true);
  });

  it("rejects scheduled subworkflows on the pinned component contract", () => {
    const child = {
      id: "child",
      kind: "subworkflow",
      workflow: "childWorkflow",
      childVersion: 1,
      label: "Child",
      stepName: "child.v1",
      payloadPolicy,
      semanticRuleIds: ["WF-CHILD-SCHEDULE"],
      schedule: { kind: "runAfter", delayMs: 100 },
    } as const;
    expect(
      Either.isLeft(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [validGraph.nodes[0], child, validGraph.nodes[1]],
        }),
      ),
    ).toBe(true);
  });

  it("rejects retry on agent nodes", () => {
    expect(
      Either.isLeft(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [
            validGraph.nodes[0],
            {
              id: "agent",
              kind: "agent",
              agent: refs.capabilities.agentSeat,
              label: "Agent",
              stepName: "agent.v2",
              payloadPolicy,
              semanticRuleIds: ["WF-NODE-AGENT"],
              retry: { maxAttempts: 2, initialBackoffMs: 10, base: 2 },
            },
            validGraph.nodes[1],
          ],
        }),
      ),
    ).toBe(true);
  });

  it("rejects arbitrary durable registry strings and unknown semantic rules", () => {
    const action = {
      id: "act",
      kind: "capability",
      functionKind: "action",
      capability: "sendBrief",
      label: "Send brief",
      stepName: "act.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NOT-A-RULE"],
    } as const;
    expect(
      Either.isLeft(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [validGraph.nodes[0], action, validGraph.nodes[1]],
        }),
      ),
    ).toBe(true);
  });
});
