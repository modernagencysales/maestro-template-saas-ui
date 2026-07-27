import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const schedule = {
  workspaceId: v.string(),
  workflowRunId: v.string(),
  workflowId: v.string(),
  workflowVersion: v.number(),
  generation: v.number(),
  scheduleKey: v.string(),
  requestedAt: v.number(),
  horizonMs: v.number(),
  deadlineAt: v.number(),
  runAt: v.number(),
};

const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_BACKOFF_MS = 250;

export const prepare = mutation({
  args: schedule,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedules")
      .withIndex("schedule_key", (q) => q.eq("scheduleKey", args.scheduleKey))
      .unique();
    if (existing) {
      if (
        existing.workspaceId !== args.workspaceId ||
        existing.workflowRunId !== args.workflowRunId ||
        existing.workflowId !== args.workflowId ||
        existing.workflowVersion !== args.workflowVersion ||
        existing.generation !== args.generation
      ) {
        throw new ConvexError("WORKFLOW_DEADLINE_IDENTITY_CONFLICT");
      }
      const exact =
        existing.requestedAt === args.requestedAt &&
        existing.horizonMs === args.horizonMs &&
        existing.deadlineAt === args.deadlineAt &&
        existing.runAt === args.runAt;
      if (
        exact &&
        (existing.state === "scheduled" ||
          existing.state === "retryScheduled") &&
        existing.workId
      ) {
        return { kind: "replay" as const, priorWorkId: existing.workId };
      }
      const priorWorkId = existing.workId;
      await ctx.db.patch(existing._id, {
        ...args,
        state: "preparing",
        workId: undefined,
        actualStartedAt: undefined,
        latenessMs: undefined,
        expired: undefined,
        expiredByMs: undefined,
        noOpReason: undefined,
        attemptCount: 0,
        retryAt: undefined,
        lastFailureAt: undefined,
      });
      return { kind: "replace" as const, priorWorkId: priorWorkId ?? null };
    }
    await ctx.db.insert("schedules", {
      ...args,
      state: "preparing",
      attemptCount: 0,
    });
    return { kind: "create" as const, priorWorkId: null };
  },
});

export const prepareRetry = mutation({
  args: {
    scheduleKey: v.string(),
    requestedAt: v.number(),
    completedWorkId: v.string(),
    failedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedules")
      .withIndex("schedule_key", (q) => q.eq("scheduleKey", args.scheduleKey))
      .unique();
    if (
      !existing ||
      existing.requestedAt !== args.requestedAt ||
      existing.workId !== args.completedWorkId ||
      existing.state === "timedOut" ||
      existing.state === "reconciled" ||
      existing.state === "noOp" ||
      existing.state === "failed"
    ) {
      return { kind: "stale" as const };
    }
    const attemptCount = (existing.attemptCount ?? 0) + 1;
    if (attemptCount > MAX_RECOVERY_ATTEMPTS) {
      await ctx.db.patch(existing._id, {
        state: "failed",
        attemptCount,
        lastFailureAt: args.failedAt,
        retryAt: undefined,
      });
      return { kind: "exhausted" as const, attemptCount };
    }
    const retryAt =
      args.failedAt + RECOVERY_BACKOFF_MS * 2 ** (attemptCount - 1);
    await ctx.db.patch(existing._id, {
      state: "preparing",
      workId: undefined,
      attemptCount,
      lastFailureAt: args.failedAt,
      retryAt,
    });
    return { kind: "retry" as const, attemptCount, retryAt };
  },
});

export const bind = mutation({
  args: {
    scheduleKey: v.string(),
    requestedAt: v.number(),
    workId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedules")
      .withIndex("schedule_key", (q) => q.eq("scheduleKey", args.scheduleKey))
      .unique();
    if (!existing || existing.requestedAt !== args.requestedAt) {
      throw new ConvexError("WORKFLOW_DEADLINE_SCHEDULE_REPLACED");
    }
    if (existing.workId && existing.workId !== args.workId) {
      throw new ConvexError("WORKFLOW_DEADLINE_WORK_BINDING_CONFLICT");
    }
    await ctx.db.patch(existing._id, {
      state: (existing.attemptCount ?? 0) > 0 ? "retryScheduled" : "scheduled",
      workId: args.workId,
    });
    return null;
  },
});

export const current = query({
  args: { workflowRunId: v.string(), generation: v.number() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("schedules")
      .withIndex("run_generation", (q) =>
        q
          .eq("workflowRunId", args.workflowRunId)
          .eq("generation", args.generation),
      )
      .unique(),
});

export const observe = mutation({
  args: {
    scheduleKey: v.string(),
    requestedAt: v.number(),
    state: v.union(v.literal("timedOut"), v.literal("noOp")),
    actualStartedAt: v.number(),
    latenessMs: v.number(),
    expired: v.boolean(),
    expiredByMs: v.number(),
    noOpReason: v.optional(
      v.union(
        v.literal("terminal-run"),
        v.literal("stale-generation"),
        v.literal("stale-schedule"),
        v.literal("deadline-not-reached"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedules")
      .withIndex("schedule_key", (q) => q.eq("scheduleKey", args.scheduleKey))
      .unique();
    if (!existing || existing.requestedAt !== args.requestedAt) return false;
    if (existing.state === "timedOut" && args.state === "noOp") return false;
    await ctx.db.patch(existing._id, args);
    return true;
  },
});

export const beginReconcile = query({
  args: { workflowRunId: v.string(), generation: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedules")
      .withIndex("run_generation", (q) =>
        q
          .eq("workflowRunId", args.workflowRunId)
          .eq("generation", args.generation),
      )
      .unique();
    if (!existing || existing.state === "reconciled") return null;
    return existing.workId ?? null;
  },
});

export const completeReconcile = mutation({
  args: {
    workflowRunId: v.string(),
    generation: v.number(),
    workId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedules")
      .withIndex("run_generation", (q) =>
        q
          .eq("workflowRunId", args.workflowRunId)
          .eq("generation", args.generation),
      )
      .unique();
    if (!existing || existing.state === "reconciled") return false;
    if (existing.workId !== args.workId) {
      throw new ConvexError("WORKFLOW_DEADLINE_RECONCILE_CONFLICT");
    }
    await ctx.db.patch(existing._id, { state: "reconciled" });
    return true;
  },
});
