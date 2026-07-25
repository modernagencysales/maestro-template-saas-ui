import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conformanceApi,
  createWorkflowHarness,
} from "./helpers/workflowHarness";
import { adversarialWorkflowDrafts } from "./fixtures/workflows/adversarial";
import { findWorkflowConformanceIssues } from "./fixtures/workflows/conformanceChecks";

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
    const workflowId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "event-before-wait",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      startAsync: true,
    });
    const eventId = await t.mutation(conformanceApi.event.send, {
      workflowId,
      name: "approved",
      result: { kind: "success", returnValue: { approved: true } },
    });
    const entries = await t.mutation(conformanceApi.journal.startSteps, {
      workflowId,
      generationNumber: 0,
      steps: [
        {
          step: {
            kind: "event",
            name: "approved",
            inProgress: true,
            argsSize: 0,
            args: { eventId },
            startedAt: Date.now(),
          },
        },
      ],
    });
    expect(entries[0]?.step).toMatchObject({
      kind: "event",
      inProgress: false,
      eventId,
    });
  });

  it("lists with pagination and exposes cancellation before cleanup", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "lifecycle",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      startAsync: true,
    });
    const listed = await t.query(conformanceApi.workflow.list, {
      order: "asc",
      paginationOpts: { cursor: null, numItems: 1 },
    });
    expect(listed.page).toHaveLength(1);
    expect(listed.page[0]?.workflowId).toBe(workflowId);

    await t.mutation(conformanceApi.workflow.cancel, { workflowId });
    const canceled = await t.query(conformanceApi.workflow.getStatus, {
      workflowId,
    });
    expect(canceled.workflow.runResult).toMatchObject({ kind: "canceled" });

    await expect(
      t.mutation(conformanceApi.workflow.cleanup, { workflowId }),
    ).resolves.toBe(true);
    await expect(
      t.query(conformanceApi.workflow.getStatus, { workflowId }),
    ).rejects.toThrow("Workflow not found");
  });

  it("starts parallel component work and truncates restarts from the latest duplicate name", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "parallel-and-restart",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      startAsync: true,
    });
    const parallel = await t.mutation(conformanceApi.journal.startSteps, {
      workflowId,
      generationNumber: 0,
      steps: ["left", "right"].map((name) => ({
        step: {
          kind: "function" as const,
          functionType: "mutation" as const,
          handle: "function://;workflowConformance:echoStep",
          name,
          inProgress: true,
          argsSize: 0,
          args: { value: name },
          startedAt: Date.now(),
        },
      })),
    });
    expect(
      parallel.map((entry) =>
        entry.step.kind === "function" ? entry.step.workId : undefined,
      ),
    ).toEqual([expect.any(String), expect.any(String)]);

    await t.mutation(conformanceApi.workflow.cancel, { workflowId });
    const restartId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "duplicate-restart",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      startAsync: true,
    });
    await t.mutation(conformanceApi.journal.startSteps, {
      workflowId: restartId,
      generationNumber: 0,
      steps: ["duplicate", "middle", "duplicate", "tail"].map((name) => ({
        step: completedMutationStep(name),
      })),
    });
    await t.mutation(conformanceApi.workflow.complete, {
      workflowId: restartId,
      generationNumber: 0,
      runResult: { kind: "failed", error: "characterized failure" },
    });
    await t.mutation(conformanceApi.workflow.restart, {
      workflowId: restartId,
      from: "duplicate",
      startAsync: true,
    });
    const retained = await t.query(conformanceApi.workflow.listSteps, {
      workflowId: restartId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(retained.page.map((step) => step.name)).toEqual([
      "duplicate",
      "middle",
    ]);
  });

  it("cascades subworkflow cancellation and continues nested cleanup asynchronously", async () => {
    const t = createWorkflowHarness();
    const parentId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "parent",
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
            name: "child",
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
      throw new Error("component did not create the nested workflow");
    }
    const childId = child.workflowId;

    await t.mutation(conformanceApi.workflow.cancel, { workflowId: parentId });
    const childStatus = await t.query(conformanceApi.workflow.getStatus, {
      workflowId: childId,
    });
    expect(childStatus.workflow.runResult).toMatchObject({ kind: "canceled" });

    await t.mutation(conformanceApi.workflow.cleanup, { workflowId: parentId });
    expect(
      await t.query(conformanceApi.workflow.getStatus, { workflowId: childId }),
    ).toBeDefined();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query(conformanceApi.workflow.getStatus, { workflowId: childId }),
    ).rejects.toThrow("Workflow not found");
  });

  it("preserves the terminal result when onComplete fails and cleans a large journal", async () => {
    const t = createWorkflowHarness();
    const workflowId = await t.mutation(conformanceApi.workflow.create, {
      workflowName: "on-complete-and-cleanup",
      workflowHandle: "function://;workflowConformance:terminalFailure",
      workflowArgs: {},
      onComplete: {
        fnHandle: "function://;missing:onComplete",
        context: { test: true },
      },
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
    const completed = await t.query(conformanceApi.workflow.getStatus, {
      workflowId,
    });
    expect(completed.workflow.runResult).toEqual({
      kind: "success",
      returnValue: "preserved",
    });
    await expect(
      t.mutation(conformanceApi.workflow.cleanup, { workflowId }),
    ).resolves.toBe(true);
  });
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
