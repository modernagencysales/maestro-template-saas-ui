import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import workpoolSchema from "../node_modules/@convex-dev/workpool/src/component/schema";
import appSchema from "../confect/_generated/convexSchema";
import deadlineSchema from "../convex/components/workflowDeadline/schema";
import admissionSchema from "../convex/components/workflowAdmission/schema";
import workflowFixtureSchema from "./fixtures/workflow-deadline-workflow/schema";

const appModules = {
  ...import.meta.glob("../convex/workflows/deadlinesCurrent.ts"),
  "../convex/workflowDeadlineHarness.ts": () =>
    import("./fixtures/workflow-deadline-harness"),
  "../convex/_generated/server.ts": async () => ({}),
};
const deadlineModules = {
  ...import.meta.glob("../convex/components/workflowDeadline/**/*.ts"),
  "../convex/components/workflowDeadline/_generated/server.ts":
    async () => ({}),
};
const workpoolModules = import.meta.glob([
  "../node_modules/@convex-dev/workpool/src/component/**/*.ts",
  "!../node_modules/@convex-dev/workpool/src/component/**/*.test.ts",
]);
const admissionModules = import.meta.glob(
  "../convex/components/workflowAdmission/**/*.ts",
);
const workflowFixtureModules = {
  "../convex/workflow.ts": () =>
    import("./fixtures/workflow-deadline-workflow/workflow"),
  "../convex/_generated/server.ts": async () => ({}),
};
const scheduleRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:schedule",
);
const fireRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:fire",
);
const recoverRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:recover",
);
const admitRunningRef = makeFunctionReference<"mutation">(
  "workflowDeadlineHarness:admitRunning",
);
const admitNextRef = makeFunctionReference<"mutation">(
  "workflowDeadlineHarness:admitNext",
);
const bindInvalidWorkRef = makeFunctionReference<"mutation">(
  "workflowDeadlineHarness:bindInvalidDeadlineWork",
);
const currentDeadlineRef = makeFunctionReference<"query">(
  "workflowDeadlineHarness:currentDeadline",
);

afterEach(() => vi.useRealTimers());

const registerComponents = (t: ReturnType<typeof convexTest>) => {
  t.registerComponent("workflowDeadline", deadlineSchema, deadlineModules);
  t.registerComponent(
    "workflowDeadlineWorkpool",
    workpoolSchema,
    workpoolModules,
  );
  t.registerComponent("workflowAdmission", admissionSchema, admissionModules);
  t.registerComponent(
    "workflow",
    workflowFixtureSchema,
    workflowFixtureModules,
  );
};

