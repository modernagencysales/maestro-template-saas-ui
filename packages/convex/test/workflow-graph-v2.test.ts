import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";

import {
  decodeDurableWorkflowGraphV2,
  type DurableWorkflowGraphV2,
  validateWorkflowGraphV2,
} from "../confect/workflows/graphCurrent";
import { defineWorkflowReferenceRegistry } from "../confect/workflows/_kit/workflowReferences";
import { workflowNode } from "../confect/workflows/_kit/workflowBuilderCurrent";
import { MAX_WORKFLOW_SCHEDULE_HORIZON_MS } from "../confect/workflows/_kit/workflowSchedule";

const getOrThrow = <A, E>(result: Exit.Exit<A, E>): A => {
  if (Exit.isFailure(result)) throw new Error("expected parser success");
  return result.value;
};

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
    expect(getOrThrow(decodeDurableWorkflowGraphV2(validGraph))).toEqual(
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
    expect(Exit.isFailure(result)).toBe(true);
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
      failurePolicy: { kind: "fail" },
      retry: { maxAttempts: 3, initialBackoffMs: 250, base: 2 },
    } as const;
    expect(
      Exit.isSuccess(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [validGraph.nodes[0], action, validGraph.nodes[1]],
        }),
      ),
    ).toBe(true);
    expect(
      Exit.isFailure(
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

  it("authors scheduled eligible capabilities through explicit constructors", () => {
    const common = {
      id: "scheduled",
      kind: "capability" as const,
      capability: refs.capabilities.sendBrief,
      label: "Scheduled capability",
      stepName: "scheduled.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NODE-SCHEDULE"] as const,
      failurePolicy: { kind: "fail" as const },
    };
    expect(
      workflowNode.scheduledAction(
        { ...common, functionKind: "action" },
        { kind: "runAfter", delayMs: 100 },
        1_000,
      ),
    ).toMatchObject({ schedule: { kind: "runAfter", delayMs: 100 } });
    expect(
      workflowNode.scheduledQuery(
        { ...common, functionKind: "query" },
        { kind: "runAt", timestamp: 1_100 },
        1_000,
      ),
    ).toMatchObject({
      transaction: { kind: "independent" },
      schedule: { kind: "runAt", timestamp: 1_100 },
    });
    expect(
      workflowNode.scheduledMutation(
        { ...common, functionKind: "mutation" },
        { kind: "runAfter", delayMs: 100 },
        1_000,
      ),
    ).toMatchObject({
      transaction: { kind: "independent" },
      schedule: { kind: "runAfter", delayMs: 100 },
    });
    expect(() =>
      workflowNode.scheduledAction(
        { ...common, functionKind: "action" },
        { kind: "runAt", timestamp: 999 },
        1_000,
      ),
    ).toThrow(/earlier than the workflow dispatch clock/);
  });

  it.each([
    ["fractional runAfter", { kind: "runAfter", delayMs: 1.5 }],
    ["nonfinite runAt", { kind: "runAt", timestamp: Number.NaN }],
    [
      "over-horizon runAfter",
      {
        kind: "runAfter",
        delayMs: MAX_WORKFLOW_SCHEDULE_HORIZON_MS + 1,
      },
    ],
    [
      "both scheduling fields",
      { kind: "runAt", timestamp: 1_100, delayMs: 100 },
    ],
  ])("rejects %s during runtime graph decode", (_name, schedule) => {
    const result = decodeDurableWorkflowGraphV2({
      ...validGraph,
      nodes: [
        validGraph.nodes[0],
        {
          id: "act",
          kind: "capability",
          functionKind: "action",
          capability: refs.capabilities.sendBrief,
          label: "Send brief",
          stepName: "act.v2",
          payloadPolicy,
          semanticRuleIds: ["WF-NODE-SCHEDULE"],
          failurePolicy: { kind: "fail" },
          schedule,
        },
        validGraph.nodes[1],
      ],
    });
    expect(Exit.isFailure(result)).toBe(true);
  });

  it("rejects scheduled agents before compiler dispatch", () => {
    const agent = {
      id: "agent",
      kind: "agent",
      agent: refs.capabilities.agentSeat,
      label: "Agent",
      stepName: "agent.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NODE-SCHEDULE"],
      failurePolicy: { kind: "fail" },
      schedule: { kind: "runAfter", delayMs: 100 },
    } as const;
    const decoded = getOrThrow(
      decodeDurableWorkflowGraphV2({
        ...validGraph,
        nodes: [validGraph.nodes[0], agent, validGraph.nodes[1]],
      }),
    );
    expect(validateWorkflowGraphV2(decoded)).toContain(
      "node agent cannot use runAfter; scheduling is supported only for action and independent query/mutation capability nodes",
    );
  });

  it.each([
    ["zero attempts", { maxAttempts: 0, initialBackoffMs: 1, base: 2 }],
    ["fractional attempts", { maxAttempts: 1.5, initialBackoffMs: 1, base: 2 }],
    ["negative backoff", { maxAttempts: 2, initialBackoffMs: -1, base: 2 }],
    ["subunit base", { maxAttempts: 2, initialBackoffMs: 1, base: 0.5 }],
  ])("rejects action retry with %s", (_name, retry) => {
    expect(
      Exit.isFailure(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [
            validGraph.nodes[0],
            {
              id: "act",
              kind: "capability",
              functionKind: "action",
              capability: refs.capabilities.sendBrief,
              label: "Send brief",
              stepName: "act.v2",
              payloadPolicy,
              semanticRuleIds: ["WF-NODE-RETRY"],
              failurePolicy: { kind: "fail" },
              retry,
            },
            validGraph.nodes[1],
          ],
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["zero child version", { childVersion: 0 }],
    ["fractional child version", { childVersion: 1.5 }],
    ["negative payload input", { maxInputBytes: -1 }],
    ["fractional payload result", { maxResultBytes: 1.5 }],
  ])("rejects %s", (_name, override) => {
    const child = {
      id: "child",
      kind: "subworkflow",
      workflow: refs.workflows.child,
      childVersion: 1,
      label: "Child",
      stepName: "child.v1",
      payloadPolicy: {
        ...payloadPolicy,
        ...(Object.hasOwn(override, "maxInputBytes") ||
        Object.hasOwn(override, "maxResultBytes")
          ? override
          : {}),
      },
      semanticRuleIds: ["WF-NODE-SUBWORKFLOW"],
      failurePolicy: { kind: "fail" },
      ...(Object.hasOwn(override, "childVersion") ? override : {}),
    };
    expect(
      Exit.isFailure(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [validGraph.nodes[0], child, validGraph.nodes[1]],
        }),
      ),
    ).toBe(true);
  });

  it("requires every executable node to declare its failure policy", () => {
    const graph = {
      ...validGraph,
      nodes: [
        validGraph.nodes[0],
        {
          id: "act",
          kind: "capability",
          functionKind: "query",
          capability: refs.capabilities.sendBrief,
          transaction: { kind: "independent" },
          label: "Read brief",
          stepName: "act.v2",
          payloadPolicy,
          semanticRuleIds: ["WF-NODE-FUNCTION-KIND"],
        },
        validGraph.nodes[1],
      ],
      edges: [
        { id: "source_act", sourceNodeId: "source", targetNodeId: "act" },
        { id: "act_receipt", sourceNodeId: "act", targetNodeId: "receipt" },
      ],
    };
    expect(Exit.isFailure(decodeDurableWorkflowGraphV2(graph))).toBe(true);
  });

  it("rejects scheduled subworkflows on the pinned component contract", () => {
    const child = {
      id: "child",
      kind: "subworkflow",
      workflow: refs.workflows.child,
      childVersion: 1,
      label: "Child",
      stepName: "child.v1",
      payloadPolicy,
      semanticRuleIds: ["WF-CHILD-SCHEDULE"],
      failurePolicy: { kind: "fail" },
      schedule: { kind: "runAfter", delayMs: 100 },
    } as const;
    const decoded = getOrThrow(
      decodeDurableWorkflowGraphV2({
        ...validGraph,
        nodes: [validGraph.nodes[0], child, validGraph.nodes[1]],
      }),
    );
    expect(validateWorkflowGraphV2(decoded)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "cannot use runAt or runAfter on pinned Workflow 0.4.4",
        ),
      ]),
    );
  });

  it("rejects retry on agent nodes", () => {
    expect(
      Exit.isFailure(
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
              failurePolicy: { kind: "fail" },
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
      Exit.isFailure(
        decodeDurableWorkflowGraphV2({
          ...validGraph,
          nodes: [validGraph.nodes[0], action, validGraph.nodes[1]],
        }),
      ),
    ).toBe(true);
  });
});

