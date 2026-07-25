import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNonRetryableError } from "@convex-dev/workpool";
import type { EventId as ComponentEventId } from "@convex-dev/workflow";
import { v } from "convex/values";
import * as Schema from "effect/Schema";
import {
  conformanceApi,
  createWorkflowHarness,
} from "./helpers/workflowHarness";
import { adversarialWorkflowDrafts } from "./fixtures/workflows/adversarial";
import { findWorkflowConformanceIssues } from "./fixtures/workflows/conformanceChecks";
import {
  WorkflowCapabilityReference,
  WorkflowEventReference,
  WorkflowReference,
  WorkflowStepName,
  validateWorkflowGraphV2,
  type DurableWorkflowGraph,
  type DurableWorkflowGraphV2,
} from "../confect/workflows/graph";
import {
  runDurableGraphWorkflow,
  runDurableGraphWorkflowV2,
  type DurableGraphStepRef,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunner";
import {
  defineGeneratedCurrentAuthorityBinding,
  type GeneratedCurrentAuthorityBinding,
} from "../confect/workflows/_kit/graphRunnerV2";
import {
  defineWorkflowV2SubworkflowRegistry,
  defineWorkflowV2Subworkflow,
  runRegisteredSubworkflow,
  scheduledSubworkflowFinding,
  validateWorkflowV2SubworkflowTopology,
  type DurableGraphWorkflowRef,
  type WorkflowV2SubworkflowRegistryEntry,
} from "../confect/workflows/_kit/subworkflows";
import {
  buildSubworkflowRunLinkRow,
  reconcileSubworkflowRunLinkState,
  type SubworkflowRunLinkProjection,
} from "../confect/workflows/_kit/subworkflowLinks";
import {
  defineWorkflowEvent,
  defineWorkflowV2EventRegistry,
  runRegisteredWorkflowEvent,
  validateWorkflowEventDelivery,
  type OwnedWorkflowEvent,
  type ProductWorkflowEventId,
  type WorkflowEventOwnership,
} from "../confect/workflows/_kit/events";
import {
  allocateWorkflowEventInstance,
  consumeWorkflowEventInstance,
  reconcileWorkflowEventInstance,
  sendWorkflowEventInstance,
} from "../confect/workflows/_kit/eventInstances";
import type { WorkflowPrincipal } from "../confect/workflows/_kit/principal";
import type { WorkflowEffectContract } from "../confect/workflows/_kit/effectReservations";
import { runObservedWorkflowStage } from "../confect/workflows/_kit/observedStage";
import {
  PINNED_INLINE_CONVEX_VERSION,
  inlineTransactionPreset,
  reviewedInlineTransaction,
} from "../confect/workflows/_kit/inlineTransactions";

describe("Maestro workflow rejection fixtures", () => {
  it.each(adversarialWorkflowDrafts)(
    "rejects $name with its stable rule ID",
    (fixture) => {
      expect(findWorkflowConformanceIssues(fixture)).toContain(
        fixture.expectedFinding,
      );
    },
  );
});

describe("Maestro workflow compiler mapping", () => {
  it("maps every supported compiler node to its exact step call", async () => {
    const queryRef =
      "compiler.query" as unknown as DurableGraphStepRef<"query">;
    const mutationRef =
      "compiler.mutation" as unknown as DurableGraphStepRef<"mutation">;
    const actionRef =
      "compiler.action" as unknown as DurableGraphStepRef<"action">;
    const runQuery = vi.fn(async () => ({ queried: true }));
    const runMutation = vi.fn(async () => ({ mutated: true }));
    const runAction = vi.fn(async () => ({ acted: true }));
    const sleep = vi.fn(async () => undefined);
    const awaitEvent = vi.fn(async () => ({ approved: true }));
    const step = {
      runQuery,
      runMutation,
      runAction,
      sleep,
      awaitEvent,
    } as unknown as RunDurableGraphStep;
    const graph = compilerMappingGraph();

    await runDurableGraphWorkflow(step, {
      graph,
      inputs: { request: "compile" },
      policySnapshot: { mode: "test" },
      capabilityRegistry: {
        query: {
          kind: "query",
          ref: queryRef,
          buildArgs: ({ node }) => ({ nodeId: node.id }),
        },
        mutation: {
          kind: "mutation",
          ref: mutationRef,
          buildArgs: ({ node }) => ({ nodeId: node.id }),
        },
        action: {
          kind: "action",
          ref: actionRef,
          buildArgs: ({ node }) => ({ nodeId: node.id }),
        },
      },
      projectOutput: ({ context }) => ({
        completedNodeIds: Object.keys(context),
      }),
    });

    expect(runQuery.mock.calls).toEqual([[queryRef, { nodeId: "query" }]]);
    expect(runMutation.mock.calls).toEqual([
      [mutationRef, { nodeId: "mutation" }],
    ]);
    expect(runAction.mock.calls).toEqual([[actionRef, { nodeId: "action" }]]);
    expect(sleep.mock.calls).toEqual([
      [25, { name: "compiler-mapping.delay.delay" }],
    ]);
    expect(awaitEvent.mock.calls).toEqual([
      [{ name: "compiler-mapping.approval.approved" }],
    ]);
  });
});

describe("Maestro typed event compiler 2A", () => {
  it("journals fresh allocation before awaiting a pre-sent event", async () => {
    const calls: string[] = [];
    const awaitCall = vi.fn(
      async (event: AwaitEventInput) => (void event, { approved: true }),
    );
    const step = eventStep(awaitCall, calls);
    const result: Promise<{ readonly approved: boolean }> =
      runRegisteredWorkflowEvent({
        step,
        node: eventNode(),
        entry: approvalEntry(),
        ownership: eventRunOwnership,
      });

    await expect(result).resolves.toEqual({ approved: true });
    expect(calls).toEqual([
      "generation",
      "create",
      "allocate",
      "await",
      "consume",
    ]);
    expect(awaitCall).toHaveBeenCalledWith({
      id: ownedApprovalEvent().componentEventId,
      name: "approval-decision.v1.approval-1",
      validator: approvalEvent.validator,
    });
  });

  it("rejects registry and schema mismatches before await", async () => {
    expect(() =>
      defineWorkflowV2EventRegistry({
        "event.other.v1": approvalEntry(),
      }),
    ).toThrow("Event registry key must match");

    const awaitCall = vi.fn(async () => ({ approved: true }));
    await expect(
      runRegisteredWorkflowEvent({
        step: eventStep(awaitCall),
        node: eventNode({ eventSchemaName: "approval.wrong.v1" }),
        entry: approvalEntry(),
        ownership: eventRunOwnership,
      }),
    ).rejects.toThrow("Workflow event is unavailable");
    expect(awaitCall).not.toHaveBeenCalled();
  });

  it.each([
    ["workspace", { workspaceId: "workspace-2" }],
    ["run", { workflowRunId: "run-2" }],
    ["generation", { generation: 2 }],
    ["definition", { eventDefinition: otherEventRef }],
    ["instance", { eventInstanceKey: "approval-2" }],
  ] as const)("rejects a %s ownership mismatch opaquely", async (...row) => {
    const [, mismatch] = row;
    const awaitCall = vi.fn(async () => ({ approved: true }));
    const owned = { ...ownedApprovalEvent(), ...mismatch };

    await expect(
      runRegisteredWorkflowEvent({
        step: eventStep(awaitCall, undefined, () => owned),
        node: eventNode(),
        entry: approvalEntry(),
        ownership: eventRunOwnership,
      }),
    ).rejects.toSatisfy(isOpaqueEventFailure);
    expect(awaitCall).not.toHaveBeenCalled();
  });

  it("rejects principal or creator-capability drift before await", async () => {
    const awaitCall = vi.fn(async () => ({ approved: true }));
    await expect(
      runRegisteredWorkflowEvent({
        step: eventStep(awaitCall, undefined, () =>
          ownedApprovalEvent({
            principal: { ...eventPrincipal, systemId: "other-runner" },
          }),
        ),
        node: eventNode(),
        entry: approvalEntry(),
        ownership: eventRunOwnership,
      }),
    ).rejects.toSatisfy(isOpaqueEventFailure);

    const otherCreator = Schema.decodeSync(WorkflowCapabilityReference)(
      "capability.eventAllocator.v1",
    );
    await expect(
      runRegisteredWorkflowEvent({
        step: eventStep(awaitCall),
        node: eventNode(),
        entry: { ...approvalEntry(), creatorCapability: otherCreator },
        ownership: eventRunOwnership,
      }),
    ).rejects.toSatisfy(isOpaqueEventFailure);
    expect(awaitCall).not.toHaveBeenCalled();
  });

  it("does not cross-deliver concurrent event instances", async () => {
    const awaitCall = vi.fn(
      async (event: AwaitEventInput) => (void event, { approved: true }),
    );
    const allocated = new Map([
      ["approval-1", ownedApprovalEvent()],
      [
        "approval-2",
        ownedApprovalEvent({
          eventId: "product-event-2" as ProductWorkflowEventId,
          componentEventId: "component-event-2" as ComponentEventId,
          eventInstanceKey: "approval-2",
        }),
      ],
    ]);
    const step = eventStep(awaitCall, undefined, (args) => {
      const event = allocated.get(String(args.eventInstanceKey));
      if (!event) throw new Error("missing fixture event");
      return event;
    });

    await runRegisteredWorkflowEvent({
      step,
      node: eventNode(),
      entry: approvalEntry(),
      ownership: eventRunOwnership,
    });
    await runRegisteredWorkflowEvent({
      step,
      node: eventNode({ eventInstanceKey: "approval-2" }),
      entry: approvalEntry(),
      ownership: eventRunOwnership,
    });

    expect(
      awaitCall.mock.calls.map(([event]) => [event.id, event.name]),
    ).toEqual([
      ["component-event-1", "approval-decision.v1.approval-1"],
      ["component-event-2", "approval-decision.v1.approval-2"],
    ]);
  });

  it("allocates idempotently and invalidates a stale generation on restart", () => {
    const initial = allocateWorkflowEventInstance([], {
      ...approvalOwnership(),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "component-event-1" as ComponentEventId,
      occurredAt: 1,
    });
    const duplicate = allocateWorkflowEventInstance(initial.rows, {
      ...approvalOwnership(),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "unused-duplicate" as ComponentEventId,
      occurredAt: 2,
    });
    expect(duplicate.allocated).toEqual(initial.allocated);
    expect(duplicate.rows).toEqual(initial.rows);

    const restarted = allocateWorkflowEventInstance(initial.rows, {
      ...approvalOwnership({ generation: 2 }),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "component-event-2" as ComponentEventId,
      occurredAt: 3,
    });
    expect(restarted.allocated.componentEventId).toBe("component-event-2");
    expect(restarted.allocated.eventId).not.toBe(initial.allocated.eventId);
    expect(restarted.rows).toMatchObject([
      {
        generation: 1,
        status: "invalidated",
        cleanup: "residual-inaccessible",
      },
      { generation: 2, status: "allocated", cleanup: "active" },
    ]);
  });

  it("records cancellation and cleanup without claiming component deletion", () => {
    const { rows, allocated } = allocateWorkflowEventInstance([], {
      ...approvalOwnership(),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "component-event-1" as ComponentEventId,
      occurredAt: 1,
    });
    const canceled = reconcileWorkflowEventInstance(rows, {
      eventId: allocated.eventId,
      workspaceId: "workspace-1",
      outcome: "canceled",
      occurredAt: 2,
    });
    expect(canceled).toMatchObject([
      { status: "canceled", cleanup: "residual-inaccessible" },
    ]);
    expect(() =>
      reconcileWorkflowEventInstance(canceled, {
        eventId: allocated.eventId,
        workspaceId: "workspace-2",
        outcome: "cleanup",
        occurredAt: 3,
      }),
    ).toThrow("Workflow event is unavailable");
  });

  it("validates typed values and explicit errors from the shared definition", () => {
    expect(
      validateWorkflowEventDelivery(approvalEvent, {
        kind: "value",
        value: { approved: true },
      }),
    ).toEqual({ kind: "value", value: { approved: true } });
    expect(() =>
      validateWorkflowEventDelivery(approvalEvent, {
        kind: "value",
        value: { approved: "yes" },
      }),
    ).toThrow("Workflow event is unavailable");
    expect(
      validateWorkflowEventDelivery(approvalEvent, {
        kind: "error",
        error: "approval rejected",
      }),
    ).toEqual({ kind: "error", error: "approval rejected" });
  });

  it("sends by opaque ID or generated definition and consumes exactly once", () => {
    const initial = allocateWorkflowEventInstance([], {
      ...approvalOwnership(),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "component-event-1" as ComponentEventId,
      occurredAt: 1,
    });
    const sent = sendWorkflowEventInstance(initial.rows, {
      selector: { kind: "id", eventId: initial.allocated.eventId },
      delivery: { kind: "value" },
      occurredAt: 2,
    });
    expect(sent.owned).toEqual(initial.allocated);
    expect(sent.rows).toMatchObject([
      { status: "sent", deliveryKind: "value" },
    ]);
    expect(() =>
      sendWorkflowEventInstance(sent.rows, {
        selector: {
          kind: "definition",
          componentWorkflowId: "component-workflow-1",
          eventDefinition: approvalEventRef,
          eventInstanceKey: "approval-1",
        },
        delivery: { kind: "value" },
        occurredAt: 3,
      }),
    ).toThrow("Workflow event is unavailable");
    const consumed = consumeWorkflowEventInstance(sent.rows, {
      eventId: sent.owned.eventId,
      occurredAt: 4,
    });
    expect(consumed).toMatchObject([{ status: "consumed" }]);
    expect(() =>
      consumeWorkflowEventInstance(consumed, {
        eventId: sent.owned.eventId,
        occurredAt: 5,
      }),
    ).toThrow("Workflow event is unavailable");
  });

  it("rejects cancellation, stale IDs, and wrong workflow before send dispatch", () => {
    const initial = allocateWorkflowEventInstance([], {
      ...approvalOwnership(),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "component-event-1" as ComponentEventId,
      occurredAt: 1,
    });
    const canceled = reconcileWorkflowEventInstance(initial.rows, {
      workspaceId: "workspace-1",
      eventId: initial.allocated.eventId,
      outcome: "canceled",
      occurredAt: 2,
    });
    expect(() =>
      sendWorkflowEventInstance(canceled, {
        selector: { kind: "id", eventId: initial.allocated.eventId },
        delivery: { kind: "error" },
        occurredAt: 3,
      }),
    ).toThrow("Workflow event is unavailable");

    const restarted = allocateWorkflowEventInstance(initial.rows, {
      ...approvalOwnership({ generation: 2 }),
      componentWorkflowId: "component-workflow-1",
      componentEventId: "component-event-2" as ComponentEventId,
      occurredAt: 4,
    });
    expect(() =>
      sendWorkflowEventInstance(restarted.rows, {
        selector: { kind: "id", eventId: initial.allocated.eventId },
        delivery: { kind: "value" },
        occurredAt: 5,
      }),
    ).toThrow("Workflow event is unavailable");
    expect(() =>
      sendWorkflowEventInstance(restarted.rows, {
        selector: {
          kind: "definition",
          componentWorkflowId: "component-workflow-other",
          eventDefinition: approvalEventRef,
          eventInstanceKey: "approval-1",
        },
        delivery: { kind: "value" },
        occurredAt: 5,
      }),
    ).toThrow("Workflow event is unavailable");
  });

  it("rejects invalid payloads through the real shared Convex validator", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(
      conformanceApi.startEventBeforeWait,
      {},
    );
    await expect(
      t.mutation(conformanceApi.sendInvalidEventPayload, { workflowId }),
    ).rejects.toThrow();
  });

  it("rejects an invalid instance key instead of falling back to a raw name", async () => {
    const awaitCall = vi.fn(async () => ({ approved: true }));
    await expect(
      runRegisteredWorkflowEvent({
        step: eventStep(awaitCall),
        node: eventNode({ eventInstanceKey: "Approval Raw" }),
        entry: approvalEntry(),
        ownership: eventRunOwnership,
      }),
    ).rejects.toSatisfy(isOpaqueEventFailure);
    expect(awaitCall).not.toHaveBeenCalled();
  });

  it("compiles the registry through the V2 graph runner", async () => {
    const awaitCall = vi.fn(async () => ({ approved: true }));
    const eventRegistry = defineWorkflowV2EventRegistry({
      [approvalEvent.reference]: approvalEntry(),
    });

    await expect(
      runDurableGraphWorkflowV2(eventStep(awaitCall), {
        ...v2Input(v2EventGraph()),
        effectIdentity: eventIdentity,
        eventRegistry,
      }),
    ).resolves.toMatchObject({
      context: { approval: { approved: true } },
    });
  });
});