describe("workflow deadline app adapter", () => {
  it("persists a replay-safe deadline through the dedicated Workpool", async () => {
    const t = convexTest(appSchema, appModules);
    registerComponents(t);
    const { workspaceId, workflowRunId } = await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", {
        organizationId: "organization-a",
        ownerUserId: "user-a",
        slug: "workspace-a",
        name: "Workspace A",
        status: "active",
        dataClassification: "internal",
        createdAt: 1,
        updatedAt: 1,
      });
      const workflowRunId = await ctx.db.insert("workflowRuns", {
        workspaceId,
        workflowId: "workflow.invoice",
        workflowVersion: 3,
        graphJson: "{}",
        status: "running",
        idempotencyKey: "deadline-app-integration",
        startedByUserId: "user-a",
        startedAt: 1,
        completedAt: null,
        failedAt: null,
        trustReceiptId: null,
        componentWorkflowId: "component-run-a",
        lifecycleExecution: "active",
        lifecycleGeneration: 0,
        lifecycleGenerationAnchor: "workflow.invoice@v3:g0",
        lifecycleRestartAnchor: null,
        priorGenerationQuiescence: "not-applicable",
        cleanupState: "not-requested",
        componentCleanupState: "not-requested",
        componentResidualState: "not-assessed",
        principalSnapshot: {
          version: 2,
          kind: "user",
          workspaceId: String(workspaceId),
          actorId: "user-a",
          role: "admin",
          grants: ["workflow:start"],
          authEpoch: 1,
          kickoffAt: 1,
          provenance: "authenticated-workflow-start",
        },
        policySnapshot: null,
      });
      return { workspaceId, workflowRunId };
    });
    const requestedAt = Date.now() + 60_000;
    const args = { workspaceId, workflowRunId, requestedAt, horizonMs: 60_000 };
    const scheduled = await t.mutation(scheduleRef, args);
    expect(scheduled).toMatchObject({
      kind: "scheduled",
      workflowRunId: String(workflowRunId),
      generation: 0,
    });
    await expect(t.mutation(scheduleRef, args)).resolves.toMatchObject({
      kind: "scheduled",
      requestedAt,
    });
    await expect(
      t.mutation(scheduleRef, { ...args, requestedAt: requestedAt + 1_000 }),
    ).resolves.toMatchObject({
      kind: "scheduled",
      requestedAt: requestedAt + 1_000,
    });
    await expect(
      t.run(async (ctx) => await ctx.db.get(workflowRunId)),
    ).resolves.toMatchObject({
      timeoutMs: 60_000,
      deadlineAt: requestedAt + 61_000,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(workflowRunId, {
        status: "completed",
        lifecycleExecution: "terminal",
      });
    });
    const callback = {
      workspaceId: scheduled.workspaceId,
      workflowRunId: scheduled.workflowRunId,
      workflowId: scheduled.workflowId,
      workflowVersion: scheduled.workflowVersion,
      generation: scheduled.generation,
      scheduleKey: scheduled.scheduleKey,
      requestedAt: scheduled.requestedAt,
      horizonMs: scheduled.horizonMs,
      deadlineAt: scheduled.deadlineAt,
      runAt: scheduled.runAt,
    };
    await expect(t.mutation(fireRef, callback)).resolves.toBeNull();
  });

  it("closes expiry through workflow cancellation and admission release exactly once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const t = convexTest(appSchema, appModules);
    registerComponents(t);
    const { workspaceId, workflowRunId } = await seedRun(t, "expiry-chain");
    await t.mutation(admitRunningRef, {
      workspaceId: String(workspaceId),
      workflowRunId: String(workflowRunId),
      reservationKey: "expiry-chain",
    });
    const scheduled = await t.mutation(scheduleRef, {
      workspaceId,
      workflowRunId,
      requestedAt: 10_000,
      horizonMs: 500,
    });
    vi.setSystemTime(10_525);
    const callback = deadlineCallback(scheduled);
    await expect(t.mutation(fireRef, callback)).resolves.toBeNull();
    await expect(t.mutation(fireRef, callback)).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => await ctx.db.get(workflowRunId)),
    ).resolves.toMatchObject({
      status: "timedOut",
      lifecycleExecution: "canceled",
      timeoutErrorCode: "WORKFLOW_DEADLINE_EXPIRED",
    });
    await expect(
      t.mutation(admitNextRef, {
        workspaceId: String(workspaceId),
        reservationKey: "after-timeout",
      }),
    ).resolves.toBeNull();
  });

  it("rolls back replacement when prior Workpool cancellation fails", async () => {
    const t = convexTest(appSchema, appModules);
    registerComponents(t);
    const { workspaceId, workflowRunId } = await seedRun(t, "cancel-rollback");
    const initial = await t.mutation(scheduleRef, {
      workspaceId,
      workflowRunId,
      requestedAt: Date.now() + 60_000,
      horizonMs: 500,
    });
    await t.mutation(bindInvalidWorkRef, deadlineCallback(initial));
    await expect(
      t.mutation(scheduleRef, {
        workspaceId,
        workflowRunId,
        requestedAt: initial.requestedAt + 2,
        horizonMs: initial.horizonMs,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(currentDeadlineRef, {
        workflowRunId: String(workflowRunId),
        generation: 0,
      }),
    ).resolves.toMatchObject({
      requestedAt: initial.requestedAt + 1,
      workId: "invalid-work-id",
      state: "scheduled",
    });
  });

  it("durably retries a failed expiry transition and ignores duplicate recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const t = convexTest(appSchema, appModules);
    registerComponents(t);
    const { workspaceId, workflowRunId } = await seedRun(t, "retry-once");
    await t.mutation(admitRunningRef, {
      workspaceId: String(workspaceId),
      workflowRunId: String(workflowRunId),
      reservationKey: "retry-once",
    });
    const scheduled = await t.mutation(scheduleRef, {
      workspaceId,
      workflowRunId,
      requestedAt: 20_000,
      horizonMs: 500,
    });
    const callback = deadlineCallback(scheduled);
    const current = await t.query(currentDeadlineRef, {
      workflowRunId: String(workflowRunId),
      generation: 0,
    });
    expect(current?.workId).toEqual(expect.any(String));
    vi.setSystemTime(20_525);
    await expect(t.mutation(fireRef, callback)).rejects.toThrow(
      "INJECTED_WORKFLOW_CANCEL_FAILURE",
    );
    await expect(
      t.run(async (ctx) => await ctx.db.get(workflowRunId)),
    ).resolves.toMatchObject({
      status: "running",
      lifecycleExecution: "active",
    });

    const completion = {
      workId: current?.workId,
      context: callback,
      result: { kind: "failed" as const, error: "redacted transition failure" },
    };
    await t.mutation(recoverRef, completion);
    await expect(
      t.query(currentDeadlineRef, {
        workflowRunId: String(workflowRunId),
        generation: 0,
      }),
    ).resolves.toMatchObject({
      state: "retryScheduled",
      attemptCount: 1,
      retryAt: 20_775,
    });

    await expect(t.mutation(fireRef, callback)).resolves.toBeNull();
    await t.mutation(recoverRef, completion);
    await expect(
      t.run(async (ctx) => await ctx.db.get(workflowRunId)),
    ).resolves.toMatchObject({
      status: "timedOut",
      lifecycleExecution: "canceled",
    });
    await expect(
      t.query(currentDeadlineRef, {
        workflowRunId: String(workflowRunId),
        generation: 0,
      }),
    ).resolves.toMatchObject({ state: "timedOut", attemptCount: 1 });
  });

  it("schedules generation N+1 at the original absolute deadline", async () => {
    const t = convexTest(appSchema, appModules);
    registerComponents(t);
    const { workspaceId, workflowRunId } = await seedRun(t, "restart-deadline");
    const requestedAt = Date.now() + 60_000;
    const original = await t.mutation(scheduleRef, {
      workspaceId,
      workflowRunId,
      requestedAt,
      horizonMs: 500,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(workflowRunId, { lifecycleGeneration: 1 });
    });
    const restarted = await t.mutation(scheduleRef, {
      workspaceId,
      workflowRunId,
      requestedAt,
      horizonMs: 500,
    });
    expect(restarted).toMatchObject({
      generation: 1,
      deadlineAt: original.deadlineAt,
      runAt: original.runAt,
    });
    expect(restarted.scheduleKey).not.toBe(original.scheduleKey);
  });
});

