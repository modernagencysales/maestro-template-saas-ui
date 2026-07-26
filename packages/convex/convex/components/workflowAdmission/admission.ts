import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

const lane = v.union(v.literal("user"), v.literal("system"));
const status = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled"),
  v.literal("timedOut"),
);
const budget = v.object({
  maxActive: v.number(),
  maxQueued: v.number(),
  retryAfterMs: v.number(),
});

export const reserve = mutation({
  args: {
    workspaceId: v.string(),
    reservationKey: v.string(),
    lane,
    policy: v.object({ user: budget, system: budget }),
    legacyRunningRunIds: v.array(v.string()),
    legacyQueuedRunIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    for (const selected of [args.policy.user, args.policy.system]) {
      if (
        !Number.isInteger(selected.maxActive) ||
        selected.maxActive < 0 ||
        !Number.isInteger(selected.maxQueued) ||
        selected.maxQueued < 0 ||
        !Number.isInteger(selected.retryAfterMs) ||
        selected.retryAfterMs <= 0
      ) {
        throw new ConvexError("WORKFLOW_ADMISSION_POLICY_INVALID");
      }
    }
    const existing = await ctx.db
      .query("reservations")
      .withIndex("workspace_key", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("reservationKey", args.reservationKey),
      )
      .unique();
    if (existing) {
      if (existing.lane !== args.lane)
        throw new ConvexError("WORKFLOW_ADMISSION_CONFLICT");
      return null;
    }

    const initialized = await ctx.db
      .query("workspaces")
      .withIndex("workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (!initialized) {
      await ctx.db.insert("workspaces", { workspaceId: args.workspaceId });
      for (const [legacyStatus, runIds] of [
        ["running", args.legacyRunningRunIds],
        ["queued", args.legacyQueuedRunIds],
      ] as const) {
        for (const workflowRunId of runIds) {
          await ctx.db.insert("reservations", {
            workspaceId: args.workspaceId,
            reservationKey: `legacy:${workflowRunId}`,
            workflowRunId,
            lane: "user",
            status: legacyStatus,
          });
        }
      }
    }

    const selected = args.policy[args.lane];
    const active = await ctx.db
      .query("reservations")
      .withIndex("workspace_lane_status", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("lane", args.lane)
          .eq("status", "running"),
      )
      .take(Math.max(1, selected.maxActive));
    const queued = await ctx.db
      .query("reservations")
      .withIndex("workspace_lane_status", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("lane", args.lane)
          .eq("status", "queued"),
      )
      .take(Math.max(1, selected.maxQueued));
    const saturated =
      active.length >= selected.maxActive
        ? "active"
        : queued.length >= selected.maxQueued
          ? "queued"
          : null;
    if (saturated !== null) {
      throw new ConvexError({
        code: "WORKFLOW_ADMISSION_DENIED",
        lane: args.lane,
        saturated,
        active: Math.min(active.length, selected.maxActive),
        queued: Math.min(queued.length, selected.maxQueued),
        limit: saturated === "active" ? selected.maxActive : selected.maxQueued,
        retryAfterMs: selected.retryAfterMs,
      });
    }
    await ctx.db.insert("reservations", {
      workspaceId: args.workspaceId,
      reservationKey: args.reservationKey,
      lane: args.lane,
      status: "queued",
    });
    return null;
  },
});

export const bind = mutation({
  args: {
    workspaceId: v.string(),
    reservationKey: v.string(),
    workflowRunId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reservations")
      .withIndex("workspace_key", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("reservationKey", args.reservationKey),
      )
      .unique();
    if (!existing)
      throw new ConvexError("WORKFLOW_ADMISSION_RESERVATION_MISSING");
    if (
      existing.workflowRunId &&
      existing.workflowRunId !== args.workflowRunId
    ) {
      throw new ConvexError("WORKFLOW_ADMISSION_BINDING_CONFLICT");
    }
    await ctx.db.patch(existing._id, { workflowRunId: args.workflowRunId });
    return null;
  },
});

export const transition = mutation({
  args: { workflowRunId: v.string(), status },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reservations")
      .withIndex("run", (q) => q.eq("workflowRunId", args.workflowRunId))
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, { status: args.status });
    return null;
  },
});