type AwaitEventInput = Parameters<RunDurableGraphStep["awaitEvent"]>[0];
type EventNodeV2 = Extract<
  DurableWorkflowGraphV2["nodes"][number],
  { readonly kind: "event" }
>;

const approvalEventRef = Schema.decodeSync(WorkflowEventReference)(
  "event.approvalDecision.v1",
);
const otherEventRef = Schema.decodeSync(WorkflowEventReference)(
  "event.otherDecision.v1",
);
const approvalEvent = defineWorkflowEvent({
  reference: approvalEventRef,
  name: "approval-decision.v1",
  schemaName: "workflow.approvalDecision.v1",
  schema: Schema.Struct({ approved: Schema.Boolean }),
  validator: v.object({ approved: v.boolean() }),
});
const eventIdentity = {
  workspaceId: "workspace-1",
  workflowRunId: "run-1",
  generation: 1,
  occurredAt: 1,
} as const;
const eventPrincipal = {
  version: 1,
  kind: "system",
  workspaceId: "workspace-1",
  grants: ["workflow:event:await"],
  kickoffAt: 1,
  systemId: "workflow-runner",
  reason: "workflow event fixture",
} as const;
const eventRunOwnership = {
  workspaceId: eventIdentity.workspaceId,
  workflowRunId: eventIdentity.workflowRunId,
  generation: eventIdentity.generation,
  principal: eventPrincipal,
  occurredAt: eventIdentity.occurredAt,
} as const;

