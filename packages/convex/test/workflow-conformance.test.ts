import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNonRetryableError } from "@convex-dev/workpool";
import type { EventId as ComponentEventId } from "@convex-dev/workflow";
import { getConvexSize, v } from "convex/values";
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
} from "../confect/workflows/graphCurrent";
import {
  runDurableGraphWorkflow,
  runDurableGraphWorkflowV2,
  type DurableGraphStepRef,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunnerCurrent";
import {
  defineGeneratedCurrentAuthorityBinding,
  type GeneratedCurrentAuthorityBinding,
} from "../confect/workflows/_kit/graphRunnerV2Current";
import {
  defineWorkflowV2SubworkflowRegistry,
  runRegisteredSubworkflow,
  scheduledSubworkflowFinding,
  type DurableGraphWorkflowRef,
  type WorkflowV2SubworkflowRegistryEntry,
} from "../confect/workflows/_kit/subworkflows";
import {
  defineWorkflowV2Subworkflow,
  defineWorkflowV2SubworkflowRegistry as defineCurrentWorkflowV2SubworkflowRegistry,
  validateWorkflowV2SubworkflowTopology,
  type WorkflowV2BoundedBatchBinding,
} from "../confect/workflows/_kit/subworkflowsCurrent";
import {
  activateSubworkflowRunLinkState,
  buildSubworkflowRunLinkRow,
  childWorkflowRunIdFromLink,
  reconcileSubworkflowRunLinkState,
  subworkflowRunLinkIdempotencyKey,
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
import type { DurableWorkflowPrincipal } from "../confect/workflows/_kit/principal";
import type { WorkflowPolicySnapshot } from "../confect/workflows/_kit/policySnapshot";
import type { WorkflowEffectContract } from "../confect/workflows/_kit/effectReservations";
import {
  bindObservedWorkflowAuthority,
  loadObservedWorkflowExecutionIdentity,
  runObservedWorkflowStage,
} from "../confect/workflows/_kit/observedStageCurrent";
import {
  PINNED_INLINE_CONVEX_VERSION,
  inlineTransactionPreset,
  reviewedInlineTransaction,
} from "../confect/workflows/_kit/inlineTransactions";
import { workflowFailurePolicy } from "../confect/workflows/_kit/failurePolicy";
import {
  definePublicationRegistry,
  defineWorkflowRelease,
  publicationTestOnly,
  type ChecksummedModule,
  type GeneratedPublicationAuthority,
  type WorkflowRelease,
} from "../confect/workflows/_kit/publicationCurrent";
import { sha256Hex } from "../confect/shared/sha256";

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
  failurePolicy: { kind: "fail" },
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
  it.each([
    [
      "agent",
      (() => {
        const graph = v2CapabilityGraph("query");
        return {
          ...graph,
          nodes: graph.nodes.map((node) =>
            node.kind === "capability"
              ? {
                  id: node.id,
                  kind: "agent" as const,
                  agent: capabilityRef,
                  label: node.label,
                  stepName: node.stepName,
                  payloadPolicy: node.payloadPolicy,
                  semanticRuleIds: node.semanticRuleIds,
                  failurePolicy: { kind: "fail" as const },
                  schedule: { kind: "runAfter" as const, delayMs: 100 },
                }
              : node,
          ),
        } satisfies DurableWorkflowGraphV2;
      })(),
    ],
    [
      "inline query",
      (() => {
        const graph = v2InlineGraph("query", inlineTransactionPreset("tiny"));
        return {
          ...graph,
          nodes: graph.nodes.map((node) =>
            node.kind === "capability"
              ? {
                  ...node,
                  schedule: { kind: "runAfter" as const, delayMs: 100 },
                }
              : node,
          ),
        } as DurableWorkflowGraphV2;
      })(),
    ],
  ] as const)(
    "rejects a scheduled %s at the direct runtime boundary",
    async (_name, graph) => {
      const runQuery = vi.fn(async () => ({ unreachable: true }));

      await expect(
        runDurableGraphWorkflowV2(v2Step({ runQuery }), v2Input(graph)),
      ).rejects.toThrow("Workflow graph V2 failed validation.");
      expect(runQuery).not.toHaveBeenCalled();
    },
  );

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
        admitEffect: async () => ({
          kind: "deny" as const,
          reason: "not used",
        }),
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
            ? Promise.resolve({
                _tag: "WorkflowSettledFailure" as const,
                code: "BRANCH_REJECTED",
                message: "Branch could not complete.",
              })
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

  it("preserves an unexpected system rejection instead of routing it", async () => {
    const systemFailure = new Error("database transport unavailable");
    const runQuery = vi.fn(
      async (...[, args]: [unknown, Record<string, unknown>]) =>
        String(args.nodeId) === "branchB"
          ? Promise.reject(systemFailure)
          : { branch: "A", committed: true },
    );
    const projectOutput = vi.fn(() => ({ status: "unreachable" }));

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(v2SettledFailureGraph()),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "query",
            ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
            effectClass: "none",
            buildArgs: ({ node }) => ({ nodeId: node.id }),
          },
        },
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        projectOutput,
      }),
    ).rejects.toBe(systemFailure);
    expect(projectOutput).not.toHaveBeenCalled();
  });

  it("defers every domain route in a mixed wave until the system rejection can restart", async () => {
    const systemFailure = new Error("database transport unavailable");
    const journal = new Map<string, unknown>();
    let failSystemSiblingOnce = true;
    const runQuery = vi.fn(
      async (
        ...[, args, options]: [
          unknown,
          Record<string, unknown>,
          { name?: string }?,
        ]
      ) => {
        const name = String(options?.name);
        if (journal.has(name)) return journal.get(name);
        const nodeId = String(args.nodeId);
        if (nodeId === "branchA" && failSystemSiblingOnce) {
          failSystemSiblingOnce = false;
          throw systemFailure;
        }
        const result =
          nodeId === "branchB"
            ? {
                _tag: "WorkflowSettledFailure" as const,
                code: "BRANCH_REJECTED",
                message: "Branch could not complete.",
              }
            : { branch: "A", committed: true };
        journal.set(name, result);
        return result;
      },
    );
    const runAction = vi.fn(async () => ({ compensated: true }));
    const input = {
      ...v2Input(v2MixedWaveCompensationGraph()),
      capabilityRegistry: compensationCapabilityRegistry(),
      admitEffect: async () => ({ kind: "dispatch" as const }),
    };

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).rejects.toBe(systemFailure);
    expect(runAction).not.toHaveBeenCalled();

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).resolves.toMatchObject({
      context: {
        branchB: { code: "BRANCH_REJECTED" },
      },
    });
    expect(runAction).toHaveBeenCalledTimes(1);
  });

  it("compensates completed steps in reverse order and resumes idempotently after a compensation failure", async () => {
    const graph = v2CompensationGraph();
    const queryJournal = new Map<string, unknown>();
    const actionJournal = new Map<string, unknown>();
    const queryExecutions: string[] = [];
    const actionExecutions: string[] = [];
    let failCompensationOnce = true;
    const runQuery = vi.fn(
      async (
        ...[, args, options]: [
          unknown,
          Record<string, unknown>,
          { name?: string }?,
        ]
      ) => {
        const name = String(options?.name);
        if (queryJournal.has(name)) return queryJournal.get(name);
        const nodeId = String(args.nodeId);
        queryExecutions.push(nodeId);
        const result =
          nodeId === "failure"
            ? {
                _tag: "WorkflowSettledFailure" as const,
                code: "ORDER_REJECTED",
                message: "Order could not complete.",
              }
            : { completed: nodeId };
        queryJournal.set(name, result);
        return result;
      },
    );
    const compensationFailure = new Error("compensation transport unavailable");
    const runAction = vi.fn(
      async (...[, , options]: [unknown, unknown, { name?: string }?]) => {
        const name = String(options?.name);
        if (actionJournal.has(name)) return actionJournal.get(name);
        actionExecutions.push(name);
        if (name === "compensate-second.v2" && failCompensationOnce) {
          failCompensationOnce = false;
          throw compensationFailure;
        }
        const result = { compensated: name, detail: "x".repeat(512) };
        actionJournal.set(name, result);
        return result;
      },
    );
    const input = {
      ...v2Input(graph),
      capabilityRegistry: compensationCapabilityRegistry(),
      admitEffect: async () => ({ kind: "dispatch" as const }),
    };

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).rejects.toBe(compensationFailure);
    expect(actionExecutions).toEqual([
      "compensate-failure.v2",
      "compensate-second.v2",
    ]);

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).resolves.toMatchObject({
      context: {
        failure: {
          _tag: "WorkflowSettledFailure",
          code: "ORDER_REJECTED",
        },
      },
    });
    expect(queryExecutions).toEqual(["first", "second", "failure"]);
    expect(actionExecutions).toEqual([
      "compensate-failure.v2",
      "compensate-second.v2",
      "compensate-second.v2",
      "compensate-first.v2",
    ]);
  });

  it("does not run compensations for cancellation or another runtime rejection", async () => {
    const cancellation = new Error("Canceled");
    const runQuery = vi.fn(
      async (...[, args]: [unknown, Record<string, unknown>]) =>
        String(args.nodeId) === "failure"
          ? Promise.reject(cancellation)
          : { completed: String(args.nodeId) },
    );
    const runAction = vi.fn(async () => ({ compensated: true }));

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), {
        ...v2Input(v2CompensationGraph()),
        capabilityRegistry: compensationCapabilityRegistry(),
        admitEffect: async () => ({ kind: "dispatch" }),
      }),
    ).rejects.toBe(cancellation);
    expect(runAction).not.toHaveBeenCalled();
  });

  it("treats a typed compensation result as a replay-stable failed compensation", async () => {
    const graph = v2CompensationGraph();
    const queryJournal = new Map<string, unknown>();
    const actionJournal = new Map<string, unknown>();
    const actionExecutions: string[] = [];
    let compensationCanSucceed = false;
    const runQuery = vi.fn(
      async (
        ...[, args, options]: [
          unknown,
          Record<string, unknown>,
          { name?: string }?,
        ]
      ) => {
        const name = String(options?.name);
        if (queryJournal.has(name)) return queryJournal.get(name);
        const nodeId = String(args.nodeId);
        const result =
          nodeId === "failure"
            ? {
                _tag: "WorkflowSettledFailure" as const,
                code: "ORDER_REJECTED",
                message: "Order could not complete.",
              }
            : { completed: nodeId };
        queryJournal.set(name, result);
        return result;
      },
    );
    const typedCompensationFailure = {
      _tag: "WorkflowSettledFailure" as const,
      code: "COMPENSATION_REJECTED",
      message: "Compensation could not complete.",
    };
    const runAction = vi.fn(
      async (...[, , options]: [unknown, unknown, { name?: string }?]) => {
        const name = String(options?.name);
        if (actionJournal.has(name)) return actionJournal.get(name);
        actionExecutions.push(name);
        const result =
          name === "compensate-second.v2" && !compensationCanSucceed
            ? typedCompensationFailure
            : { compensated: name };
        actionJournal.set(name, result);
        return result;
      },
    );
    const input = {
      ...v2Input(graph),
      capabilityRegistry: compensationCapabilityRegistry(),
      admitEffect: async () => ({ kind: "dispatch" as const }),
    };

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).rejects.toMatchObject({
      name: "WorkflowCompensationFailure",
      failure: typedCompensationFailure,
    });
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).rejects.toMatchObject({
      name: "WorkflowCompensationFailure",
      failure: typedCompensationFailure,
    });
    expect(actionExecutions).toEqual([
      "compensate-failure.v2",
      "compensate-second.v2",
    ]);

    compensationCanSucceed = true;
    actionJournal.delete("compensate-second.v2");
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), input),
    ).resolves.toMatchObject({
      context: { failure: { code: "ORDER_REJECTED" } },
    });
    expect(actionExecutions).toEqual([
      "compensate-failure.v2",
      "compensate-second.v2",
      "compensate-second.v2",
      "compensate-first.v2",
    ]);
  });

  it("preserves cancellation identity during compensation and stops the reverse plan", async () => {
    const cancellation = new Error("Canceled");
    const runQuery = vi.fn(
      async (...[, args]: [unknown, Record<string, unknown>]) =>
        String(args.nodeId) === "failure"
          ? {
              _tag: "WorkflowSettledFailure" as const,
              code: "ORDER_REJECTED",
              message: "Order could not complete.",
            }
          : { completed: String(args.nodeId) },
    );
    const compensationNames: string[] = [];
    const runAction = vi.fn(
      async (...[, , options]: [unknown, unknown, { name?: string }?]) => {
        const name = String(options?.name);
        compensationNames.push(name);
        if (name === "compensate-second.v2") throw cancellation;
        return { compensated: name };
      },
    );

    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery, runAction }), {
        ...v2Input(v2CompensationGraph()),
        capabilityRegistry: compensationCapabilityRegistry(),
        admitEffect: async () => ({ kind: "dispatch" }),
      }),
    ).rejects.toBe(cancellation);
    expect(compensationNames).toEqual([
      "compensate-failure.v2",
      "compensate-second.v2",
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
        ref === childLinkReserveRef
          ? { linkId: "link-1", childWorkflowRunId: "child-run-1" }
          : null,
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
        idempotencyKey: "run-1:2:0:child.v3:workflow.childReceipt.v3:3",
        requestId: "request-1",
        subworkflow: {
          generation: 0,
          linkId: "link-1",
          parentComponentWorkflowId: "component-parent",
          parentWorkflowRunId: "run-1",
          reservedAt: 1,
        },
        principal: childPrincipal,
        policySnapshot: childPolicySnapshot,
        workflowRunId: "child-run-1",
        workspaceId: "workspace-1",
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
            receipt: {
              kind: "bounded-inline",
              measuredBytes: expect.any(Number),
              contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
          },
          occurredAt: 1,
        },
        { name: "child.v3.link.reconcile.v1" },
      ],
    ]);
    expect(JSON.stringify(runMutation.mock.calls[1]?.[1])).not.toContain(
      "child-receipt",
    );
  });

  it("fails closed before reserving a child when the parent component identity is unavailable", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const runMutation = vi.fn(async () => ({ linkId: "unreachable" }));
    const stepWithoutIdentity = { ...v2Step({ runWorkflow, runMutation }) };
    delete stepWithoutIdentity.workflowId;
    await expect(
      runDurableGraphWorkflowV2(stepWithoutIdentity, {
        ...v2Input(v2SubworkflowGraph()),
        principal: childPrincipal,
        workflowRegistry: childWorkflowRegistry,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/parent component identity is unavailable/);
    expect(runMutation).not.toHaveBeenCalled();
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it("rejects a registry key whose version differs from its binding", () => {
    const wrongVersion = Schema.decodeSync(WorkflowReference)(
      "workflow.childReceipt.v2",
    );
    expect(() =>
      defineWorkflowV2SubworkflowRegistry(childPublicationRegistry, {
        [wrongVersion]: childWorkflowDefinition(),
      }),
    ).toThrow(/publication binding is unavailable/);
  });

  it("derives child runtime authority from the immutable publication registry", () => {
    expect(childWorkflowEntry).toMatchObject({
      version: childPublication.release.version,
      ref: childPublication.release.runner.ref,
      children: childPublication.release.subworkflowBindings,
      lifecycle: {
        cancel: "restricted",
        cleanup: "restricted",
        contractVersion: childPublication.release.lifecycleContractVersion,
      },
      publication: {
        workflowId: childPublication.release.workflowId,
        graphJson: childPublication.graphJson,
        argumentMapper: {
          module: childPublication.argumentMapperModule,
          schemaName: "workflow.childReceipt.v3.args",
        },
        resultSchema: {
          module: childPublication.resultSchemaModule,
          schemaName: "workflow.childReceipt.v3.result",
        },
        releaseChecksum: childPublication.release.releaseChecksum,
        graphHash: childPublication.release.graphHash,
        runnerModule: childPublication.release.runner.module,
        runnerFunctionReference:
          childPublication.release.runner.functionReference,
      },
    });
    expect(Object.isFrozen(childWorkflowRegistry)).toBe(true);
    expect(() =>
      defineWorkflowV2SubworkflowRegistry(childPublicationRegistry, {
        [childWorkflowRef]: {
          ...childWorkflowDefinition(),
          mapArgs: ({ inputs }) => ({
            requestId: `forged:${String(
              (inputs as { requestId?: unknown }).requestId,
            )}`,
          }),
        },
      }),
    ).toThrow(/immutable release/);
    expect(() =>
      defineWorkflowV2SubworkflowRegistry(childPublicationRegistry, {
        [childWorkflowRef]: {
          ...childWorkflowDefinition(),
          resultSchema: Schema.Struct({ forged: Schema.Boolean }),
        },
      }),
    ).toThrow(/immutable release/);
    expect(() =>
      defineWorkflowV2SubworkflowRegistry(childPublicationRegistry, {
        [childWorkflowRef]: {
          ...childWorkflowDefinition(),
          publication: {
            ...childWorkflowDefinition().publication,
            argumentMapper: {
              ...childWorkflowDefinition().publication.argumentMapper,
              exportName: "attackerMapper",
            },
          },
        },
      }),
    ).toThrow(/immutable release/);
    expect(() =>
      defineWorkflowV2SubworkflowRegistry(childPublicationRegistry, {
        [childWorkflowRef]: {
          ...childWorkflowDefinition(),
          publication: {
            ...childWorkflowDefinition().publication,
            resultSchema: {
              ...childWorkflowDefinition().publication.resultSchema,
              exportName: "attackerSchema",
            },
          },
        },
      }),
    ).toThrow(/immutable release/);
    const childSubworkflowRuntime = childPublication.release.subworkflowRuntime;
    if (childSubworkflowRuntime === undefined) {
      throw new Error("expected the child fixture to be a subworkflow");
    }
    const forgedGraphJson = childPublication.graphJson.replace(
      '"nodes":[]',
      '"nodes":[{"id":"attacker"}]',
    );
    expect(() =>
      definePublicationRegistry({
        capabilities: [],
        workflows: [
          {
            ...childPublication.release,
            subworkflowRuntime: {
              ...childSubworkflowRuntime,
              graphJson: forgedGraphJson,
              graphSnapshotHash: sha256Hex(forgedGraphJson),
            },
          },
        ],
      }),
    ).toThrow(/checksum does not match generated descriptor/);
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
    const registry = {
      [childWorkflowRef]: {
        ...childWorkflowEntry,
        children,
      },
      [nestedWorkflowRef]: {
        ...childWorkflowEntry,
        version: 4,
        children: [],
      },
    };

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
    const row = buildSubworkflowRunLinkRow(projection, 10, "child-run-1");
    expect(row).toMatchObject({
      workspaceId: "workspace-1",
      parentWorkflowId: "run-1",
      childWorkflowId: null,
      relationKind: "subworkflow",
      relationId: "child.v3",
      status: "starting",
    });
    expect(JSON.parse(row.parentKind)).toEqual({
      schemaVersion: 2,
      workflowRunId: "run-1",
      componentWorkflowId: "component-parent",
      workflowVersion: 2,
      generation: 0,
      principal: childPrincipal,
    });
    expect(JSON.parse(row.childKind)).toEqual({
      schemaVersion: 2,
      workflow: childWorkflowRef,
      workflowVersion: 3,
      graphJson: childPublication.graphJson,
      releaseChecksum: childPublication.release.releaseChecksum,
      principal: childPrincipal,
      policySnapshot: childPolicySnapshot,
      childWorkflowRunId: "child-run-1",
    });

    const first = reconcileSubworkflowRunLinkState(
      row,
      {
        kind: "succeeded",
        receipt: {
          kind: "bounded-inline",
          measuredBytes: 31,
          contentHash: "a".repeat(64),
        },
      },
      11,
    );
    const replay = reconcileSubworkflowRunLinkState(
      first,
      {
        kind: "succeeded",
        receipt: {
          kind: "bounded-inline",
          measuredBytes: 31,
          contentHash: "a".repeat(64),
        },
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

  it("keys child reservation by the parent product run while preserving replay", () => {
    const first = childLinkProjection();
    const replay = { ...first };
    const independentParent = {
      ...first,
      parentWorkflowRunId: "run-2",
    };

    expect(subworkflowRunLinkIdempotencyKey(replay)).toBe(
      subworkflowRunLinkIdempotencyKey(first),
    );
    expect(subworkflowRunLinkIdempotencyKey(independentParent)).not.toBe(
      subworkflowRunLinkIdempotencyKey(first),
    );
  });

  it("dual-decodes historical child-kind rows without inventing a product run", () => {
    expect(childWorkflowRunIdFromLink({ childKind: "workflow" })).toBeNull();
    expect(
      childWorkflowRunIdFromLink({
        childKind: JSON.stringify({ childWorkflowRunId: "child-run-1" }),
      }),
    ).toBe("child-run-1");
  });

  it("binds the exact child component identity once and rejects conflicting activation", () => {
    const row = buildSubworkflowRunLinkRow(
      childLinkProjection(),
      10,
      "child-run-1",
    );
    const running = activateSubworkflowRunLinkState(
      row,
      {
        workspaceId: "workspace-1",
        parentWorkflowRunId: "run-1",
        parentComponentWorkflowId: "component-parent",
        childComponentWorkflowId: "component-child",
        childWorkflowRunId: "child-run-1",
        generation: 0,
      },
      11,
    );
    expect(running).toMatchObject({
      childWorkflowId: "component-child",
      status: "running",
      updatedAt: 11,
    });
    expect(
      activateSubworkflowRunLinkState(
        running,
        {
          workspaceId: "workspace-1",
          parentWorkflowRunId: "run-1",
          parentComponentWorkflowId: "component-parent",
          childComponentWorkflowId: "component-child",
          childWorkflowRunId: "child-run-1",
          generation: 0,
        },
        12,
      ),
    ).toBe(running);
    expect(() =>
      activateSubworkflowRunLinkState(
        running,
        {
          workspaceId: "workspace-1",
          parentWorkflowRunId: "run-other",
          parentComponentWorkflowId: "component-parent",
          childComponentWorkflowId: "component-other",
          childWorkflowRunId: "child-run-1",
          generation: 0,
        },
        12,
      ),
    ).toThrow(/activation ownership mismatch/);
  });

  it("activates a generated child before loading its product execution identity", async () => {
    const calls: string[] = [];
    const activateRef =
      "workflows.subworkflowLinks.activate" as unknown as DurableGraphStepRef<"mutation">;
    const executionIdentityRef =
      "workflows.stageObservations.executionIdentity" as unknown as DurableGraphStepRef<"query">;
    const runMutation = vi.fn(async () => {
      calls.push("activate");
      return {
        status: "running",
        principal: childPrincipal,
        policySnapshot: childPolicySnapshot,
      };
    });
    const runQuery = vi.fn(async () => {
      calls.push("load");
      return { generation: 0, observedAt: 1 };
    });

    const executionIdentity = await loadObservedWorkflowExecutionIdentity(
      v2Step({
        workflowId: "component-child" as NonNullable<
          RunDurableGraphStep["workflowId"]
        >,
        runMutation,
        runQuery,
      }),
      executionIdentityRef,
      {
        workspaceId: "workspace-1",
        workflowRunId: "child-run-1",
        subworkflow: {
          linkId: "link-1",
          parentWorkflowRunId: "run-1",
          parentComponentWorkflowId: "component-parent",
          generation: 0,
          reservedAt: 1,
        },
        activateSubworkflowRef: activateRef,
      },
    );
    expect(executionIdentity).toEqual({
      generation: 0,
      observedAt: 1,
      authority: {
        principal: childPrincipal,
        policySnapshot: childPolicySnapshot,
      },
    });
    expect(calls).toEqual(["activate", "load"]);
    expect(runMutation).toHaveBeenCalledWith(activateRef, {
      workspaceId: "workspace-1",
      parentWorkflowRunId: "run-1",
      parentComponentWorkflowId: "component-parent",
      childWorkflowRunId: "child-run-1",
      childComponentWorkflowId: "component-child",
      generation: 0,
      linkId: "link-1",
      occurredAt: 1,
    });

    const forgedPrincipal = {
      ...childPrincipal,
      grants: [...childPrincipal.grants, "workflow:admin"],
    };
    expect(
      bindObservedWorkflowAuthority(
        {
          principal: forgedPrincipal,
          policySnapshot: {
            version: 1,
            kind: "none",
            reason: "forged wider policy",
          },
          requestId: "request-1",
        },
        executionIdentity,
      ),
    ).toEqual({
      principal: childPrincipal,
      policySnapshot: childPolicySnapshot,
      requestId: "request-1",
    });
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
          ref === childLinkReserveRef
            ? { linkId: "link-1", childWorkflowRunId: "child-run-1" }
            : null,
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
        cancel: "restricted",
        cleanup: "restricted",
        contractVersion: 1,
      });
      expect(runMutation.mock.calls[1]?.[1]).toMatchObject({
        outcome: { kind: expectedOutcome },
      });
    },
  );

  it.each([
    ["failure", new Error("child failed"), "failed"],
    ["cancellation", new Error("Canceled"), "canceled"],
  ] as const)(
    "preserves child %s when reconciliation fails and reports the secondary outcome",
    async (...row) => {
      const [, primary, primaryOutcome] = row;
      const runWorkflow = vi.fn(async () => Promise.reject(primary));
      const runMutation = vi.fn(
        async (...[ref]: Parameters<RunDurableGraphStep["runMutation"]>) => {
          if (ref === childLinkReserveRef) {
            return { linkId: "link-1", childWorkflowRunId: "child-run-1" };
          }
          if (ref === childLinkReconcileRef) {
            throw new Error("link reconciliation unavailable");
          }
          if (ref === childLinkReportRef) return null;
          throw new Error("unexpected mutation");
        },
      );

      await expect(
        runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
          ...v2Input(v2SubworkflowGraph()),
          principal: childPrincipal,
          workflowRegistry: childWorkflowRegistry,
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        }),
      ).rejects.toBe(primary);
      expect(runMutation).toHaveBeenCalledWith(
        childLinkReportRef,
        {
          workspaceId: "workspace-1",
          linkId: "link-1",
          primaryOutcome,
          issue: "SUBWORKFLOW_LINK_RECONCILIATION_FAILED",
          occurredAt: 1,
        },
        { name: "child.v3.link.reconciliation-failure.v1" },
      );
    },
  );

  it("allows only an explicit grant narrowing for the child principal", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "narrowed" }));
    const narrowedRegistry = defineWorkflowV2SubworkflowRegistry(
      childPublicationRegistry,
      {
        [childWorkflowRef]: childWorkflowDefinition({
          kind: "narrow",
          grants: ["brief:read"],
        }),
      },
    );
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
        idempotencyKey: "run-1:2:0:child.v3:workflow.childReceipt.v3:3",
        requestId: "request-1",
        principal: { ...childPrincipal, grants: ["brief:read"] },
        policySnapshot: childPolicySnapshot,
        subworkflow: {
          generation: 0,
          linkId: "link-1",
          parentComponentWorkflowId: "component-parent",
          parentWorkflowRunId: "run-1",
          reservedAt: 1,
        },
        workflowRunId: "child-run-1",
        workspaceId: "workspace-1",
      },
      { name: "child.v3" },
    );
  });

  it("rejects a child principal that attempts to add a grant", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const wideningRegistry = defineWorkflowV2SubworkflowRegistry(
      childPublicationRegistry,
      {
        [childWorkflowRef]: childWorkflowDefinition({
          kind: "narrow",
          grants: ["workflow:admin"],
        }),
      },
    );
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
        policySnapshot: childPolicySnapshot,
        ownership: {
          workspaceId: "workspace-1",
          parentWorkflowRunId: "run-1",
          parentComponentWorkflowId: "component-parent",
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

  it("rejects an oversized child result before reconciliation or return", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "x".repeat(2_000) }));
    const runMutation = vi.fn(
      async (...[ref]: Parameters<RunDurableGraphStep["runMutation"]>) =>
        ref === childLinkReserveRef
          ? { linkId: "link-1", childWorkflowRunId: "child-run-1" }
          : null,
    );
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
        ...v2Input(v2SubworkflowGraph()),
        inputs: { requestId: "request-1" },
        principal: childPrincipal,
        workflowRegistry: childWorkflowRegistry,
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/child result uses .* above the 1024 bytes limit/);
    expect(runMutation.mock.calls[1]?.[1]).toMatchObject({
      outcome: { kind: "failed" },
    });
  });

  describe("artifact child result budgets", () => {
    const artifactResultSchema = Schema.Struct({
      artifactId: Schema.String,
      contentHash: Schema.String,
      measuredBytes: Schema.Number,
    });
    const artifactPublication = publishedSubworkflowFixture(
      "workflow.childReceipt",
      3,
      childHandlerRef,
      [],
      childArgumentMapper,
      artifactResultSchema,
    );
    const artifactRuntime = artifactPublication.release.subworkflowRuntime;
    if (!artifactRuntime) {
      throw new Error("artifact workflow fixture requires a runtime binding");
    }
    const artifactRegistry = defineWorkflowV2SubworkflowRegistry(
      definePublicationRegistry({
        capabilities: [],
        workflows: [artifactPublication.release],
      }),
      {
        [childWorkflowRef]: defineWorkflowV2Subworkflow<
          ChildArgs,
          Schema.Schema.Type<typeof artifactResultSchema>
        >({
          ...childWorkflowDefinition(),
          resultSchema: artifactResultSchema,
          publication: {
            workflowId: artifactPublication.release.workflowId,
            argumentMapper: {
              module: artifactRuntime.argumentMapper.module,
              exportName: artifactRuntime.argumentMapper.exportName,
              schemaName: artifactRuntime.argumentMapper.schemaName,
            },
            resultSchema: {
              module: artifactRuntime.resultSchema.module,
              exportName: artifactRuntime.resultSchema.exportName,
              schemaName: artifactRuntime.resultSchema.schemaName,
            },
          },
        }),
      },
    );

    const runArtifact = (
      artifact: {
        readonly artifactId: string;
        readonly contentHash: string;
        readonly measuredBytes: number;
      },
      owned: Readonly<Record<string, unknown>>,
      maxResultBytes: number,
    ) => {
      const runWorkflow = vi.fn(async () => artifact);
      const runQuery = vi.fn(async () => owned);
      const runMutation = vi.fn(
        async (...[ref]: Parameters<RunDurableGraphStep["runMutation"]>) =>
          ref === childLinkReserveRef
            ? { linkId: "link-1", childWorkflowRunId: "child-run-1" }
            : null,
      );
      const execution = runDurableGraphWorkflowV2(
        v2Step({ runWorkflow, runMutation, runQuery }),
        {
          ...v2Input(
            v2SubworkflowGraphWithResultPolicy(
              "artifact-reference",
              maxResultBytes,
            ),
          ),
          inputs: { requestId: "request-1" },
          principal: childPrincipal,
          workflowRegistry: artifactRegistry,
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        },
      );
      return { execution, runMutation, runQuery };
    };

    it("accepts an owned artifact above the inline ceiling under the node limit", async () => {
      const content = "x".repeat(70_000);
      const artifact = {
        artifactId: "artifact-1",
        contentHash: sha256Hex(JSON.stringify(content)),
        measuredBytes: getConvexSize(content),
      };
      const { execution, runMutation, runQuery } = runArtifact(
        artifact,
        { ...artifact, content, workflowRunId: "child-run-1" },
        96_000,
      );

      await expect(execution).resolves.toMatchObject({
        context: { child: artifact },
      });
      expect(artifact.measuredBytes).toBeGreaterThan(64_000);
      expect(runQuery).toHaveBeenCalledWith(childArtifactGetOwnedRef, {
        workspaceId: "workspace-1",
        workflowRunId: "child-run-1",
        artifactId: "artifact-1",
      });
      expect(runMutation.mock.calls[1]?.[1]).toMatchObject({
        outcome: {
          kind: "succeeded",
          receipt: {
            kind: "artifact-reference",
            contentHash: artifact.contentHash,
            measuredBytes: getConvexSize(artifact),
          },
        },
      });
    });

    it("rejects an oversized serialized artifact reference before lookup", async () => {
      const artifact = {
        artifactId: `artifact-${"x".repeat(64_000)}`,
        contentHash: "a".repeat(64),
        measuredBytes: 512,
      };
      const { execution, runQuery } = runArtifact(
        artifact,
        { ...artifact, content: "small", workflowRunId: "child-run-1" },
        96_000,
      );

      expect(getConvexSize(artifact)).toBeGreaterThan(64_000);
      await expect(execution).rejects.toThrow(
        /artifact reference uses .* above the 64000 bytes limit/,
      );
      expect(runQuery).toHaveBeenCalledOnce();
    });

    it.each([
      ["size", { measuredBytes: 513 }],
      ["hash", { contentHash: "b".repeat(64) }],
      ["ownership", { workflowRunId: "attacker-run" }],
    ])("rejects forged durable artifact %s metadata", async (_kind, forged) => {
      const artifact = {
        artifactId: "artifact-1",
        contentHash: "a".repeat(64),
        measuredBytes: 512,
      };
      const { execution } = runArtifact(
        artifact,
        {
          ...artifact,
          content: "trusted",
          workflowRunId: "child-run-1",
          ...forged,
        },
        1_024,
      );

      await expect(execution).rejects.toThrow(
        /artifact result failed durable ownership and integrity/,
      );
    });

    it("rejects a stored artifact above the explicit node limit", async () => {
      const content = "x".repeat(70_000);
      const artifact = {
        artifactId: "artifact-1",
        contentHash: sha256Hex(JSON.stringify(content)),
        measuredBytes: getConvexSize(content),
      };
      const { execution, runQuery } = runArtifact(
        artifact,
        { ...artifact, content, workflowRunId: "child-run-1" },
        65_000,
      );

      await expect(execution).rejects.toThrow(
        /stored artifact uses .* above the 65000 bytes node limit/,
      );
      expect(runQuery).toHaveBeenCalledTimes(2);
    });

    it("keeps inline child results capped by the global inline ceiling", async () => {
      const runWorkflow = vi.fn(async () => ({
        receiptId: "x".repeat(64_000),
      }));

      await expect(
        runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
          ...v2Input(v2SubworkflowGraphWithResultPolicy("inline", 128_000)),
          inputs: { requestId: "request-1" },
          principal: childPrincipal,
          workflowRegistry: childWorkflowRegistry,
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        }),
      ).rejects.toThrow(/child result uses .* above the 64000 bytes limit/);
    });
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

  it.each([
    ["query", { kind: "runAfter", delayMs: 250 }, { runAfter: 250 }],
    ["mutation", { kind: "runAt", timestamp: 1_250 }, { runAt: 1_250 }],
  ] as const)(
    "passes the stable name and exact %s scheduling option",
    async (functionKind, schedule, expectedSchedule) => {
      const ref =
        `compiler.v2.${functionKind}` as unknown as DurableGraphStepRef<
          typeof functionKind
        >;
      const runQuery = vi.fn(async () => ({ accepted: true }));
      const runMutation = vi.fn(async () => ({ accepted: true }));
      const graph = v2CapabilityGraph(functionKind, undefined, schedule);
      const capabilityRegistry =
        functionKind === "query"
          ? {
              [capabilityRef]: {
                kind: "query" as const,
                ref: ref as DurableGraphStepRef<"query">,
                effectClass: "none" as const,
                buildArgs: () => ({}),
              },
            }
          : {
              [capabilityRef]: {
                kind: "mutation" as const,
                ref: ref as DurableGraphStepRef<"mutation">,
                effectClass: "none" as const,
                buildArgs: () => ({}),
              },
            };

      await runDurableGraphWorkflowV2(v2Step({ runQuery, runMutation }), {
        ...v2Input(graph),
        scheduleNowMs: () => 1_000,
        capabilityRegistry,
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      });

      const runner = functionKind === "query" ? runQuery : runMutation;
      expect(runner).toHaveBeenCalledWith(
        ref,
        {},
        {
          name: "charge.v2",
          ...expectedSchedule,
        },
      );
    },
  );

  it("combines action retry posture with exactly one schedule option", async () => {
    const actionRef =
      "compiler.v2.action" as unknown as DurableGraphStepRef<"action">;
    const scheduledWrapperRef =
      "compiler.v2.action.scheduled" as unknown as DurableGraphStepRef<"action">;
    const recordStageStarted = "stage.started" as never;
    const recordStageFinished = "stage.finished" as never;
    const runAction = vi.fn(async () => ({ accepted: true }));
    const runMutation = vi.fn(
      async (...args: [unknown, Record<string, unknown>]) => {
        void args;
        return null;
      },
    );
    const graph = v2CapabilityGraph("action", undefined, {
      kind: "runAfter",
      delayMs: 250,
    });

    await runDurableGraphWorkflowV2(v2Step({ runAction, runMutation }), {
      ...v2ExternalInput(graph),
      scheduleNowMs: () => 1_000,
      observability: { recordStageStarted, recordStageFinished },
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: actionRef,
          scheduled: {
            ref: scheduledWrapperRef,
            deadlineAt: () => 2_000,
          },
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
      scheduledWrapperRef,
      {
        invocation: {
          request: {
            schemaVersion: 1,
            requestedAt: 1_000,
            requestedSchedule: { kind: "runAfter", delayMs: 250 },
            requestedStartAt: 1_250,
            deadlineAt: 2_000,
          },
          authority: {
            principal: v2ExternalInput(graph).principal,
            policySnapshot: childPolicySnapshot,
          },
          delegateArgs: {},
        },
      },
      {
        name: "charge.v2",
        retry: false,
        runAfter: 250,
      },
    );
    const started = runMutation.mock.calls.find(
      ([ref, args]) => ref === recordStageStarted && args.nodeId === "charge",
    );
    expect(started?.[1]).not.toHaveProperty("observedAt");
  });

  it("rejects a scheduled action without a generated wrapper before effect admission", async () => {
    const runAction = vi.fn(async () => ({ unreachable: true }));
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const graph = v2CapabilityGraph("action", undefined, {
      kind: "runAfter",
      delayMs: 250,
    });
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction }), {
        ...v2ExternalInput(graph),
        scheduleNowMs: () => 1_000,
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
    ).rejects.toThrow(/requires a generated scheduled wrapper binding/);
    expect(admitEffect).not.toHaveBeenCalled();
    expect(runAction).not.toHaveBeenCalled();
  });

  it("rejects a past runAt before capability dispatch", async () => {
    const runQuery = vi.fn(async () => ({ accepted: true }));
    const graph = v2CapabilityGraph("query", undefined, {
      kind: "runAt",
      timestamp: 999,
    });
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runQuery }), {
        ...v2Input(graph),
        scheduleNowMs: () => 1_000,
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
    ).rejects.toThrow(/SCHEDULE_IN_PAST/);
    expect(runQuery).not.toHaveBeenCalled();
  });

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

  it("runs only durable-ledger reconciliation after ambiguous admission", async () => {
    const providerRef =
      "compiler.v2.provider" as unknown as DurableGraphStepRef<"action">;
    const reconciliationRef =
      "compiler.v2.reconcile" as unknown as DurableGraphStepRef<"action">;
    const runAction = vi.fn(async (ref) =>
      ref === reconciliationRef ? { reconciled: true } : { dispatched: true },
    );
    const result = await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2ExternalInput(v2CapabilityGraph("action")),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: providerRef,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: durableLedgerContract,
          instanceKey: () => "invoice-42",
          buildArgs: () => ({ provider: true }),
        },
        [reconciliationCapabilityRef]: {
          kind: "action",
          ref: reconciliationRef,
          effectClass: "none",
          effectContract: nonRetriableContract,
          instanceKey: () => "reconcile-invoice-42",
          buildArgs: ({ logicalEffectKey }) => ({ logicalEffectKey }),
        },
      },
      admitEffect: async () => ({ kind: "reconcile-ledger" }),
    });
    expect(runAction).toHaveBeenCalledOnce();
    expect(runAction).toHaveBeenCalledWith(
      reconciliationRef,
      { logicalEffectKey: expect.stringContaining("effect.v1") },
      { name: "charge.v2.reconcile", retry: false },
    );
    expect(runAction).not.toHaveBeenCalledWith(
      providerRef,
      expect.anything(),
      expect.anything(),
    );
    expect(result.context.charge).toEqual({ reconciled: true });
  });

  it("runs only provider-status reconciliation when that mechanism is declared", async () => {
    const providerRef =
      "compiler.v2.provider" as unknown as DurableGraphStepRef<"action">;
    const reconciliationRef =
      "compiler.v2.providerStatus" as unknown as DurableGraphStepRef<"action">;
    const runAction = vi.fn(async (ref) =>
      ref === reconciliationRef ? { status: "accepted" } : { dispatched: true },
    );
    const result = await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2ExternalInput(v2CapabilityGraph("action")),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: providerRef,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: providerStatusContract,
          instanceKey: () => "invoice-42",
          buildArgs: ({ logicalEffectKey }) => ({ logicalEffectKey }),
        },
        [providerStatusCapabilityRef]: {
          kind: "action",
          ref: reconciliationRef,
          effectClass: "none",
          effectContract: nonRetriableContract,
          instanceKey: () => "provider-status-invoice-42",
          buildArgs: ({ logicalEffectKey }) => ({ logicalEffectKey }),
        },
      },
      admitEffect: async () => ({ kind: "reconcile-provider-status" }),
    });
    expect(runAction).toHaveBeenCalledOnce();
    expect(runAction).toHaveBeenCalledWith(
      reconciliationRef,
      { logicalEffectKey: expect.stringContaining("effect.v1") },
      { name: "charge.v2.reconcile", retry: false },
    );
    expect(runAction).not.toHaveBeenCalledWith(
      providerRef,
      expect.anything(),
      expect.anything(),
    );
    expect(result.context.charge).toEqual({ status: "accepted" });
  });

  it("returns a non-retriable manual-review result without provider dispatch", async () => {
    const runAction = vi.fn(async () => ({ dispatched: true }));
    const result = await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2ExternalInput(v2CapabilityGraph("action")),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: "compiler.v2.provider" as unknown as DurableGraphStepRef<"action">,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract: nonRetriableContract,
          instanceKey: () => "invoice-42",
          buildArgs: () => ({}),
        },
      },
      admitEffect: async () => ({
        kind: "manual-review",
        result: { status: "manual-review", correlationId: "safe-1" },
      }),
    });
    expect(runAction).not.toHaveBeenCalled();
    expect(result.context.charge).toEqual({
      status: "manual-review",
      correlationId: "safe-1",
    });
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
const compensateFirstRef = Schema.decodeSync(WorkflowCapabilityReference)(
  "capability.compensateFirst.v2",
);
const compensateSecondRef = Schema.decodeSync(WorkflowCapabilityReference)(
  "capability.compensateSecond.v2",
);
const compensateFailureRef = Schema.decodeSync(WorkflowCapabilityReference)(
  "capability.compensateFailure.v2",
);

