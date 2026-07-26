import {
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server";
import { ConvexError, v } from "convex/values";

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
      if (exact && existing.state === "scheduled" && existing.workId) {
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
      });
      return { kind: "replace" as const, priorWorkId: priorWorkId ?? null };
    }
    await ctx.db.insert("schedules", { ...args, state: "preparing" });
    return { kind: "create" as const, priorWorkId: null };
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
      state: "scheduled",
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