const approvalOwnership = (
  overrides: Partial<WorkflowEventOwnership> = {},
): WorkflowEventOwnership => ({
  ...eventRunOwnership,
  eventDefinition: approvalEventRef,
  eventInstanceKey: "approval-1",
  principal: eventPrincipal,
  creatorCapability: capabilityRef,
  ...overrides,
});

const ownedApprovalEvent = (
  overrides: Partial<OwnedWorkflowEvent> = {},
): OwnedWorkflowEvent => ({
  eventId: "product-event-1" as ProductWorkflowEventId,
  componentEventId: "component-event-1" as ComponentEventId,
  ...approvalOwnership(),
  ...overrides,
});

const approvalEntry = () => ({
  definition: approvalEvent,
  creatorCapability: capabilityRef,
  refs: {
    loadGeneration:
      "component.journal.load" as unknown as DurableGraphStepRef<"query">,
    createComponentEvent:
      "component.event.create" as unknown as DurableGraphStepRef<"mutation">,
    allocate:
      "workflows.eventInstances.allocate" as unknown as DurableGraphStepRef<"mutation">,
    reconcile:
      "workflows.eventInstances.reconcile" as unknown as DurableGraphStepRef<"mutation">,
  },
});

const eventNode = (overrides: Partial<EventNodeV2> = {}): EventNodeV2 => ({
  id: "approval",
  kind: "event",
  label: "Approval",
  stepName: "approval.v2",
  eventDefinition: approvalEventRef,
  eventSchemaName: approvalEvent.schemaName,
  eventInstanceKey: "approval-1",
  payloadPolicy: {
    maxInputBytes: 1024,
    maxResultBytes: 1024,
    resultMode: "inline",
  },
  semanticRuleIds: ["WF-NODE-EVENT-DEFINITION"],
  ...overrides,
});

const eventStep = (
  awaitCall: (event: AwaitEventInput) => Promise<unknown>,
  calls?: string[],
  allocate: (args: Record<string, unknown>) => OwnedWorkflowEvent = () =>
    ownedApprovalEvent(),
): RunDurableGraphStep =>
  v2Step({
    workflowId: "component-workflow-1" as unknown as NonNullable<
      RunDurableGraphStep["workflowId"]
    >,
    runQuery: async () => {
      calls?.push("generation");
      return { workflow: { generationNumber: 1 } };
    },
    runMutation: async (ref, args) => {
      if (String(ref) === "component.event.create") {
        calls?.push("create");
        return "component-event-1";
      }
      if (String(ref) === "workflows.eventInstances.reconcile") {
        calls?.push("consume");
        return { status: "consumed", cleanup: "active" };
      }
      calls?.push("allocate");
      return allocate(args);
    },
    awaitEvent: async <Result>(event: AwaitEventInput) => {
      calls?.push("await");
      return (await awaitCall(event)) as Result;
    },
  });

const isOpaqueEventFailure = (error: unknown): boolean =>
  error instanceof Error &&
  error.message === "Workflow event is unavailable." &&
  !("details" in error);

const v2EventGraph = (): DurableWorkflowGraphV2 => ({
  ...v2CapabilityGraph("query"),
  id: "compiler-v2-event",
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Source",
      stepName: "start.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
    eventNode(),
    {
      id: "output",
      kind: "output",
      label: "Output",
      stepName: "output.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
  ],
  edges: [
    { id: "source-approval", sourceNodeId: "source", targetNodeId: "approval" },
    { id: "approval-output", sourceNodeId: "approval", targetNodeId: "output" },
  ],
  joins: [],
});

