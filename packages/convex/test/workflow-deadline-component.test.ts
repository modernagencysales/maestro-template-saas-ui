import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/components/workflowDeadline/schema";

const modules = {
  ...import.meta.glob("../convex/components/workflowDeadline/**/*.ts"),
  "../convex/components/workflowDeadline/_generated/server.ts":
    async () => ({}),
};
const prepare = makeFunctionReference<"mutation">("deadlines:prepare");
const bind = makeFunctionReference<"mutation">("deadlines:bind");
const prepareRetry = makeFunctionReference<"mutation">(
  "deadlines:prepareRetry",
);
const current = makeFunctionReference<"query">("deadlines:current");
const observe = makeFunctionReference<"mutation">("deadlines:observe");
const beginReconcile = makeFunctionReference<"query">(
  "deadlines:beginReconcile",
);
const completeReconcile = makeFunctionReference<"mutation">(
  "deadlines:completeReconcile",
);

const schedule = (requestedAt = 1_000) => ({
  workspaceId: "workspace-a",
  workflowRunId: "run-a",
  workflowId: "workflow.invoice",
  workflowVersion: 3,
  generation: 0,
  scheduleKey: "workflow-deadline.v1|workspace-a|run-a|3|0",
  requestedAt,
  horizonMs: 500,
  deadlineAt: requestedAt + 500,
  runAt: requestedAt + 500,
});

describe("workflow deadline component", () => {
  it("persists, replays, replaces, observes, and reconciles one generation schedule", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(prepare, schedule())).resolves.toEqual({
      kind: "create",
      priorWorkId: null,
    });
    await t.mutation(bind, {
      scheduleKey: schedule().scheduleKey,
      requestedAt: schedule().requestedAt,
      workId: "work-a",
    });
    await expect(t.mutation(prepare, schedule())).resolves.toEqual({
      kind: "replay",
      priorWorkId: "work-a",
    });
    await expect(t.mutation(prepare, schedule(1_100))).resolves.toEqual({
      kind: "replace",
      priorWorkId: "work-a",
    });
    await t.mutation(bind, {
      scheduleKey: schedule().scheduleKey,
      requestedAt: 1_100,
      workId: "work-b",
    });
    await expect(
      t.mutation(observe, {
        scheduleKey: schedule().scheduleKey,
        requestedAt: 1_100,
        state: "timedOut",
        actualStartedAt: 1_625,
        latenessMs: 25,
        expired: true,
        expiredByMs: 25,
      }),
    ).resolves.toBe(true);
    await expect(
      t.query(current, { workflowRunId: "run-a", generation: 0 }),
    ).resolves.toMatchObject({
      state: "timedOut",
      workId: "work-b",
      actualStartedAt: 1_625,
      expired: true,
    });
    await expect(
      t.mutation(observe, {
        scheduleKey: schedule().scheduleKey,
        requestedAt: 1_100,
        state: "noOp",
        actualStartedAt: 1_650,
        latenessMs: 50,
        expired: true,
        expiredByMs: 50,
        noOpReason: "terminal-run",
      }),
    ).resolves.toBe(false);
    await expect(
      t.query(current, { workflowRunId: "run-a", generation: 0 }),
    ).resolves.toMatchObject({ state: "timedOut", actualStartedAt: 1_625 });
    await expect(
      t.query(beginReconcile, { workflowRunId: "run-a", generation: 0 }),
    ).resolves.toBe("work-b");
    // A failed external cancel leaves the exact work identity available to retry.
    await expect(
      t.query(beginReconcile, { workflowRunId: "run-a", generation: 0 }),
    ).resolves.toBe("work-b");
    await expect(
      t.mutation(completeReconcile, {
        workflowRunId: "run-a",
        generation: 0,
        workId: "work-b",
      }),
    ).resolves.toBe(true);
    await expect(
      t.query(beginReconcile, { workflowRunId: "run-a", generation: 0 }),
    ).resolves.toBeNull();
  });

  it("rejects a schedule-key collision across authorities", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(prepare, schedule());
    await expect(
      t.mutation(prepare, { ...schedule(), workspaceId: "workspace-b" }),
    ).rejects.toMatchObject({ data: "WORKFLOW_DEADLINE_IDENTITY_CONFLICT" });
  });

  it("persists bounded retry attempts and rejects duplicate completion recovery", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(prepare, schedule());
    await t.mutation(bind, {
      scheduleKey: schedule().scheduleKey,
      requestedAt: schedule().requestedAt,
      workId: "work-a",
    });
    await expect(
      t.mutation(prepareRetry, {
        scheduleKey: schedule().scheduleKey,
        requestedAt: schedule().requestedAt,
        completedWorkId: "work-a",
        failedAt: 2_000,
      }),
    ).resolves.toEqual({ kind: "retry", attemptCount: 1, retryAt: 2_250 });
    await expect(
      t.mutation(prepareRetry, {
        scheduleKey: schedule().scheduleKey,
        requestedAt: schedule().requestedAt,
        completedWorkId: "work-a",
        failedAt: 2_001,
      }),
    ).resolves.toEqual({ kind: "stale" });
    await t.mutation(bind, {
      scheduleKey: schedule().scheduleKey,
      requestedAt: schedule().requestedAt,
      workId: "work-b",
    });
    await expect(
      t.query(current, { workflowRunId: "run-a", generation: 0 }),
    ).resolves.toMatchObject({
      state: "retryScheduled",
      workId: "work-b",
      attemptCount: 1,
      retryAt: 2_250,
      lastFailureAt: 2_000,
    });
  });
});