describe("bounded subworkflow batch graph V2", () => {
  const node = workflowNode.boundedSubworkflowBatch({
    id: "batch",
    kind: "bounded-subworkflow-batch",
    workflow: refs.workflows.child,
    childVersion: 1,
    label: "Process bounded batches",
    stepName: "batch.v2",
    payloadPolicy,
    semanticRuleIds: ["WF-NODE-KIND"],
    failurePolicy: { kind: "fail" },
    maxItems: 8,
    batchSize: 2,
    fanOut: 2,
  });
  const graph = (overrides: Partial<typeof node> = {}) => ({
    ...validGraph,
    nodes: [
      validGraph.nodes[0],
      { ...node, ...overrides },
      validGraph.nodes[1],
    ],
    edges: [
      { id: "source_batch", sourceNodeId: "source", targetNodeId: "batch" },
      { id: "batch_receipt", sourceNodeId: "batch", targetNodeId: "receipt" },
    ],
  });

  it("decodes the explicit current-only bounded batch node", () => {
    expect(Exit.isSuccess(decodeDurableWorkflowGraphV2(graph()))).toBe(true);
  });

  it.each([
    ["maxItems", 8_193, "BOUND_EXCEEDED"],
    ["batchSize", 9, "BATCH_SIZE_EXCEEDS_MAX_ITEMS"],
    ["fanOut", 8_193, "BOUND_EXCEEDED"],
  ] as const)(
    "rejects invalid %s before dispatch with redacted repair guidance",
    (field, value, code) => {
      const decoded = getOrThrow(
        decodeDurableWorkflowGraphV2(graph({ [field]: value })),
      );
      expect(validateWorkflowGraphV2(decoded)).toContainEqual({
        _tag: "BoundedBatchV2",
        nodeId: "batch",
        code,
        reason: "Bounded batch plan rejected.",
        repair: expect.stringContaining("versioned bounded subworkflow"),
        rerun: "pnpm check:workflow:fast",
      });
    },
  );

  it("rejects raw zero bounds during strict decode", () => {
    expect(
      Exit.isFailure(decodeDurableWorkflowGraphV2(graph({ maxItems: 0 }))),
    ).toBe(true);
  });
});