describe("Maestro V2 inline transaction compiler", () => {
  it("passes the exact tiny preset only to an inline query", async () => {
    const runQuery = vi.fn(async () => ({ ok: true }));
    await runDurableGraphWorkflowV2(v2Step({ runQuery }), {
      ...v2Input(v2InlineGraph("query", inlineTransactionPreset("tiny"))),
      convexVersion: PINNED_INLINE_CONVEX_VERSION,
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "query",
          ref: "inline.query" as unknown as DurableGraphStepRef<"query">,
          effectClass: "none",
          transactionPosture: "small-atomic",
          buildArgs: () => ({ value: 1 }),
        },
      },
      admitEffect: async () => ({ kind: "deny", reason: "not used" }),
    });
    expect(runQuery).toHaveBeenCalledWith(
      expect.anything(),
      { value: 1 },
      {
        name: "charge.v2",
        inline: true,
        transactionLimits: { documentsRead: 5, bytesWritten: 100 },
      },
    );
  });

  it("passes reviewed explicit counters only to an inline mutation", async () => {
    const runMutation = vi.fn(async () => ({ ok: true }));
    const transaction = reviewedInlineTransaction({
      bytesRead: 4096,
      bytesWritten: 2048,
      databaseQueries: 4,
      documentsRead: 8,
      documentsWritten: 3,
      functionsScheduled: 1,
      scheduledFunctionArgsBytes: 512,
    });
    await runDurableGraphWorkflowV2(v2Step({ runMutation }), {
      ...v2Input(v2InlineGraph("mutation", transaction)),
      convexVersion: PINNED_INLINE_CONVEX_VERSION,
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "mutation",
          ref: "inline.mutation" as unknown as DurableGraphStepRef<"mutation">,
          effectClass: "none",
          transactionPosture: "small-atomic",
          buildArgs: () => ({ value: 1 }),
        },
      },
      admitEffect: async () => ({ kind: "deny", reason: "not used" }),
    });
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      { value: 1 },
      {
        name: "charge.v2",
        inline: true,
        transactionLimits: transaction.limits,
      },
    );
  });

  it("keeps independent capability options free of inline tuning", async () => {
    const runQuery = vi.fn(async () => ({ ok: true }));
    await runDurableGraphWorkflowV2(v2Step({ runQuery }), {
      ...v2Input(v2CapabilityGraph("query")),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "query",
          ref: "independent.query" as unknown as DurableGraphStepRef<"query">,
          effectClass: "none",
          buildArgs: () => ({ value: 1 }),
        },
      },
      admitEffect: async () => ({ kind: "deny", reason: "not used" }),
    });
    expect(runQuery).toHaveBeenCalledWith(
      expect.anything(),
      { value: 1 },
      {
        name: "charge.v2",
      },
    );
  });

  it("rejects unsupported Convex and missing atomic posture before dispatch", async () => {
    const runQuery = vi.fn(async () => ({ ok: true }));
    const graph = v2InlineGraph(
      "query",
      inlineTransactionPreset("small-atomic"),
    );
    const registry = {
      [capabilityRef]: {
        kind: "query" as const,
        ref: "inline.query" as unknown as DurableGraphStepRef<"query">,
        effectClass: "none" as const,
        buildArgs: () => ({ value: 1 }),
      },
    };
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(graph),
        convexVersion: "1.40.9",
        capabilityRegistry: registry,
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow("pinned Convex");
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(graph),
        convexVersion: PINNED_INLINE_CONVEX_VERSION,
        capabilityRegistry: registry,
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow("small-atomic");
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("starts a complete V2 ready wave and waits for its all-successful join", async () => {
    const started: string[] = [];
    const resolvers = new Map<string, (value: unknown) => void>();
    const runQuery = vi.fn(
      async (...[, args]: [unknown, Record<string, unknown>]) => {
        const nodeId = String(args.nodeId);
        started.push(nodeId);
        return new Promise((resolve) => resolvers.set(nodeId, resolve));
      },
    );
    const promise = runDurableGraphWorkflowV2(v2Step({ runQuery }), {
      ...v2Input(v2ParallelGraph()),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "query",
          ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
          effectClass: "none",
          buildArgs: ({ node }) => ({ nodeId: node.id }),
        },
      },
      admitEffect: async () => ({ kind: "deny", reason: "not used" }),
    });

    await vi.waitFor(() => expect(started).toEqual(["branchA", "branchB"]));
    resolvers.get("branchB")?.({ branch: "B" });
    let settled = false;
    void promise.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolvers.get("branchA")?.({ branch: "A" });
    await expect(promise).resolves.toMatchObject({
      status: "completed",
      context: {
        branchA: { branch: "A" },
        branchB: { branch: "B" },
      },
    });
    await expect(promise).resolves.toSatisfy(
      (result) =>
        Object.keys(result.context).indexOf("branchA") <
        Object.keys(result.context).indexOf("branchB"),
    );
  });

  it("resolves a V2 conditional fan-in from the same edge snapshot", async () => {
    const runQuery = vi.fn(
      async (...[, args]: [unknown, Record<string, unknown>]) => ({
        nodeId: args.nodeId,
      }),
    );
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(v2ConditionalGraph()),
        inputs: { route: "A" },
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "query",
            ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
            effectClass: "none",
            buildArgs: ({ node }) => ({ nodeId: node.id }),
          },
        },
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).resolves.toMatchObject({
      context: {
        branchA: { nodeId: "branchA" },
      },
    });
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith(
      expect.anything(),
      { nodeId: "branchA" },
      { name: "branchA.v2" },
    );
  });

  it("routes settled failure in graph order and reuses a committed sibling on replay", async () => {
    const journal = new Map<string, Promise<unknown>>();
    const executions = new Map<string, number>();
    const runQuery = vi.fn(
      async (
        ...[, args, options]: [
          unknown,
          Record<string, unknown>,
          Record<string, unknown>?,
        ]
      ) => {
        const name = String(options?.name);
        const retained = journal.get(name);
        if (retained) return retained;
        const nodeId = String(args.nodeId);
        executions.set(nodeId, (executions.get(nodeId) ?? 0) + 1);
        const result =
          nodeId === "branchB"
            ? Promise.reject(new Error("redacted branch failure"))
            : Promise.resolve({ branch: "A", committed: true });
        journal.set(name, result);
        return result;
      },
    );
    let outputAttempts = 0;
    const input = {
      ...v2Input(v2SettledFailureGraph()),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "query" as const,
          ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
          effectClass: "none" as const,
          buildArgs: ({ node }: { node: { readonly id: string } }) => ({
            nodeId: node.id,
          }),
        },
      },
      admitEffect: async () => ({ kind: "deny" as const, reason: "not used" }),
      failureRoutes: {
        branchB: {
          kind: "error-edge" as const,
          edgeId: "b-output-error",
          failure: {
            _tag: "WorkflowSettledFailure" as const,
            code: "BRANCH_REJECTED",
            message: "Branch could not complete.",
          },
        },
      },
      projectOutput: ({
        context,
      }: {
        context: Readonly<Record<string, unknown>>;
      }) => {
        outputAttempts += 1;
        if (outputAttempts === 1) throw new Error("restart after settled wave");
        return { status: "completed", context };
      },
    };

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), input),
    ).rejects.toThrow("restart after settled wave");
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), input),
    ).resolves.toMatchObject({
      context: {
        branchA: { branch: "A", committed: true },
        branchB: {
          _tag: "WorkflowSettledFailure",
          code: "BRANCH_REJECTED",
        },
      },
    });
    expect([...executions.entries()]).toEqual([
      ["branchA", 1],
      ["branchB", 1],
    ]);
  });

  it("rejects a materialized ready wave above the environment budget", async () => {
    const runQuery = vi.fn(async () => ({ ok: true }));
    const graph = v2OverBudgetGraph();
    expect(validateWorkflowGraphV2(graph)).toContain(
      "graph materializes a ready wave of 5 nodes above the environment Workpool limit 4",
    );
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(graph),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "query",
            ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
            effectClass: "none",
            buildArgs: () => ({}),
          },
        },
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow("Workflow graph V2 failed validation.");
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("runs an exact child version with bounded args and inherited principal", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "child-receipt" }));
    const runMutation = vi.fn(
      async (...[ref]: Parameters<RunDurableGraphStep["runMutation"]>) =>
        ref === childLinkReserveRef ? { linkId: "link-1" } : null,
    );
    const graph = v2SubworkflowGraph();

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
        ...v2Input(graph),
        inputs: { requestId: "request-1" },
        principal: childPrincipal,
        workflowRegistry: childWorkflowRegistry,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).resolves.toMatchObject({
      context: { child: { receiptId: "child-receipt" } },
    });
    expect(runWorkflow).toHaveBeenCalledWith(
      childHandlerRef,
      {
        requestId: "request-1",
        principal: childPrincipal,
        policySnapshot: { kind: "none" },
      },
      { name: "child.v3" },
    );
    expect(runMutation.mock.calls).toEqual([
      [
        childLinkReserveRef,
        { projection: childLinkProjection(), occurredAt: 1 },
        { name: "child.v3.link.reserve.v1" },
      ],
      [
        childLinkReconcileRef,
        {
          workspaceId: "workspace-1",
          linkId: "link-1",
          outcome: {
            kind: "succeeded",
            resultJson: '{"receiptId":"child-receipt"}',
          },
          occurredAt: 1,
        },
        { name: "child.v3.link.reconcile.v1" },
      ],
    ]);
  });

  it("rejects a registry key whose version differs from its binding", () => {
    expect(() =>
      defineWorkflowV2SubworkflowRegistry({
        [childWorkflowRef]: { ...childWorkflowEntry, version: 2 },
      }),
    ).toThrow(/generated reference matching its immutable version/);
  });

  it.each([
    ["cycle", { maxDepth: 4, maxFanOut: 8 }, [childWorkflowRef]],
    ["maximum depth", { maxDepth: 1, maxFanOut: 8 }, [nestedWorkflowRef]],
    [
      "bounded fan-out",
      { maxDepth: 4, maxFanOut: 1 },
      [nestedWorkflowRef, nestedWorkflowRef],
    ],
  ] as const)("rejects %s before starting a child", async (...row) => {
    const [, policy, children] = row;
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const registry = defineWorkflowV2SubworkflowRegistry({
      [childWorkflowRef]: defineWorkflowV2Subworkflow({
        ...childWorkflowEntry,
        children,
      }),
      [nestedWorkflowRef]: defineWorkflowV2Subworkflow({
        ...childWorkflowEntry,
        version: 4,
        children: [],
      }),
    });

    expect(() =>
      validateWorkflowV2SubworkflowTopology(
        v2SubworkflowGraph(),
        registry,
        policy,
      ),
    ).toThrow();
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
        ...v2Input(v2SubworkflowGraph()),
        principal: childPrincipal,
        workflowRegistry: registry,
        subworkflowPolicy: policy,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow();
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it("persists exact parent-child projections and reconciles replay idempotently", () => {
    const projection = childLinkProjection();
    const row = buildSubworkflowRunLinkRow(projection, 10);
    expect(row).toMatchObject({
      workspaceId: "workspace-1",
      parentWorkflowId: "run-1",
      childWorkflowId: null,
      relationKind: "subworkflow",
      relationId: "child.v3",
      status: "starting",
    });
    expect(JSON.parse(row.parentKind)).toEqual({
      workflowVersion: 2,
      generation: 0,
      principal: childPrincipal,
    });
    expect(JSON.parse(row.childKind)).toEqual({
      workflow: childWorkflowRef,
      workflowVersion: 3,
      principal: childPrincipal,
      cancellation: "cascade",
      cleanup: "cascade-async",
    });

    const first = reconcileSubworkflowRunLinkState(
      row,
      {
        kind: "succeeded",
        resultJson: '{"receiptId":"child-receipt"}',
      },
      11,
    );
    const replay = reconcileSubworkflowRunLinkState(
      first,
      {
        kind: "succeeded",
        resultJson: '{"receiptId":"child-receipt"}',
      },
      12,
    );
    expect(replay).toEqual(first);
    expect(() =>
      reconcileSubworkflowRunLinkState(
        first,
        {
          kind: "failed",
          error: "late contradiction",
        },
        13,
      ),
    ).toThrow("already reconciled");
  });

  it.each([
    ["child failure", "child failed", "failed"],
    ["child cancellation", "Canceled", "canceled"],
  ] as const)(
    "propagates %s without overstating cleanup completion",
    async (...row) => {
      const [, message, expectedOutcome] = row;
      const runWorkflow = vi.fn(async () => Promise.reject(new Error(message)));
      const runMutation = vi.fn(
        async (...[ref]: Parameters<RunDurableGraphStep["runMutation"]>) =>
          ref === childLinkReserveRef ? { linkId: "link-1" } : null,
      );
      await expect(
        runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
          ...v2Input(v2SubworkflowGraph()),
          principal: childPrincipal,
          workflowRegistry: childWorkflowRegistry,
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        }),
      ).rejects.toThrow(message);
      expect(childWorkflowEntry.lifecycle).toEqual({
        cancel: "cascade",
        cleanup: "cascade-async",
      });
      expect(runMutation.mock.calls[1]?.[1]).toMatchObject({
        outcome: { kind: expectedOutcome },
      });
    },
  );

  it("allows only an explicit grant narrowing for the child principal", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "narrowed" }));
    const narrowedRegistry = defineWorkflowV2SubworkflowRegistry({
      [childWorkflowRef]: {
        ...childWorkflowEntry,
        principal: { kind: "narrow", grants: ["brief:read"] },
      },
    });
    await runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
      ...v2Input(v2SubworkflowGraph()),
      inputs: { requestId: "request-1" },
      principal: childPrincipal,
      workflowRegistry: narrowedRegistry,
      capabilityRegistry: {},
      admitEffect: async () => ({ kind: "deny", reason: "not used" }),
    });
    expect(runWorkflow).toHaveBeenCalledWith(
      childHandlerRef,
      {
        requestId: "request-1",
        principal: { ...childPrincipal, grants: ["brief:read"] },
        policySnapshot: { kind: "none" },
      },
      { name: "child.v3" },
    );
  });

  it("rejects a child principal that attempts to add a grant", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const wideningRegistry = defineWorkflowV2SubworkflowRegistry({
      [childWorkflowRef]: {
        ...childWorkflowEntry,
        principal: { kind: "narrow", grants: ["workflow:admin"] },
      },
    });
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
        ...v2Input(v2SubworkflowGraph()),
        inputs: { requestId: "request-1" },
        principal: childPrincipal,
        workflowRegistry: wideningRegistry,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/narrowed child principal cannot add grants/);
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it("retains child args and validated result through registry invocation", () => {
    const typedRegistryEntry: WorkflowV2SubworkflowRegistryEntry<
      ChildArgs,
      ChildResult
    > = childWorkflowEntry;
    const typedInvocation = () =>
      runRegisteredSubworkflow({
        step: v2Step({ runWorkflow: async () => ({ receiptId: "typed" }) }),
        node: v2SubworkflowNode(),
        entry: typedRegistryEntry,
        inputs: { requestId: "request-1" },
        context: {},
        principal: childPrincipal,
        policySnapshot: {},
        ownership: {
          workspaceId: "workspace-1",
          parentWorkflowId: "run-1",
          parentWorkflowVersion: 2,
          generation: 0,
          occurredAt: 1,
        },
      });
    const typedChildResult: () => Promise<ChildResult> = typedInvocation;
    expect(typedChildResult).toBeTypeOf("function");
  });

  it("rejects oversized child args before runWorkflow dispatch", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
        ...v2Input(v2SubworkflowGraph(32)),
        inputs: { requestId: "x".repeat(200) },
        principal: childPrincipal,
        workflowRegistry: childWorkflowRegistry,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/child.*mapped args.*32 bytes/);
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it("rejects a runtime result mismatch against the parameterized child reference", async () => {
    const runWorkflow = vi.fn(async () => ({ wrong: true }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
        ...v2Input(v2SubworkflowGraph()),
        inputs: { requestId: "request-1" },
        principal: childPrincipal,
        workflowRegistry: childWorkflowRegistry,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/child returned an invalid declared result/);
  });

  it.each(["runAt", "runAfter"] as const)(
    "rejects scheduled child %s on pinned Workflow 0.4.4 with an honest alternative",
    (kind) => {
      expect(
        scheduledSubworkflowFinding({
          ...v2SubworkflowNode(),
          schedule:
            kind === "runAt"
              ? { kind, timestamp: 100 }
              : { kind, delayMs: 100 },
        }),
      ).toBe(
        "subworkflow node child cannot use runAt or runAfter on pinned Workflow 0.4.4 because runWorkflow drops scheduled-child options; use a named sleep followed by an unscheduled child as a deliberately non-equivalent alternative, or a tested compatible upgrade",
      );
    },
  );

  it("passes the stable name and exact explicit retry options", async () => {
    const actionRef =
      "compiler.v2.action" as unknown as DurableGraphStepRef<"action">;
    const runAction = vi.fn(async () => ({ accepted: true }));
    const runQuery = vi.fn(async () => currentAuthorityReceipt);
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const graph = v2CapabilityGraph("action", {
      maxAttempts: 4,
      initialBackoffMs: 125,
      base: 2,
    });

    await runDurableGraphWorkflowV2(v2Step({ runAction, runQuery }), {
      ...v2ExternalInput(graph),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: actionRef,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: providerNativeContract,
          instanceKey: () => "invoice-42",
          buildArgs: ({ logicalEffectKey }) => ({ logicalEffectKey }),
        },
      },
      admitEffect,
    });

    expect(runAction).toHaveBeenCalledWith(
      actionRef,
      { logicalEffectKey: expect.stringContaining("effect.v1") },
      {
        name: "charge.v2",
        retry: { maxAttempts: 4, initialBackoffMs: 125, base: 2 },
      },
    );
    expect(admitEffect).toHaveBeenCalledBefore(runAction);
    expect(runQuery).toHaveBeenCalledWith(
      generatedCurrentAuthority.ref,
      expect.objectContaining({
        principal: expect.objectContaining({ actorId: "user-1" }),
        requiredGrants: ["billing:charge"],
      }),
      { name: "charge.v2.authorize" },
    );
    expect(runQuery).toHaveBeenCalledBefore(admitEffect);
  });

  it("uses retry false for a non-retriable action", async () => {
    const runAction = vi.fn(async () => ({ accepted: true }));
    const graph = v2CapabilityGraph("action");
    await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2ExternalInput(graph),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: nonRetriableContract,
          instanceKey: () => "invoice-42",
          buildArgs: () => ({}),
        },
      },
      admitEffect: async () => ({ kind: "dispatch" }),
    });
    expect(runAction).toHaveBeenCalledWith(
      expect.anything(),
      {},
      { name: "charge.v2", retry: false },
    );
  });

  it("rejects an unsafe dedupe horizon before provider dispatch", async () => {
    const runAction = vi.fn(async () => ({ accepted: true }));
    const graph = v2CapabilityGraph("action", {
      maxAttempts: 2,
      initialBackoffMs: 1,
      base: 2,
    });
    const unsafe = { ...providerNativeContract, dedupeRetentionMs: 199 };
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction }), {
        ...v2ExternalInput(graph),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
            authorization: externalAuthorization,
            effectContract: unsafe,
            instanceKey: () => "invoice-42",
            buildArgs: () => ({}),
          },
        },
        admitEffect: async () => ({ kind: "dispatch" }),
      }),
    ).rejects.toThrow(
      /charge.*capability\.billingCharge\.v2.*dedupeRetentionMs/s,
    );
    expect(runAction).not.toHaveBeenCalled();
  });

  it("keeps action retry options off queries and mutations", async () => {
    const runQuery = vi.fn(async () => ({ ok: true }));
    const graph = v2CapabilityGraph("query");
    await runDurableGraphWorkflowV2(v2Step({ runQuery }), {
      ...v2Input(graph),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "query",
          ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
          effectClass: "none",
          buildArgs: () => ({}),
        },
      },
      admitEffect: async () => ({ kind: "deny", reason: "not used" }),
    });
    expect(runQuery).toHaveBeenCalledWith(
      expect.anything(),
      {},
      { name: "charge.v2" },
    );
    expect(runQuery).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ retry: expect.anything() }),
    );
  });

  it("rejects legacy external actions before effect admission", async () => {
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const runQuery = vi.fn(async () => null);
    const runAction = vi.fn(async () => ({ accepted: true }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction, runQuery }), {
        ...v2Input(v2CapabilityGraph("action")),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
            authorization: externalAuthorization,
            effectContract: nonRetriableContract,
            instanceKey: () => "invoice-42",
            buildArgs: () => ({}),
          },
        },
        admitEffect,
      }),
    ).rejects.toThrow(/workflow authority is unavailable/);
    expect(runQuery).not.toHaveBeenCalled();
    expect(admitEffect).not.toHaveBeenCalled();
    expect(runAction).not.toHaveBeenCalled();
  });

  it("blocks revoked V2 authority before effect admission", async () => {
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const runAction = vi.fn(async () => ({ accepted: true }));
    const runQuery = vi.fn(async () => {
      throw new Error("revoked membership details");
    });
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction, runQuery }), {
        ...v2ExternalInput(v2CapabilityGraph("action")),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
            authorization: externalAuthorization,
            effectContract: nonRetriableContract,
            instanceKey: () => "invoice-42",
            buildArgs: () => ({}),
          },
        },
        admitEffect,
      }),
    ).rejects.toThrow(/workflow authority is unavailable/);
    expect(runQuery).toHaveBeenCalledWith(
      generatedCurrentAuthority.ref,
      expect.objectContaining({
        workspaceId: "workspace-1",
        requiredGrants: ["billing:charge"],
      }),
      { name: "charge.v2.authorize" },
    );
    expect(admitEffect).not.toHaveBeenCalled();
    expect(runAction).not.toHaveBeenCalled();
  });

  it("rejects a forged authority binding with a matching receipt", async () => {
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const runAction = vi.fn(async () => ({ accepted: true }));
    const runQuery = vi.fn(async () => currentAuthorityReceipt);
    const arbitraryAuthority = {
      ...generatedCurrentAuthority,
      ref: "compiler.noop" as unknown as DurableGraphStepRef<"query">,
    } as unknown as GeneratedCurrentAuthorityBinding;
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction, runQuery }), {
        ...v2ExternalInput(v2CapabilityGraph("action")),
        currentAuthority: arbitraryAuthority,
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
            authorization: externalAuthorization,
            effectContract: nonRetriableContract,
            instanceKey: () => "invoice-42",
            buildArgs: () => ({}),
          },
        },
        admitEffect,
      }),
    ).rejects.toThrow(/generated current-authority reauthorization/);
    expect(runQuery).not.toHaveBeenCalled();
    expect(admitEffect).not.toHaveBeenCalled();
    expect(runAction).not.toHaveBeenCalled();
  });

  it("rejects a generated authority binding for a different workflow", async () => {
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const runAction = vi.fn(async () => ({ accepted: true }));
    const runQuery = vi.fn(async () => currentAuthorityReceipt);
    const mismatchedAuthority = defineGeneratedCurrentAuthorityBinding(
      { id: "workflow_other", version: 2 },
      {
        other: {
          authorizeConsequential: {
            functionNamespace: "workflowContracts/other",
            functionSpec: { name: "authorizeConsequential" },
          },
        },
      },
    );
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction, runQuery }), {
        ...v2ExternalInput(v2CapabilityGraph("action")),
        currentAuthority: mismatchedAuthority,
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
            authorization: externalAuthorization,
            effectContract: nonRetriableContract,
            instanceKey: () => "invoice-42",
            buildArgs: () => ({}),
          },
        },
        admitEffect,
      }),
    ).rejects.toThrow(/generated current-authority reauthorization/);
    expect(runQuery).not.toHaveBeenCalled();
    expect(admitEffect).not.toHaveBeenCalled();
    expect(runAction).not.toHaveBeenCalled();
  });

  it("allows legacy principals to complete non-consequential work", async () => {
    const runQuery = vi.fn(async () => ({ ok: true }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(v2CapabilityGraph("query")),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "query",
            ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
            effectClass: "none",
            buildArgs: () => ({}),
          },
        },
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).resolves.toMatchObject({ status: "completed" });
    expect(runQuery).toHaveBeenCalledOnce();
  });

  it("does not call the provider after admission denial", async () => {
    const runAction = vi.fn(async () => ({ accepted: true }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction }), {
        ...v2ExternalInput(v2CapabilityGraph("action")),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
            authorization: externalAuthorization,
            effectContract: nonRetriableContract,
            instanceKey: () => "invoice-42",
            buildArgs: () => ({}),
          },
        },
        admitEffect: async () => ({
          kind: "deny",
          reason: "spend kill switch",
        }),
      }),
    ).rejects.toThrow(/spend kill switch/);
    expect(runAction).not.toHaveBeenCalled();
  });

  it("maps declared terminal failures to the pinned non-retryable error", async () => {
    const providerFailure = new Error("provider secret payload");
    const runAction = vi.fn(async () => Promise.reject(providerFailure));
    const promise = runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2ExternalInput(v2CapabilityGraph("action")),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: nonRetriableContract,
          instanceKey: () => "invoice-42",
          buildArgs: () => ({}),
          terminalError: (error) =>
            error === providerFailure
              ? "redacted terminal provider failure"
              : undefined,
        },
      },
      admitEffect: async () => ({ kind: "dispatch" }),
    });
    await expect(promise).rejects.toSatisfy(isNonRetryableError);
    await expect(promise).rejects.not.toThrow(/secret payload/);
  });

  it("replays a provider-native ambiguity with the identical logical key", async () => {
    const runAction = vi.fn(
      async (...[, args]: [unknown, Record<string, unknown>]) => args,
    );
    await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2ExternalInput(
        v2CapabilityGraph("action", {
          maxAttempts: 2,
          initialBackoffMs: 1,
          base: 2,
        }),
      ),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: providerNativeContract,
          instanceKey: () => "invoice-42",
          buildArgs: ({ logicalEffectKey }) => ({ logicalEffectKey }),
        },
      },
      admitEffect: async () => ({ kind: "replay-provider-key" }),
    });
    expect(runAction).toHaveBeenCalledWith(
      expect.anything(),
      { logicalEffectKey: expect.stringContaining("effect.v1") },
      expect.objectContaining({ name: "charge.v2" }),
    );
  });

  it.each([
    ["omitted", () => ({})],
    ["altered", () => ({ logicalEffectKey: "attacker-controlled" })],
  ])(
    "rejects a provider-native %s key mapping before dispatch",
    async (...row) => {
      const [, buildArgs] = row;
      const runAction = vi.fn(async () => ({ accepted: true }));
      await expect(
        runDurableGraphWorkflowV2(v2Step({ runAction }), {
          ...v2ExternalInput(
            v2CapabilityGraph("action", {
              maxAttempts: 2,
              initialBackoffMs: 1,
              base: 2,
            }),
          ),
          capabilityRegistry: {
            [capabilityRef]: {
              kind: "action",
              ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
              effectClass: "external",
              authorization: externalAuthorization,
              effectContract: providerNativeContract,
              instanceKey: () => "invoice-42",
              buildArgs,
            },
          },
          admitEffect: async () => ({ kind: "replay-provider-key" }),
        }),
      ).rejects.toThrow(
        /must map the derived logical effect key at logicalEffectKey/,
      );
      expect(runAction).not.toHaveBeenCalled();
    },
  );

  it("omits an attempt count when the pinned component cannot prove it", async () => {
    const recordStageStarted =
      "observe.started" as unknown as DurableGraphStepRef<"mutation">;
    const runMutation = vi.fn(async () => undefined);
    await runObservedWorkflowStage({
      step: { runMutation },
      refs: { recordStageStarted },
      nodeId: "charge",
      label: "Charge",
      kind: "capability",
      attemptNumber: "unknown",
      run: async () => ({ ok: true }),
    });
    expect(runMutation).toHaveBeenCalledWith(
      recordStageStarted,
      expect.not.objectContaining({ attemptNumber: expect.anything() }),
    );
  });
});

