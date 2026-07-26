import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import workpoolSchema from "../node_modules/@convex-dev/workpool/src/component/schema";
import appSchema from "../confect/_generated/convexSchema";
import deadlineSchema from "../convex/workflowDeadline/schema";

const appModules = {
  ...import.meta.glob("../convex/workflows/deadlinesCurrent.ts"),
  "../convex/_generated/server.ts": async () => ({}),
};
const deadlineModules = {
  ...import.meta.glob("../convex/workflowDeadline/**/*.ts"),
  "../convex/workflowDeadline/_generated/server.ts": async () => ({}),
};
const workpoolModules = import.meta.glob([
  "../node_modules/@convex-dev/workpool/src/component/**/*.ts",
  "!../node_modules/@convex-dev/workpool/src/component/**/*.test.ts",
]);
const scheduleRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:schedule",
);
const fireRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:fire",
);

describe("workflow deadline app adapter", () => {
  it("persists a replay-safe deadline through the dedicated Workpool", async () => {
    const t = convexTest(appSchema, appModules);
    t.registerComponent("workflowDeadline", deadlineSchema, deadlineModules);
    t.registerComponent(
      "workflowDeadlineWorkpool",
      workpoolSchema,
      workpoolModules,
    );
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
});