const childWorkflowRef = Schema.decodeSync(WorkflowReference)(
  "workflow.childReceipt.v3",
);
const nestedWorkflowRef = Schema.decodeSync(WorkflowReference)(
  "workflow.nestedReceipt.v4",
);
const leafWorkflowRef = Schema.decodeSync(WorkflowReference)(
  "workflow.leafReceipt.v5",
);
type ChildArgs = {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly idempotencyKey: string;
  readonly principal: DurableWorkflowPrincipal;
  readonly policySnapshot: WorkflowPolicySnapshot;
  readonly subworkflow?: {
    readonly linkId: string;
    readonly parentWorkflowRunId: string;
    readonly parentComponentWorkflowId: string;
    readonly generation: number;
    readonly reservedAt: number;
  };
};
type ChildResult = { readonly receiptId: string };
const childArgumentMapper = ({ inputs }: { readonly inputs: unknown }) => ({
  requestId: String((inputs as { requestId?: unknown }).requestId),
});
const publishedBatchBinding: WorkflowV2BoundedBatchBinding = {
  selectItems: () => ({ items: ["published-item"] }),
  mapBatchArgs: ({ batch }) => ({ requestId: batch.items.join(",") }),
};
const childHandlerRef =
  "workflowRunners/childReceipt/v3:run" as unknown as DurableGraphWorkflowRef<
    ChildArgs,
    ChildResult
  >;