describe("pinned Convex Workflow component conformance", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date", "setTimeout"] }));
  afterEach(() => {
    // Explicit harness drains assert workflow quiescence; this queue may include runner timers.
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("distinguishes eager-first-poll from queued kickoff", async () => {
    const eager = createWorkflowHarness();
    const eagerId = await eager.mutation(conformanceApi.startEagerFailure, {});
    const eagerStatus = await eager.query(conformanceApi.workflow.getStatus, {
      workflowId: eagerId,
    });
    expect(eagerStatus.workflow.runResult).toMatchObject({ kind: "failed" });
    await eager.mutation(conformanceApi.cleanupWorkflow, {
      workflowId: eagerId,
    });
    await eager.finishAllScheduledFunctions(vi.runOnlyPendingTimers);

    const queued = createWorkflowHarness();
    const queuedId = await queued.mutation(
      conformanceApi.startQueuedFailure,
      {},
    );
    const queuedStatus = await queued.query(conformanceApi.workflow.getStatus, {
      workflowId: queuedId,
    });
    expect(queuedStatus.workflow.runResult).toBeUndefined();
    await queued.mutation(conformanceApi.cancelWorkflow, {
      workflowId: queuedId,
    });
    await queued.mutation(conformanceApi.cleanupWorkflow, {
      workflowId: queuedId,
    });
    await queued.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
  });

  it("consumes an event that arrives before its wait step", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(
      conformanceApi.startEventBeforeWait,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).resolves.toEqual({ type: "completed", result: true });
    await t.mutation(conformanceApi.cleanupWorkflow, { workflowId });
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
  });

  it("traverses workflow pagination cursors without duplicates", async () => {
    const t = createWorkflowHarness();
    const ids = await Promise.all([
      t.mutation(conformanceApi.startQueuedFailure, {}),
      t.mutation(conformanceApi.startQueuedFailure, {}),
      t.mutation(conformanceApi.startQueuedFailure, {}),
    ]);
    const first = await t.query(conformanceApi.listWorkflows, {
      cursor: null,
      numItems: 2,
    });
    const second = await t.query(conformanceApi.listWorkflows, {
      cursor: first.continueCursor,
      numItems: 2,
    });
    const listedIds = [...first.page, ...second.page].map(
      (entry) => (entry as { workflowId: string }).workflowId,
    );
    expect(new Set(listedIds)).toEqual(new Set(ids));
    expect(second.isDone).toBe(true);
    for (const workflowId of ids) {
      await t.mutation(conformanceApi.cancelWorkflow, { workflowId });
      await t.mutation(conformanceApi.cleanupWorkflow, { workflowId });
    }
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
  });

  it("cancels and cleans through the public manager boundary", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.startQueuedFailure, {});

    await t.mutation(conformanceApi.cancelWorkflow, { workflowId });
    const canceled = await t.query(conformanceApi.workflowStatus, {
      workflowId,
    });
    expect(canceled).toEqual({ type: "canceled" });

    await expect(
      t.mutation(conformanceApi.cleanupWorkflow, { workflowId }),
    ).resolves.toBe(true);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).rejects.toThrow("Workflow not found");
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
  });

  it("dispatches Promise.all steps as parallel component work", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.startParallel, {});
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).resolves.toEqual({ type: "completed", result: ["left", "right"] });
    const steps = await t.query(conformanceApi.listWorkflowSteps, {
      workflowId,
      cursor: null,
      numItems: 10,
    });
    expect(steps.page.map((step) => step.name)).toEqual(["left", "right"]);
    expect(steps.page.map((step) => step.workId)).toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    expect(new Set(steps.page.map((step) => step.workId)).size).toBe(2);
    await t.mutation(conformanceApi.cleanupWorkflow, { workflowId });
  });

  it("selects the latest duplicate restart name and truncates its tail", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(
      conformanceApi.startRestartWorkflow,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).resolves.toMatchObject({ type: "failed" });
    await t.mutation(conformanceApi.restartFromDuplicate, { workflowId });
    const retained = await t.query(conformanceApi.listWorkflowSteps, {
      workflowId,
      cursor: null,
      numItems: 10,
    });
    expect(retained.page.map((step) => step.name)).toEqual([
      "duplicate",
      "middle",
    ]);
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    await t.mutation(conformanceApi.cleanupWorkflow, { workflowId });
  });

  it("cascades subworkflow cancellation through public workflow steps", async () => {
    const t = createWorkflowHarness();
    const parentId = await t.mutation(conformanceApi.startParent, {});
    let childId: string | undefined;
    for (let attempt = 0; attempt < 10 && childId === undefined; attempt += 1) {
      vi.runOnlyPendingTimers();
      await t.finishInProgressScheduledFunctions();
      const steps = await t.query(conformanceApi.listWorkflowSteps, {
        workflowId: parentId,
        cursor: null,
        numItems: 10,
      });
      childId = steps.page[0]?.workflowId;
    }
    if (childId === undefined) {
      throw new Error("component did not create the nested workflow");
    }

    await t.mutation(conformanceApi.cancelWorkflow, { workflowId: parentId });
    const childStatus = await t.query(conformanceApi.workflowStatus, {
      workflowId: childId,
    });
    expect(childStatus).toEqual({ type: "canceled" });

    await t.mutation(conformanceApi.cleanupWorkflow, { workflowId: parentId });
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId: childId }),
    ).rejects.toThrow("Workflow not found");
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
  });

  it("continues residual nested cleanup asynchronously", async () => {
    const t = createWorkflowHarness();
    const parentId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "cleanup-parent",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      startAsync: true,
    });
    const entries = await t.mutation(conformanceApi.journal.startSteps, {
      workflowId: parentId,
      generationNumber: 0,
      steps: [
        {
          step: {
            kind: "workflow",
            name: "cleanup-child",
            handle: "function://;workflowConformance:terminalFailure",
            inProgress: true,
            argsSize: 0,
            args: {},
            startedAt: Date.now(),
          },
        },
      ],
    });
    const child = entries[0]?.step;
    if (child?.kind !== "workflow" || child.workflowId === undefined) {
      throw new Error("component did not create the cleanup child");
    }
    const childId = child.workflowId;
    await t.mutation(conformanceApi.workflow.cancel, { workflowId: parentId });
    await t.mutation(conformanceApi.cleanupWorkflow, { workflowId: parentId });
    await expect(
      t.query(conformanceApi.workflow.getStatus, { workflowId: childId }),
    ).resolves.toBeDefined();
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    await expect(
      t.query(conformanceApi.workflow.getStatus, { workflowId: childId }),
    ).rejects.toThrow("Workflow not found");
  });

  it("preserves the terminal result when onComplete fails", async () => {
    const t = createWorkflowHarness();
    const callbackFailure = vi.spyOn(console, "error");
    const workflowId = await t.mutation(
      conformanceApi.startFailingOnComplete,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).resolves.toEqual({ type: "completed", result: "preserved" });
    expect(callbackFailure).toHaveBeenCalledWith(
      "Error calling onComplete",
      expect.stringContaining("missingOnComplete"),
    );
    callbackFailure.mockRestore();
    await t.mutation(conformanceApi.cleanupWorkflow, { workflowId });
  });

  it("batches cleanup for a journal larger than the component limit", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "cleanup-batches",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      startAsync: true,
    });
    await t.mutation(conformanceApi.journal.startSteps, {
      workflowId,
      generationNumber: 0,
      steps: Array.from({ length: 300 }, (_, index) => ({
        step: completedMutationStep(`step-${index}`),
      })),
    });
    await t.mutation(conformanceApi.workflow.complete, {
      workflowId,
      generationNumber: 0,
      runResult: { kind: "success", returnValue: "preserved" },
    });
    await expect(
      t.mutation(conformanceApi.cleanupWorkflow, { workflowId }),
    ).resolves.toBe(true);
    await t.finishAllScheduledFunctions(vi.runOnlyPendingTimers);
    const residual = await t.query(conformanceApi.workflow.listSteps, {
      workflowId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 400 },
    });
    expect(residual.page).toEqual([]);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).rejects.toThrow("Workflow not found");
  });
});

