import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNonRetryableError } from "@convex-dev/workpool";
import * as Schema from "effect/Schema";
import {
  conformanceApi,
  createWorkflowHarness,
} from "./helpers/workflowHarness";
import { adversarialWorkflowDrafts } from "./fixtures/workflows/adversarial";
import { findWorkflowConformanceIssues } from "./fixtures/workflows/conformanceChecks";
import {
  WorkflowCapabilityReference,
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
import type { WorkflowEffectContract } from "../confect/workflows/_kit/effectReservations";
import { runObservedWorkflowStage } from "../confect/workflows/_kit/observedStage";

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

describe("Maestro V2 action retry compiler", () => {
  it("starts a complete V2 ready wave and waits for its all-successful join", async () => {
    const started: string[] = [];
    const resolvers = new Map<string, (value: unknown) => void>();
    const runQuery = vi.fn(
      async (_ref: unknown, args: Record<string, unknown>) => {
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
      async (_ref: unknown, args: Record<string, unknown>) => ({
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
        _ref: unknown,
        args: Record<string, unknown>,
        options?: Record<string, unknown>,
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

  it("passes the stable name and exact explicit retry options", async () => {
    const actionRef =
      "compiler.v2.action" as unknown as DurableGraphStepRef<"action">;
    const runAction = vi.fn(async () => ({ accepted: true }));
    const admitEffect = vi.fn(async () => ({ kind: "dispatch" as const }));
    const graph = v2CapabilityGraph("action", {
      maxAttempts: 4,
      initialBackoffMs: 125,
      base: 2,
    });

    await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2Input(graph),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: actionRef,
          effectClass: "external",
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
  });

  it("uses retry false for a non-retriable action", async () => {
    const runAction = vi.fn(async () => ({ accepted: true }));
    const graph = v2CapabilityGraph("action");
    await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2Input(graph),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
          effectClass: "external",
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
        ...v2Input(graph),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
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

  it("does not call the provider after admission denial", async () => {
    const runAction = vi.fn(async () => ({ accepted: true }));
    await expect(
      runDurableGraphWorkflowV2(v2Step({ runAction }), {
        ...v2Input(v2CapabilityGraph("action")),
        capabilityRegistry: {
          [capabilityRef]: {
            kind: "action",
            ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
            effectClass: "external",
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
      ...v2Input(v2CapabilityGraph("action")),
      capabilityRegistry: {
        [capabilityRef]: {
          kind: "action",
          ref: "compiler.v2.action" as unknown as DurableGraphStepRef<"action">,
          effectClass: "external",
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
      async (_ref: unknown, args: Record<string, unknown>) => args,
    );
    await runDurableGraphWorkflowV2(v2Step({ runAction }), {
      ...v2Input(
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
    async (_case, buildArgs) => {
      const runAction = vi.fn(async () => ({ accepted: true }));
      await expect(
        runDurableGraphWorkflowV2(v2Step({ runAction }), {
          ...v2Input(
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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("distinguishes eager-first-poll from queued kickoff", async () => {
    const eager = createWorkflowHarness();
    const eagerId = await eager.mutation(conformanceApi.startEagerFailure, {});
    const eagerStatus = await eager.query(conformanceApi.workflow.getStatus, {
      workflowId: eagerId,
    });
    expect(eagerStatus.workflow.runResult).toMatchObject({ kind: "failed" });

    const queued = createWorkflowHarness();
    const queuedId = await queued.mutation(
      conformanceApi.startQueuedFailure,
      {},
    );
    const queuedStatus = await queued.query(conformanceApi.workflow.getStatus, {
      workflowId: queuedId,
    });
    expect(queuedStatus.workflow.runResult).toBeUndefined();
  });

  it("consumes an event that arrives before its wait step", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(
      conformanceApi.startEventBeforeWait,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).resolves.toEqual({ type: "completed", result: true });
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
  });

  it("dispatches Promise.all steps as parallel component work", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.startParallel, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
  });

  it("selects the latest duplicate restart name and truncates its tail", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(
      conformanceApi.startRestartWorkflow,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query(conformanceApi.workflowStatus, { workflowId }),
    ).resolves.toEqual({ type: "completed", result: "preserved" });
    expect(callbackFailure).toHaveBeenCalledWith(
      "Error calling onComplete",
      expect.stringContaining("missingOnComplete"),
    );
    callbackFailure.mockRestore();
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
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
  principal: { kind: "system" },
  policySnapshot: { kind: "none" },
  effectIdentity: {
    workspaceId: "workspace-1",
    workflowRunId: "run-1",
    generation: 0,
  },
  projectOutput: ({
    context,
  }: {
    context: Readonly<Record<string, unknown>>;
  }) => ({
    status: "completed",
    context,
  }),
});

const v2Step = (
  overrides: Partial<RunDurableGraphStep>,
): RunDurableGraphStep => ({
  runQuery: async () => undefined,
  runMutation: async () => undefined,
  runAction: async () => undefined,
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