const childResultSchema = Schema.Struct({ receiptId: Schema.String });
const childPrincipal = {
  version: 2,
  kind: "user",
  workspaceId: "workspace-1",
  actorId: "actor-1",
  role: "editor",
  authEpoch: 4,
  provenance: "authenticated-workflow-start",
  grants: ["workflow:run", "brief:read"],
  kickoffAt: 1,
} as const satisfies DurableWorkflowPrincipal;
const childPolicySnapshot = {
  version: 1,
  kind: "none",
  reason: "workflow conformance fixture",
} as const satisfies WorkflowPolicySnapshot;
const childLinkReserveRef =
  "workflows.subworkflowLinks.reserve" as unknown as DurableGraphStepRef<"mutation">;
const childLinkRecoverRef =
  "workflows.subworkflowLinks.recoverReservation" as unknown as DurableGraphStepRef<"query">;
const childLinkPersistReservationRef =
  "workflows.subworkflowLinks.persistUnresolvedReservation" as unknown as DurableGraphStepRef<"mutation">;
const childLinkPersistSuccessRef =
  "workflows.subworkflowLinks.persistUnresolvedSuccess" as unknown as DurableGraphStepRef<"mutation">;
const childLinkRecoverSuccessRef =
  "workflows.subworkflowLinks.recoverUnresolvedSuccess" as unknown as DurableGraphStepRef<"query">;