const compilerMappingGraph = (): DurableWorkflowGraph => {
  const node = (
    id: string,
    kind: DurableWorkflowGraph["nodes"][number]["kind"],
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    kind,
    label: id,
    retry: { maxAttempts: 1, backoffMs: 0 },
    ...extra,
  });
  const ids = [
    "source",
    "query",
    "mutation",
    "action",
    "delay",
    "approval",
    "output",
  ] as const;
  return {
    id: "compiler-mapping",
    version: 1,
    startNodeId: "source",
    nodes: [
      node("source", "source"),
      node("query", "capability", { capability: "query" }),
      node("mutation", "capability", { capability: "mutation" }),
      node("action", "capability", { capability: "action" }),
      node("delay", "delay", { delayMs: 25 }),
      node("approval", "approval"),
      node("output", "output"),
    ] as DurableWorkflowGraph["nodes"],
    edges: ids.slice(0, -1).map((sourceNodeId, index) => ({
      id: `${sourceNodeId}-${ids[index + 1]}`,
      sourceNodeId,
      targetNodeId: ids[index + 1] ?? "output",
    })),
    joins: [],
  };
};

const capabilityRef = Schema.decodeSync(WorkflowCapabilityReference)(
  "capability.billingCharge.v2",
);

const childWorkflowRef = Schema.decodeSync(WorkflowReference)(
  "workflow.childReceipt.v3",
);
const nestedWorkflowRef = Schema.decodeSync(WorkflowReference)(
  "workflow.nestedReceipt.v4",
);
type ChildArgs = {
  readonly requestId: string;
  readonly principal: WorkflowPrincipal;
};
type ChildResult = { readonly receiptId: string };
const childHandlerRef =
  "workflow.childReceipt.v3.handler" as unknown as DurableGraphWorkflowRef<
    ChildArgs,
    ChildResult
  >;
