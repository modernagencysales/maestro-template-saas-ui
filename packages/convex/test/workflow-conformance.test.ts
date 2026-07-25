import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conformanceApi,
  createWorkflowHarness,
} from "./helpers/workflowHarness";
import { adversarialWorkflowDrafts } from "./fixtures/workflows/adversarial";
import { findWorkflowConformanceIssues } from "./fixtures/workflows/conformanceChecks";
import type { DurableWorkflowGraph } from "../confect/workflows/graph";
import {
  runDurableGraphWorkflow,
  type DurableGraphStepRef,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunner";

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