const seedRun = async (
  t: ReturnType<typeof convexTest>,
  idempotencyKey: string,
) =>
  await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      organizationId: "organization-a",
      ownerUserId: "user-a",
      slug: `workspace-${idempotencyKey}`,
      name: "Workspace A",
      status: "active",
      dataClassification: "internal",
      createdAt: 1,
      updatedAt: 1,
    });
    const workflowRunId = await ctx.db.insert("workflowRuns", {
      workspaceId,
      workflowId: "workflow.invoice",
      workflowVersion: 3,
      graphJson: "{}",
      status: "running",
      idempotencyKey,
      startedByUserId: "user-a",
      startedAt: 1,
      completedAt: null,
      failedAt: null,
      trustReceiptId: null,
      componentWorkflowId: `component-${idempotencyKey}`,
      lifecycleExecution: "active",
      lifecycleGeneration: 0,
      lifecycleGenerationAnchor: "workflow.invoice@v3:g0",
      lifecycleRestartAnchor: null,
      priorGenerationQuiescence: "not-applicable",
      cleanupState: "not-requested",
      componentCleanupState: "not-requested",
      componentResidualState: "not-assessed",
      principalSnapshot: {
        version: 2,
        kind: "user",
        workspaceId: String(workspaceId),
        actorId: "user-a",
        role: "admin",
        grants: ["workflow:start"],
        authEpoch: 1,
        kickoffAt: 1,
        provenance: "authenticated-workflow-start",
      },
      policySnapshot: { version: 1, kind: "none", reason: "fixture" },
    });
    return { workspaceId, workflowRunId };
  });

const deadlineCallback = (scheduled: {
  workspaceId: string;
  workflowRunId: string;
  workflowId: string;
  workflowVersion: number;
  generation: number;
  scheduleKey: string;
  requestedAt: number;
  horizonMs: number;
  deadlineAt: number;
  runAt: number;
}) => ({
  workspaceId: scheduled.workspaceId,
  workflowRunId: scheduled.workflowRunId,
  workflowId: scheduled.workflowId,
  workflowVersion: scheduled.workflowVersion,
  generation: scheduled.generation,
  scheduleKey: scheduled.scheduleKey,
  requestedAt: scheduled.requestedAt,
  horizonMs: scheduled.horizonMs,
  deadlineAt: scheduled.deadlineAt,
  runAt: scheduled.runAt,
});