const childResultSchema = Schema.Struct({ receiptId: Schema.String });
const childPrincipal = {
  version: 1,
  kind: "user",
  workspaceId: "workspace-1",
  actorId: "actor-1",
  role: "member",
  authEpoch: 4,
  provenance: "kickoff.fixture",
  grants: ["workflow:run", "brief:read"],
  kickoffAt: 1,
} as const satisfies WorkflowPrincipal;
const childLinkReserveRef =
  "workflows.subworkflowLinks.reserve" as unknown as DurableGraphStepRef<"mutation">;
const childLinkReconcileRef =
  "workflows.subworkflowLinks.reconcile" as unknown as DurableGraphStepRef<"mutation">;
const childWorkflowRegistry = defineWorkflowV2SubworkflowRegistry({
  [childWorkflowRef]: defineWorkflowV2Subworkflow({
    version: 3,
    ref: childHandlerRef,
    mapArgs: ({ inputs }) => ({
      requestId: String((inputs as { requestId?: unknown }).requestId),
    }),
    resultSchema: childResultSchema,
    principal: { kind: "inherit" },
    lifecycle: { cancel: "cascade", cleanup: "cascade-async" },
    children: [],
    links: {
      reserveRef: childLinkReserveRef,
      reconcileRef: childLinkReconcileRef,
    },
  }),
});
const childWorkflowEntry = readChildWorkflowEntry();

const childLinkProjection = (): SubworkflowRunLinkProjection => ({
  workspaceId: "workspace-1",
  parentWorkflowId: "run-1",
  parentWorkflowVersion: 2,
  generation: 0,
  childWorkflow: childWorkflowRef,
  childWorkflowVersion: 3,
  stepName: Schema.decodeSync(WorkflowStepName)("child.v3"),
  principal: childPrincipal,
  cancellation: "cascade",
  cleanup: "cascade-async",
});

function readChildWorkflowEntry() {
  const entry = Object.values(childWorkflowRegistry)[0];
  if (!entry) throw new Error("child workflow fixture requires an entry");
  return entry;
}

const guards = {
  approval: { kind: "required", evidenceRef: "approval.fixture" },
  quotaRate: { kind: "required", evidenceRef: "quota.fixture" },
  spendKillSwitch: { kind: "required", evidenceRef: "spend.fixture" },
} as const;

const providerNativeContract = {
  strategy: "provider-native",
  effectClass: "external",
  keyArgumentPath: "logicalEffectKey",
  providerEvidenceRef: "provider.fixture",
  duplicateDeliveryFixtureRef: "provider.duplicate.fixture",
  ambiguityResolution: { kind: "exact-provider-key-replay" },
  dedupeRetentionMs: 200,
  maxRetryWindowMs: 100,
  maxRestartWindowMs: 100,
  redactionPolicyRef: "redaction.fixture",
  guards,
} satisfies WorkflowEffectContract;

const nonRetriableContract = {
  strategy: "non-retriable",
  effectClass: "external",
  reason: "provider has no safe dedupe contract",
  ambiguousOutcome: "manual-review",
  redactionPolicyRef: "redaction.fixture",
  guards,
} satisfies WorkflowEffectContract;

const externalAuthorization = {
  kind: "consequential",
  requiredGrants: ["billing:charge"],
  boundary: "generated-current-authority",
} as const;

const generatedWorkflowContractRefs = {
  compilerV2: {
    authorizeConsequential: {
      functionNamespace: "workflowContracts/compilerV2",
      functionSpec: { name: "authorizeConsequential" },
    },
  },
} as const;

const generatedCurrentAuthority = defineGeneratedCurrentAuthorityBinding(
  { id: "compiler-v2", version: 2 },
  generatedWorkflowContractRefs,
);

const currentAuthorityReceipt = {
  kind: "workflow-current-authority",
  version: 1,
  workspaceId: "workspace-1",
  actorId: "user-1",
  authEpoch: 2,
  capability: capabilityRef,
  workflowId: "compiler-v2",
  workflowVersion: 2,
  requiredGrants: ["billing:charge"],
} as const;