const childLinkResolveSuccessRef =
  "workflows.subworkflowLinks.resolveUnresolvedSuccess" as unknown as DurableGraphStepRef<"mutation">;
const childLinkReconcileRef =
  "workflows.subworkflowLinks.reconcile" as unknown as DurableGraphStepRef<"mutation">;
const childLinkReportRef =
  "workflows.subworkflowLinks.reportReconciliationFailure" as unknown as DurableGraphStepRef<"mutation">;
const childArtifactGetOwnedRef =
  "workflows.artifacts.getOwned" as unknown as DurableGraphStepRef<"query">;

const publicationSourceModule = (
  module: string,
  source: string,
): ChecksummedModule => ({ module, checksum: sha256Hex(source) });

const publicationAuthority = (
  logicalId: string,
  version: number,
  modules: readonly ChecksummedModule[],
): GeneratedPublicationAuthority => {
  const descriptor = {
    roots: modules.map(({ module }) => module).sort(),
    modules: modules
      .map(({ module, checksum }) => ({ path: module, checksum }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
  const sourceClosure = {
    ...descriptor,
    checksum: publicationTestOnly.checksumSourceClosureDescriptor(descriptor),
  };
  return {
    schemaVersion: 1,
    sourceClosure,
    descriptorChecksum: publicationTestOnly.checksumAuthorityDescriptor(
      "workflow",
      logicalId,
      version,
      sourceClosure,
    ),
  };
};

const publishedSubworkflowFixture = (
  workflowId: string,
  version: number,
  ref: DurableGraphWorkflowRef<ChildArgs, ChildResult>,
  subworkflowBindings: WorkflowRelease["subworkflowBindings"] = [],
  mapArgs: (envelope: { readonly inputs: unknown }) => {
    readonly requestId: string;
  } = childArgumentMapper,
  resultSchema: Schema.Codec<unknown, unknown> = childResultSchema,
  boundedBatch?: WorkflowV2BoundedBatchBinding,
) => {
  const graphJson = JSON.stringify({
    id: workflowId,
    version,
    argsSchemaName: `${workflowId}.v${version}.args`,
    returnSchemaName: `${workflowId}.v${version}.result`,
    nodes: [],
  });
  const graphModule = `workflows/${workflowId}/v${version}.graph.ts`;
  const argumentMapperModule = `workflows/${workflowId}/v${version}.argumentMapper.ts`;
  const resultSchemaModule = `workflows/${workflowId}/v${version}.resultSchema.ts`;
  const runnerFunctionReference = ref as unknown as string;
  const runnerSourceModule = `packages/convex/convex/${runnerFunctionReference.split(":")[0]}.ts`;
  const interpreter = publicationSourceModule(
    "workflows/_kit/graphRunnerV2.ts",
    "export const runtime = 2;\n",
  );
  const modules = [
    publicationSourceModule(graphModule, graphJson),
    publicationSourceModule(
      argumentMapperModule,
      boundedBatch
        ? "export const mapArgs = 1; export const selectItems = 1; export const mapBatchArgs = 1;\n"
        : "export const mapArgs = 1;\n",
    ),
    publicationSourceModule(
      resultSchemaModule,
      "export const resultSchema = 1;\n",
    ),
    publicationSourceModule(
      runnerSourceModule,
      `export const runnerVersion = ${version};\n`,
    ),
    interpreter,
  ];
  const authority = publicationAuthority(workflowId, version, modules);
  const graphSource = modules[0];
  if (!graphSource) throw new Error("subworkflow publication graph is missing");
  const candidate: WorkflowRelease<
    DurableGraphWorkflowRef<ChildArgs, ChildResult>,
    string
  > = {
    workflowId,
    version,
    lifecycle: "published",
    authority,
    graphModule,
    graphHash: graphSource.checksum,
    subworkflowRuntime: {
      graphJson,
      graphSnapshotHash: sha256Hex(graphJson),
      argumentMapper: {
        module: argumentMapperModule,
        exportName: "mapArgs",
        schemaName: `${workflowId}.v${version}.args`,
        mapArgs,
      },
      resultSchema: {
        module: resultSchemaModule,
        exportName: "resultSchema",
        schemaName: `${workflowId}.v${version}.result`,
        schema: resultSchema,
      },
      ...(boundedBatch
        ? {
            boundedBatch: {
              selectItems: {
                module: argumentMapperModule,
                exportName: "selectItems",
                selectItems: boundedBatch.selectItems,
              },
              mapBatchArgs: {
                module: argumentMapperModule,
                exportName: "mapBatchArgs",
                schemaName: `${workflowId}.v${version}.args`,
                mapBatchArgs: boundedBatch.mapBatchArgs,
              },
            },
          }
        : {}),
    },
    runner: {
      ref,
      module: runnerFunctionReference,
      functionReference: runnerFunctionReference,
    },
    events: [],
    completion: {
      ref: `${workflowId}/v${version}:onComplete`,
      module: `${workflowId}/v${version}:onComplete`,
      version: 1,
    },
    kickoffProfiles: ["queued"],
    capabilityBindings: [],
    subworkflowBindings,
    runtimeVersion: "maestro-workflow-runtime.v2",
    interpreter,
    lifecycleContractVersion: 1,
    sourceClosureChecksum: authority.sourceClosure.checksum,
    releaseChecksum: "",
    stableStepNames: [],
    semanticComplete: true,
    isolatedFixture: true,
  };
  return {
    graphJson,
    argumentMapperModule,
    resultSchemaModule,
    release: defineWorkflowRelease({
      ...candidate,
      releaseChecksum: publicationTestOnly.checksumWorkflowRelease(candidate),
    }),
  };
};

const childPublication = publishedSubworkflowFixture(
  "workflow.childReceipt",
  3,
  childHandlerRef,
);
const nestedPublication = publishedSubworkflowFixture(
  "workflow.nestedReceipt",
  4,
  childHandlerRef,
);
const childPublicationRegistry = definePublicationRegistry({
  capabilities: [],
  workflows: [childPublication.release, nestedPublication.release],
});
const childSubworkflowRuntime = childPublication.release.subworkflowRuntime;
if (!childSubworkflowRuntime) {
  throw new Error("child workflow fixture requires a runtime binding");
}

const childWorkflowDefinition = (
  principal:
    | { readonly kind: "inherit" }
    | {
        readonly kind: "narrow";
        readonly grants: readonly string[];
      } = { kind: "inherit" },
  boundedBatch?: {
    readonly selectItems: {
      readonly module: string;
      readonly exportName: string;
    };
    readonly mapBatchArgs: {
      readonly module: string;
      readonly exportName: string;
      readonly schemaName: string;
    };
  },
) =>
  defineWorkflowV2Subworkflow<ChildArgs, ChildResult>({
    mapArgs: childArgumentMapper,
    resultSchema: childResultSchema,
    principal,
    publication: {
      workflowId: childPublication.release.workflowId,
      argumentMapper: {
        module: childSubworkflowRuntime.argumentMapper.module,
        exportName: childSubworkflowRuntime.argumentMapper.exportName,
        schemaName: childSubworkflowRuntime.argumentMapper.schemaName,
      },
      resultSchema: {
        module: childSubworkflowRuntime.resultSchema.module,
        exportName: childSubworkflowRuntime.resultSchema.exportName,
        schemaName: childSubworkflowRuntime.resultSchema.schemaName,
      },
      ...(boundedBatch ? { boundedBatch } : {}),
    },
    links: {
      reserveRef: childLinkReserveRef,
      recoverReservationRef: childLinkRecoverRef,
      persistUnresolvedReservationRef: childLinkPersistReservationRef,
      persistUnresolvedSuccessRef: childLinkPersistSuccessRef,
      recoverUnresolvedSuccessRef: childLinkRecoverSuccessRef,
      resolveUnresolvedSuccessRef: childLinkResolveSuccessRef,
      reconcileRef: childLinkReconcileRef,
      reportReconciliationFailureRef: childLinkReportRef,
    },
    artifacts: { getOwnedRef: childArtifactGetOwnedRef },
  });

const childWorkflowRegistry = defineWorkflowV2SubworkflowRegistry(
  childPublicationRegistry,
  { [childWorkflowRef]: childWorkflowDefinition() },
);
const childWorkflowEntry = readChildWorkflowEntry();

const childLinkProjection = (): SubworkflowRunLinkProjection => ({
  workspaceId: "workspace-1",
  parentWorkflowRunId: "run-1",
  parentComponentWorkflowId: "component-parent",
  parentWorkflowVersion: 2,
  generation: 0,
  childWorkflow: childWorkflowRef,
  childWorkflowVersion: 3,
  childGraphJson: childPublication.graphJson,
  childReleaseChecksum: childPublication.release.releaseChecksum,
  stepName: Schema.decodeSync(WorkflowStepName)("child.v3"),
  principal: childPrincipal,
  policySnapshot: childPolicySnapshot,
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

const reconciliationCapabilityRef = Schema.decodeSync(
  WorkflowCapabilityReference,
)("capability.reconcileLedger.v1");
const providerStatusCapabilityRef = Schema.decodeSync(
  WorkflowCapabilityReference,
)("capability.reconcileProviderStatus.v1");

const durableLedgerContract = {
  strategy: "durable-ledger-and-reconcile",
  effectClass: "external",
  reconciliationCapabilityRef,
  reconciliationFixtureRef: "ledger.ambiguity.fixture",
  dedupeRetentionMs: 200,
  maxRetryWindowMs: 100,
  maxRestartWindowMs: 100,
  redactionPolicyRef: "redaction.fixture",
  guards,
} satisfies WorkflowEffectContract;

const providerStatusContract = {
  ...providerNativeContract,
  ambiguityResolution: {
    kind: "provider-status-reconciliation",
    capabilityRef: providerStatusCapabilityRef,
    fixtureRef: "provider.status.fixture",
  },
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
  schedule?:
    | { readonly kind: "runAfter"; readonly delayMs: number }
    | { readonly kind: "runAt"; readonly timestamp: number },
): DurableWorkflowGraphV2 => ({
  schemaVersion: 2,
  id: "compiler-v2",
  version: 2,
  startNodeId: "source",
  argsSchemaName: "compiler.v2.args",
  returnSchemaName: "compiler.v2.returns",
  principalSchemaName: "workflow.principal.v1",
  policyPosture: { kind: "none", reason: "fixture" },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
  ],
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
          failurePolicy: { kind: "fail" },
          ...(retry ? { retry } : {}),
          ...(schedule ? { schedule } : {}),
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
          failurePolicy: { kind: "fail" },
          transaction: { kind: "independent" },
          ...(schedule ? { schedule } : {}),
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
  failurePolicy: { kind: "fail" as const },
});

const v2BoundedBatchGraph = (
  overrides: Partial<
    Extract<
      DurableWorkflowGraphV2["nodes"][number],
      { kind: "bounded-subworkflow-batch" }
    >
  > = {},
): DurableWorkflowGraphV2 => {
  const { source, output, ...graph } = v2SubworkflowTemplate();
  const batch = {
    id: "batch",
    kind: "bounded-subworkflow-batch" as const,
    workflow: childWorkflowRef,
    childVersion: 3,
    label: "Child receipt batches",
    stepName: Schema.decodeSync(WorkflowStepName)("batch.v2"),
    payloadPolicy,
    semanticRuleIds: ["WF-NODE-SUBWORKFLOW", "WF-NODE-CHILD-VERSION"] as const,
    failurePolicy: { kind: "fail" as const },
    maxItems: 5,
    batchSize: 2,
    fanOut: 2,
    ...overrides,
  };
  return {
    ...graph,
    nodes: [source, batch, output],
    edges: [
      { id: "source-batch", sourceNodeId: "source", targetNodeId: "batch" },
      { id: "batch-output", sourceNodeId: "batch", targetNodeId: "output" },
    ],
  };
};
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

const v2SubworkflowGraphWithResultPolicy = (
  resultMode: "inline" | "artifact-reference",
  maxResultBytes: number,
): DurableWorkflowGraphV2 => {
  const graph = v2SubworkflowGraph();
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.kind === "subworkflow"
        ? {
            ...node,
            payloadPolicy: {
              ...node.payloadPolicy,
              resultMode,
              maxResultBytes,
            },
          }
        : node,
    ),
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
      failurePolicy: { kind: "fail" as const },
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
  nodes: v2ParallelGraph().nodes.map((node) =>
    node.kind === "capability" && node.id === "branchB"
      ? {
          ...node,
          failurePolicy: workflowFailurePolicy.errorEdge({
            edgeId: "b-output-error",
            failure: {
              _tag: "WorkflowSettledFailure" as const,
              code: "BRANCH_REJECTED",
              message: "Branch could not complete.",
            },
          }),
        }
      : node,
  ),
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

const v2CompensationGraph = (): DurableWorkflowGraphV2 => {
  const graph = v2CapabilityGraph("query");
  const source = graph.nodes.find((node) => node.kind === "source");
  const output = graph.nodes.find((node) => node.kind === "output");
  if (!source || !output)
    throw new Error("compensation fixture needs endpoints");
  const queryNode = (id: string) => ({
    id,
    kind: "capability" as const,
    functionKind: "query" as const,
    capability: capabilityRef,
    label: id,
    stepName: Schema.decodeSync(WorkflowStepName)(`${id}.v2`),
    payloadPolicy: { ...payloadPolicy, maxResultBytes: 256 },
    semanticRuleIds: ["WF-STEP-QUERY"] as const,
    failurePolicy: { kind: "fail" as const },
    transaction: { kind: "independent" as const },
  });
  const failure = queryNode("failure");
  return {
    ...graph,
    nodes: [
      source,
      queryNode("first"),
      queryNode("second"),
      {
        ...failure,
        failurePolicy: workflowFailurePolicy.compensation({
          edgeId: "failure-output-error",
          failure: {
            _tag: "WorkflowSettledFailure",
            code: "ORDER_REJECTED",
            message: "Order could not complete.",
          },
          steps: [
            {
              forNodeId: "first",
              capability: compensateFirstRef,
              stepName: "compensate-first.v2",
            },
            {
              forNodeId: "second",
              capability: compensateSecondRef,
              stepName: "compensate-second.v2",
            },
            {
              forNodeId: "failure",
              capability: compensateFailureRef,
              stepName: "compensate-failure.v2",
            },
          ],
        }),
      },
      output,
    ],
    edges: [
      { id: "source-first", sourceNodeId: "source", targetNodeId: "first" },
      { id: "first-second", sourceNodeId: "first", targetNodeId: "second" },
      {
        id: "second-failure",
        sourceNodeId: "second",
        targetNodeId: "failure",
      },
      {
        id: "failure-output-success",
        sourceNodeId: "failure",
        targetNodeId: "output",
      },
      {
        id: "failure-output-error",
        sourceNodeId: "failure",
        targetNodeId: "output",
      },
    ],
    joins: [],
  };
};

const v2MixedWaveCompensationGraph = (): DurableWorkflowGraphV2 => ({
  ...v2SettledFailureGraph(),
  nodes: v2SettledFailureGraph().nodes.map((node) =>
    node.kind === "capability" && node.id === "branchB"
      ? {
          ...node,
          failurePolicy: workflowFailurePolicy.compensation({
            edgeId: "b-output-error",
            failure: {
              _tag: "WorkflowSettledFailure",
              code: "BRANCH_REJECTED",
              message: "Branch could not complete.",
            },
            steps: [
              {
                forNodeId: "branchB",
                capability: compensateFailureRef,
                stepName: "compensate-failure.v2",
              },
            ],
          }),
        }
      : node,
  ),
});

const compensationCapabilityRegistry = () => ({
  [capabilityRef]: {
    kind: "query" as const,
    ref: "compiler.v2.query" as unknown as DurableGraphStepRef<"query">,
    effectClass: "none" as const,
    buildArgs: ({ node }: { readonly node: { readonly id: string } }) => ({
      nodeId: node.id,
    }),
  },
  ...Object.fromEntries(
    [compensateFirstRef, compensateSecondRef, compensateFailureRef].map(
      (reference) => [
        reference,
        {
          kind: "action" as const,
          ref: `compiler.v2.${reference}` as unknown as DurableGraphStepRef<"action">,
          effectClass: "none" as const,
          effectContract: nonRetriableContract,
          instanceKey: () => "order-42",
          buildArgs: () => ({}),
          compensation: {
            payloadPolicy: {
              ...payloadPolicy,
              maxResultBytes: 64_000,
            },
            semanticRuleIds: ["WF-STEP-ACTION"] as const,
          },
        },
      ],
    ),
  ),
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
    failurePolicy: { kind: "fail" as const },
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
  policySnapshot: childPolicySnapshot,
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
  workflowId: "component-parent" as NonNullable<
    RunDurableGraphStep["workflowId"]
  >,
  runQuery: async (ref) =>
    ref === generatedCurrentAuthority.ref ? currentAuthorityReceipt : undefined,
  runMutation: async (ref) =>
    ref === childLinkReserveRef
      ? { linkId: "link-1", childWorkflowRunId: "child-run-1" }
      : null,
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

describe("bounded subworkflow publication binding", () => {
  const boundedPublication = publishedSubworkflowFixture(
    "workflow.childReceipt",
    3,
    childHandlerRef,
    [],
    childArgumentMapper,
    childResultSchema,
    publishedBatchBinding,
  );
  const boundedPublicationRegistry = definePublicationRegistry({
    capabilities: [],
    workflows: [boundedPublication.release],
  });
  const boundedRuntime =
    boundedPublication.release.subworkflowRuntime?.boundedBatch;
  if (!boundedRuntime) throw new Error("bounded runtime fixture is required");
  const boundedDescriptor = {
    selectItems: {
      module: boundedRuntime.selectItems.module,
      exportName: boundedRuntime.selectItems.exportName,
    },
    mapBatchArgs: {
      module: boundedRuntime.mapBatchArgs.module,
      exportName: boundedRuntime.mapBatchArgs.exportName,
      schemaName: boundedRuntime.mapBatchArgs.schemaName,
    },
  };
  const definition = childWorkflowDefinition(
    { kind: "inherit" },
    boundedDescriptor,
  );

  it("uses selector and mapper references from the immutable publication runtime", () => {
    const registry = defineCurrentWorkflowV2SubworkflowRegistry(
      boundedPublicationRegistry,
      { [childWorkflowRef]: definition },
    );
    expect(registry[childWorkflowRef]?.boundedBatch?.selectItems).toBe(
      publishedBatchBinding.selectItems,
    );
    expect(registry[childWorkflowRef]?.boundedBatch?.mapBatchArgs).toBe(
      publishedBatchBinding.mapBatchArgs,
    );
  });

  it.each([
    {
      name: "selector drift",
      descriptor: {
        ...boundedDescriptor,
        selectItems: {
          ...boundedDescriptor.selectItems,
          exportName: "drifted",
        },
      },
    },
    {
      name: "mapper drift",
      descriptor: {
        ...boundedDescriptor,
        mapBatchArgs: {
          ...boundedDescriptor.mapBatchArgs,
          schemaName: "workflow.childReceipt.v4.args",
        },
      },
    },
  ])("rejects $name before registry publication", ({ descriptor }) => {
    expect(() =>
      defineCurrentWorkflowV2SubworkflowRegistry(boundedPublicationRegistry, {
        [childWorkflowRef]: {
          ...definition,
          publication: { ...definition.publication, boundedBatch: descriptor },
        },
      }),
    ).toThrow(/immutable release/);
  });

  it("rejects a local bounded binding absent from the immutable release", () => {
    expect(() =>
      defineCurrentWorkflowV2SubworkflowRegistry(childPublicationRegistry, {
        [childWorkflowRef]: definition,
      }),
    ).toThrow(/immutable release/);
  });

  it("accepts a reloaded runtime export without same-process identity", () => {
    const reloaded = publishedSubworkflowFixture(
      "workflow.childReceipt",
      3,
      childHandlerRef,
      [],
      childArgumentMapper,
      childResultSchema,
      {
        selectItems: function selectItems() {
          return { items: ["published-item"] };
        },
        mapBatchArgs: function mapBatchArgs({ batch }) {
          return { requestId: batch.items.join(",") };
        },
      },
    );
    expect(reloaded.release.releaseChecksum).toBe(
      boundedPublication.release.releaseChecksum,
    );
    const registry = defineCurrentWorkflowV2SubworkflowRegistry(
      definePublicationRegistry({
        capabilities: [],
        workflows: [reloaded.release],
      }),
      { [childWorkflowRef]: definition },
    );
    expect(registry[childWorkflowRef]?.boundedBatch?.selectItems).not.toBe(
      publishedBatchBinding.selectItems,
    );
  });

  it("rejects descriptor tamper covered by the release checksum", () => {
    const runtime = boundedPublication.release.subworkflowRuntime;
    const bounded = runtime?.boundedBatch;
    if (!runtime || !bounded) throw new Error("bounded runtime is required");
    expect(() =>
      defineWorkflowRelease({
        ...boundedPublication.release,
        subworkflowRuntime: {
          ...runtime,
          boundedBatch: {
            ...bounded,
            selectItems: {
              ...bounded.selectItems,
              module: runtime.resultSchema.module,
            },
          },
        },
      }),
    ).toThrow(/checksum/);
  });

  it("rejects bounded publication version drift", () => {
    const v4 = publishedSubworkflowFixture(
      "workflow.childReceipt",
      4,
      childHandlerRef,
      [],
      childArgumentMapper,
      childResultSchema,
      publishedBatchBinding,
    );
    expect(() =>
      defineCurrentWorkflowV2SubworkflowRegistry(
        definePublicationRegistry({
          capabilities: [],
          workflows: [v4.release],
        }),
        { [childWorkflowRef]: definition },
      ),
    ).toThrow(/binding is unavailable/);
  });
});

describe("bounded subworkflow batch runtime", () => {
  const registryEntry = (items: readonly string[], stable = true) => ({
    ...childWorkflowEntry,
    boundedBatch: {
      selectItems: () => ({
        items,
        ...(stable
          ? { stableIdentities: items.map((item) => "item-" + item) }
          : {}),
      }),
      mapBatchArgs: (envelope: {
        readonly batch: { readonly items: readonly unknown[] };
      }) => ({
        requestId: envelope.batch.items.join(","),
      }),
    },
  });

  it("runs stable batches in bounded waves through the immutable child registry", async () => {
    const starts: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const runWorkflow = vi.fn(
      async (
        _ref,
        args: Record<string, unknown>,
        _options?: Record<string, unknown>,
      ) => {
        void _options;
        starts.push(String(args.requestId));
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return { receiptId: "receipt-" + String(args.requestId) };
      },
    );
    const runMutation = vi.fn(async (ref, args: Record<string, unknown>) => {
      if (ref === childLinkReserveRef) {
        const projection = args.projection as { readonly stepName: string };
        return {
          linkId: "link-" + projection.stepName,
          childWorkflowRunId: "run-" + projection.stepName,
        };
      }
      return null;
    });
    const result = await runDurableGraphWorkflowV2(
      v2Step({ runWorkflow, runMutation }),
      {
        ...v2Input(v2BoundedBatchGraph()),
        principal: childPrincipal,
        workflowRegistry: {
          [childWorkflowRef]: registryEntry(["a", "b", "c", "d", "e"]),
        },
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      },
    );
    expect(starts).toEqual(["a,b", "c,d", "e"]);
    expect(maximumActive).toBe(2);
    expect(runWorkflow).toHaveBeenCalledTimes(3);
    expect(
      runWorkflow.mock.calls.every((call) => {
        const options = call[2] as Record<string, unknown>;
        return (
          "name" in options && !("runAt" in options) && !("runAfter" in options)
        );
      }),
    ).toBe(true);
    expect(
      runWorkflow.mock.calls.map((call) => (call[1] as ChildArgs).principal),
    ).toEqual([childPrincipal, childPrincipal, childPrincipal]);
    expect(result.context.batch).toMatchObject({
      kind: "completed",
      itemCount: 5,
      batchCount: 3,
      waveCount: 2,
    });
    const names = runWorkflow.mock.calls.map(
      (call) => (call[2] as { name: string }).name,
    );
    expect(new Set(names).size).toBe(3);
    expect(
      names.every((name) => /^batch\.v3\.i-k16-[a-f0-9]{16}$/.test(name)),
    ).toBe(true);
  });

  it("accepts the aggregate result boundary and rejects one byte over budget", async () => {
    const aggregate = {
      kind: "completed" as const,
      itemCount: 1,
      batchCount: 1,
      waveCount: 1,
      batches: [
        {
          waveOrdinal: 0,
          batchOrdinal: 0,
          itemOrdinals: [0],
          result: { receiptId: "receipt-a" },
        },
      ],
    };
    const aggregateBytes = getConvexSize(aggregate);
    const runWorkflow = vi.fn(async () => ({ receiptId: "receipt-a" }));
    const inputForBudget = (maxResultBytes: number) => ({
      ...v2Input(
        v2BoundedBatchGraph({
          maxItems: 1,
          batchSize: 1,
          fanOut: 1,
          payloadPolicy: { ...payloadPolicy, maxResultBytes },
        }),
      ),
      principal: childPrincipal,
      workflowRegistry: { [childWorkflowRef]: registryEntry(["a"]) },
      capabilityRegistry: {},
      admitEffect: async () => ({ kind: "deny" as const, reason: "not used" }),
    });
    const atBoundary = await runDurableGraphWorkflowV2(
      v2Step({ runWorkflow }),
      inputForBudget(aggregateBytes),
    );
    expect(atBoundary.context.batch).toEqual(aggregate);
    await expect(
      runDurableGraphWorkflowV2(
        v2Step({ runWorkflow }),
        inputForBudget(aggregateBytes - 1),
      ),
    ).rejects.toThrow("Workflow bounded subworkflow batch rejected.");
  });

  it("makes empty input explicit without reserving or dispatching", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const runMutation = vi.fn(async () => null);
    const result = await runDurableGraphWorkflowV2(
      v2Step({ runWorkflow, runMutation }),
      {
        ...v2Input(v2BoundedBatchGraph()),
        principal: childPrincipal,
        workflowRegistry: { [childWorkflowRef]: registryEntry([]) },
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      },
    );
    expect(result.context.batch).toEqual({
      kind: "empty",
      itemCount: 0,
      batchCount: 0,
      waveCount: 0,
      batches: [],
    });
    expect(runMutation).not.toHaveBeenCalled();
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it.each([
    [
      "selected overflow",
      v2BoundedBatchGraph({ maxItems: 2 }),
      registryEntry(["a", "b", "c"]),
      { maxDepth: 4, maxFanOut: 8 },
    ],
    [
      "fan-out budget",
      v2BoundedBatchGraph({ fanOut: 3 }),
      registryEntry(["a"]),
      { maxDepth: 4, maxFanOut: 2 },
    ],
    [
      "total child starts despite serial fan-out",
      v2BoundedBatchGraph({ maxItems: 8192, batchSize: 1, fanOut: 1 }),
      registryEntry(["a"]),
      { maxDepth: 4, maxFanOut: 8 },
    ],
    [
      "registry cycle",
      v2BoundedBatchGraph(),
      { ...registryEntry(["a", "b"]), children: [childWorkflowRef] },
      { maxDepth: 4, maxFanOut: 8 },
    ],
    [
      "version mismatch",
      v2BoundedBatchGraph(),
      { ...registryEntry(["a", "b"]), version: 4 },
      { maxDepth: 4, maxFanOut: 8 },
    ],
  ] as const)(
    "rejects %s before child dispatch",
    async (_name, graph, entry, subworkflowPolicy) => {
      const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
      const runMutation = vi.fn(async () => null);
      await expect(
        runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
          ...v2Input(graph),
          principal: childPrincipal,
          workflowRegistry: { [childWorkflowRef]: entry },
          subworkflowPolicy,
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        }),
      ).rejects.toThrow();
      expect(runWorkflow).not.toHaveBeenCalled();
    },
  );

  it("charges recursive 3x3 child-start products against a budget of seven", async () => {
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const rootEntry = {
      ...registryEntry(["a"]),
      children: [nestedWorkflowRef],
      childStartMultiplicities: [
        { workflow: nestedWorkflowRef, maxChildStarts: 3 },
      ],
    };
    const nestedEntry = {
      ...childWorkflowEntry,
      version: 4,
      children: [leafWorkflowRef],
      childStartMultiplicities: [
        { workflow: leafWorkflowRef, maxChildStarts: 3 },
      ],
    };
    const leafEntry = {
      ...childWorkflowEntry,
      version: 5,
      children: [],
      childStartMultiplicities: [],
    };
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow }), {
        ...v2Input(v2SubworkflowGraph()),
        principal: childPrincipal,
        workflowRegistry: {
          [childWorkflowRef]: rootEntry,
          [nestedWorkflowRef]: nestedEntry,
          [leafWorkflowRef]: leafEntry,
        },
        subworkflowPolicy: { maxDepth: 4, maxFanOut: 7 },
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/topology failed/);
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it("recovers repeated malformed reserve responses without leaking or duplicating", async () => {
    let reserveCalls = 0;
    const outcomes: unknown[] = [];
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const runMutation = vi.fn(async (ref, args: Record<string, unknown>) => {
      if (ref === childLinkReserveRef) {
        reserveCalls += 1;
        return { malformed: true };
      }
      if (ref === childLinkReconcileRef) outcomes.push(args.outcome);
      return null;
    });
    const runQuery = vi.fn(async (ref) =>
      ref === childLinkRecoverRef
        ? { linkId: "link-recovered", childWorkflowRunId: "run-recovered" }
        : undefined,
    );
    const input = {
      ...v2Input(v2BoundedBatchGraph({ maxItems: 1, batchSize: 1, fanOut: 1 })),
      principal: childPrincipal,
      workflowRegistry: { [childWorkflowRef]: registryEntry(["a"]) },
      capabilityRegistry: {},
      admitEffect: async () => ({ kind: "deny" as const, reason: "not used" }),
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        runDurableGraphWorkflowV2(
          v2Step({ runWorkflow, runMutation, runQuery }),
          input,
        ),
      ).rejects.toThrow(
        /link reservation returned invalid product run identities/,
      );
    }
    expect(reserveCalls).toBe(2);
    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(outcomes).toEqual([
      { kind: "failed", error: "Child workflow failed." },
      { kind: "failed", error: "Child workflow failed." },
    ]);
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it("durably reports a failed success reconciliation", async () => {
    const reports: Record<string, unknown>[] = [];
    const runMutation = vi.fn(async (ref, args: Record<string, unknown>) => {
      if (ref === childLinkReserveRef) {
        return { linkId: "link-success", childWorkflowRunId: "run-success" };
      }
      if (ref === childLinkReconcileRef) throw new Error("storage unavailable");
      if (ref === childLinkReportRef) reports.push(args);
      return null;
    });
    await expect(
      runDurableGraphWorkflowV2(
        v2Step({
          runMutation,
          runWorkflow: async () => ({ receiptId: "receipt-a" }),
        }),
        {
          ...v2Input(
            v2BoundedBatchGraph({ maxItems: 1, batchSize: 1, fanOut: 1 }),
          ),
          principal: childPrincipal,
          workflowRegistry: { [childWorkflowRef]: registryEntry(["a"]) },
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        },
      ),
    ).rejects.toThrow(/durable link reconciliation failed/);
    expect(reports).toEqual([
      expect.objectContaining({
        linkId: "link-success",
        primaryOutcome: "succeeded",
        issue: "SUBWORKFLOW_SUCCESS_RECONCILIATION_FAILED",
      }),
    ]);
  });

  it("persists dual success failure and resumes without invoking the child again", async () => {
    let reportAttempts = 0;
    let reconcileAttempts = 0;
    let unresolved: unknown = null;
    const runWorkflow = vi.fn(async () => ({ receiptId: "receipt-a" }));
    const runMutation = vi.fn(async (ref, args: Record<string, unknown>) => {
      if (ref === childLinkReserveRef) {
        return { linkId: "link-dual", childWorkflowRunId: "run-dual" };
      }
      if (ref === childLinkReconcileRef) {
        reconcileAttempts += 1;
        if (reconcileAttempts === 1) throw new Error("reconcile unavailable");
      }
      if (ref === childLinkPersistSuccessRef) {
        unresolved = { receipt: args.receipt, childResult: args.childResult };
      }
      if (ref === childLinkResolveSuccessRef) unresolved = null;
      if (ref === childLinkReportRef) {
        reportAttempts += 1;
        throw new Error("report unavailable");
      }
      return null;
    });
    const runQuery = vi.fn(async (ref) =>
      ref === childLinkRecoverSuccessRef ? unresolved : undefined,
    );
    const input = {
      ...v2Input(v2BoundedBatchGraph({ maxItems: 1, batchSize: 1, fanOut: 1 })),
      principal: childPrincipal,
      workflowRegistry: { [childWorkflowRef]: registryEntry(["a"]) },
      capabilityRegistry: {},
      admitEffect: async () => ({ kind: "deny" as const, reason: "not used" }),
    };
    const step = v2Step({
      runMutation,
      runQuery,
      runWorkflow,
    });
    await expect(runDurableGraphWorkflowV2(step, input)).rejects.toThrow(
      /durable failure report remain unresolved/,
    );
    await expect(runDurableGraphWorkflowV2(step, input)).resolves.toMatchObject(
      {
        context: { batch: expect.any(Object) },
      },
    );
    expect(reportAttempts).toBe(1);
    expect(reconcileAttempts).toBe(2);
    expect(runWorkflow).toHaveBeenCalledTimes(1);
    expect(unresolved).toBeNull();
  });

  it.each([
    {
      name: "null selector",
      boundedBatch: {
        selectItems: () => null as never,
        mapBatchArgs: publishedBatchBinding.mapBatchArgs,
      },
    },
    {
      name: "null mapper",
      boundedBatch: {
        selectItems: () => ({ items: ["a"] }),
        mapBatchArgs: () => null as never,
      },
    },
  ])(
    "rejects a typed $name without reserving or dispatching",
    async ({ boundedBatch }) => {
      const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
      const runMutation = vi.fn(async () => null);
      await expect(
        runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
          ...v2Input(v2BoundedBatchGraph()),
          principal: childPrincipal,
          workflowRegistry: {
            [childWorkflowRef]: { ...childWorkflowEntry, boundedBatch },
          },
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        }),
      ).rejects.toThrow("Workflow bounded subworkflow batch rejected.");
      expect(runMutation).not.toHaveBeenCalled();
      expect(runWorkflow).not.toHaveBeenCalled();
    },
  );

  it("reconciles a reservation when exact final child args exceed the budget", async () => {
    const outcomes: unknown[] = [];
    const runWorkflow = vi.fn(async () => ({ receiptId: "unreachable" }));
    const runMutation = vi.fn(async (ref, args: Record<string, unknown>) => {
      if (ref === childLinkReserveRef) {
        return {
          linkId: "link-final-size",
          childWorkflowRunId: "run-final-size",
        };
      }
      if (ref === childLinkReconcileRef) outcomes.push(args.outcome);
      return null;
    });
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow, runMutation }), {
        ...v2Input(
          v2BoundedBatchGraph({
            maxItems: 1,
            batchSize: 1,
            fanOut: 1,
            payloadPolicy: { ...payloadPolicy, maxInputBytes: 64 },
          }),
        ),
        principal: childPrincipal,
        workflowRegistry: { [childWorkflowRef]: registryEntry(["a"]) },
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/mapped args use/);
    expect(runWorkflow).not.toHaveBeenCalled();
    expect(outcomes).toEqual([
      { kind: "failed", error: "Child workflow failed." },
    ]);
  });

  it("size-checks batch args and reconciles cancellation", async () => {
    const oversized = {
      ...registryEntry(["a", "b"]),
      boundedBatch: {
        selectItems: () => ({ items: ["a", "b"] }),
        mapBatchArgs: ({
          batch,
        }: {
          readonly batch: { readonly items: readonly unknown[] };
        }) => ({
          requestId: batch.items[0] === "a" ? "ok" : "x".repeat(2048),
        }),
      },
    };
    const noDispatch = vi.fn(async () => ({ receiptId: "unreachable" }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runWorkflow: noDispatch }), {
        ...v2Input(
          v2BoundedBatchGraph({
            payloadPolicy: { ...payloadPolicy, maxInputBytes: 64 },
            maxItems: 2,
            batchSize: 1,
            fanOut: 2,
          }),
        ),
        principal: childPrincipal,
        workflowRegistry: { [childWorkflowRef]: oversized },
        capabilityRegistry: {},
        admitEffect: async () => ({ kind: "deny", reason: "not used" }),
      }),
    ).rejects.toThrow(/mapped args use/);
    expect(noDispatch).not.toHaveBeenCalled();

    const reconciled: Record<string, unknown>[] = [];
    const runMutation = vi.fn(async (ref, args: Record<string, unknown>) => {
      if (ref === childLinkReserveRef) {
        return { linkId: "link-cancel", childWorkflowRunId: "run-cancel" };
      }
      if (ref === childLinkReconcileRef) reconciled.push(args);
      return null;
    });
    await expect(
      runDurableGraphWorkflowV2(
        v2Step({
          runMutation,
          runWorkflow: async () => {
            throw new Error("Canceled");
          },
        }),
        {
          ...v2Input(v2BoundedBatchGraph({ batchSize: 1, fanOut: 1 })),
          principal: childPrincipal,
          workflowRegistry: { [childWorkflowRef]: registryEntry(["a"]) },
          capabilityRegistry: {},
          admitEffect: async () => ({ kind: "deny", reason: "not used" }),
        },
      ),
    ).rejects.toThrow("Canceled");
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]?.outcome).toEqual({ kind: "canceled" });
  });
});