const v2CapabilityGraph = (
  functionKind: "action" | "query" | "mutation",
  retry?: { maxAttempts: number; initialBackoffMs: number; base: number },
): DurableWorkflowGraphV2 => ({
  schemaVersion: 2,
  id: "compiler-v2",
  version: 2,
  startNodeId: "source",
  argsSchemaName: "compiler.v2.args",
  returnSchemaName: "compiler.v2.returns",
  principalSchemaName: "workflow.principal.v1",
  policyPosture: { kind: "none", reason: "fixture" },
  kickoffProfiles: [{ name: "queued", mode: "queued", default: true }],
  unstableArgs: { enabled: false },
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Source",
      stepName: "start.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
    functionKind === "action"
      ? {
          id: "charge",
          kind: "capability",
          functionKind,
          capability: capabilityRef,
          label: "Charge",
          stepName: "charge.v2",
          payloadPolicy,
          semanticRuleIds: [],
          ...(retry ? { retry } : {}),
        }
      : {
          id: "charge",
          kind: "capability",
          functionKind,
          capability: capabilityRef,
          label: "Read charge",
          stepName: "charge.v2",
          payloadPolicy,
          semanticRuleIds: [],
          transaction: { kind: "independent" },
        },
    {
      id: "output",
      kind: "output",
      label: "Output",
      stepName: "output.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
  ],
  edges: [
    { id: "source-charge", sourceNodeId: "source", targetNodeId: "charge" },
    { id: "charge-output", sourceNodeId: "charge", targetNodeId: "output" },
  ],
  joins: [],
});

const v2InlineGraph = (
  functionKind: "query" | "mutation",
  transaction:
    | ReturnType<typeof inlineTransactionPreset>
    | ReturnType<typeof reviewedInlineTransaction>,
): DurableWorkflowGraphV2 => {
  const graph = v2CapabilityGraph(functionKind);
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.kind === "capability" ? { ...node, transaction } : node,
    ),
  };
};

const v2SubworkflowNode = (maxInputBytes = 1024) => ({
  id: "child",
  kind: "subworkflow" as const,
  workflow: childWorkflowRef,
  childVersion: 3,
  label: "Child receipt",
  stepName: Schema.decodeSync(WorkflowStepName)("child.v3"),
  payloadPolicy: { ...payloadPolicy, maxInputBytes },
  semanticRuleIds: ["WF-NODE-SUBWORKFLOW", "WF-NODE-CHILD-VERSION"] as const,
});

const v2SubworkflowGraph = (maxInputBytes = 1024): DurableWorkflowGraphV2 => {
  const { source, output, ...graph } = v2SubworkflowTemplate();
  return {
    ...graph,
    nodes: [source, v2SubworkflowNode(maxInputBytes), output],
    edges: [
      { id: "source-child", sourceNodeId: "source", targetNodeId: "child" },
      { id: "child-output", sourceNodeId: "child", targetNodeId: "output" },
    ],
  };
};

const v2SubworkflowTemplate = () => {
  const graph = v2CapabilityGraph("query");
  const source = graph.nodes.find((node) => node.kind === "source");
  const output = graph.nodes.find((node) => node.kind === "output");
  if (!source || !output)
    throw new Error("subworkflow fixture requires endpoints");
  return { ...graph, source, output };
};

const v2ParallelGraph = (): DurableWorkflowGraphV2 => ({
  ...v2CapabilityGraph("query"),
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Source",
      stepName: "start.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
    ...(["branchA", "branchB"] as const).map((id) => ({
      id,
      kind: "capability" as const,
      functionKind: "query" as const,
      capability: capabilityRef,
      label: id,
      stepName: `${id}.v2`,
      payloadPolicy,
      semanticRuleIds: [],
      transaction: { kind: "independent" as const },
    })),
    {
      id: "output",
      kind: "output",
      label: "Output",
      stepName: "output.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
  ],
  edges: [
    { id: "source-a", sourceNodeId: "source", targetNodeId: "branchA" },
    { id: "source-b", sourceNodeId: "source", targetNodeId: "branchB" },
    { id: "a-output", sourceNodeId: "branchA", targetNodeId: "output" },
    { id: "b-output", sourceNodeId: "branchB", targetNodeId: "output" },
  ],
  joins: [
    {
      nodeId: "output",
      strategy: "all-successful",
      sourceNodeIds: ["branchA", "branchB"],
    },
  ],
});

const v2ConditionalGraph = (): DurableWorkflowGraphV2 => ({
  ...v2ParallelGraph(),
  edges: [
    {
      id: "source-a",
      sourceNodeId: "source",
      targetNodeId: "branchA",
      condition: { expression: "inputs.route === 'A'" },
    },
    {
      id: "source-b",
      sourceNodeId: "source",
      targetNodeId: "branchB",
      condition: { expression: "inputs.route === 'B'" },
    },
    { id: "a-output", sourceNodeId: "branchA", targetNodeId: "output" },
    { id: "b-output", sourceNodeId: "branchB", targetNodeId: "output" },
  ],
  joins: [],
});

const v2SettledFailureGraph = (): DurableWorkflowGraphV2 => ({
  ...v2ParallelGraph(),
  edges: [
    { id: "source-a", sourceNodeId: "source", targetNodeId: "branchA" },
    { id: "source-b", sourceNodeId: "source", targetNodeId: "branchB" },
    { id: "a-output", sourceNodeId: "branchA", targetNodeId: "output" },
    {
      id: "b-output-success",
      sourceNodeId: "branchB",
      targetNodeId: "output",
    },
    {
      id: "b-output-error",
      sourceNodeId: "branchB",
      targetNodeId: "output",
    },
  ],
});

const v2OverBudgetGraph = (): DurableWorkflowGraphV2 => {
  const template = v2ParallelGraph();
  const source = template.nodes.find((node) => node.kind === "source");
  const output = template.nodes.find((node) => node.kind === "output");
  if (!source || !output)
    throw new Error("parallel fixture requires endpoints");
  const branches = Array.from({ length: 5 }, (_, index) => ({
    id: `branch${index}`,
    kind: "capability" as const,
    functionKind: "query" as const,
    capability: capabilityRef,
    label: `Branch ${index}`,
    stepName: Schema.decodeSync(WorkflowStepName)(`branch${index}.v2`),
    payloadPolicy,
    semanticRuleIds: [],
    transaction: { kind: "independent" as const },
  }));
  return {
    ...template,
    nodes: [source, ...branches, output],
    edges: [
      ...branches.map((branch) => ({
        id: `source-${branch.id}`,
        sourceNodeId: "source",
        targetNodeId: branch.id,
      })),
      ...branches.map((branch) => ({
        id: `${branch.id}-output`,
        sourceNodeId: branch.id,
        targetNodeId: "output",
      })),
    ],
    joins: [
      {
        nodeId: "output",
        strategy: "all-successful",
        sourceNodeIds: branches.map((branch) => branch.id),
      },
    ],
  };
};

const payloadPolicy = {
  maxInputBytes: 1024,
  maxResultBytes: 1024,
  resultMode: "inline",
} as const;

const v2Input = (graph: DurableWorkflowGraphV2) => ({
  graph,
  inputs: { workspaceId: "workspace-1" },
  principal: eventPrincipal,
  policySnapshot: { kind: "none" },
  effectIdentity: {
    workspaceId: "workspace-1",
    workflowRunId: "run-1",
    generation: 0,
    occurredAt: 1,
  },
  subworkflowPolicy: { maxDepth: 4, maxFanOut: 8 },
  projectOutput: ({
    context,
  }: {
    context: Readonly<Record<string, unknown>>;
  }) => ({
    status: "completed",
    context,
  }),
});

const v2ExternalInput = (graph: DurableWorkflowGraphV2) => ({
  ...v2Input(graph),
  currentAuthority: generatedCurrentAuthority,
  principal: {
    version: 2,
    kind: "user",
    workspaceId: "workspace-1",
    grants: ["billing:charge"],
    kickoffAt: 1,
    actorId: "user-1",
    role: "editor",
    authEpoch: 1,
    provenance: "authenticated-workflow-start",
  } as const,
});

const v2Step = (
  overrides: Partial<RunDurableGraphStep>,
): RunDurableGraphStep => ({
  runQuery: async (ref) =>
    ref === generatedCurrentAuthority.ref ? currentAuthorityReceipt : undefined,
  runMutation: async (ref) =>
    ref === childLinkReserveRef ? { linkId: "link-1" } : null,
  runAction: async () => undefined,
  runWorkflow: async () => undefined,
  sleep: async () => undefined,
  awaitEvent: async () => {
    throw new Error("V2 capability fixture does not await events.");
  },
  ...overrides,
});

const completedMutationStep = (name: string) => ({
  kind: "function" as const,
  functionType: "mutation" as const,
  handle: "function://;workflowConformance:echoStep",
  name,
  inProgress: false,
  argsSize: 0,
  args: { value: name },
  runResult: { kind: "success" as const, returnValue: name },
  startedAt: Date.now(),
  completedAt: Date.now(),
});
