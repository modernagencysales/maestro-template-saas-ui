import { v } from "convex/values";
import { localWorkflowComponents as components } from "../../confect/workflows/_kit/localComponentRefs";
import {
  internalMutation,
  internalQuery,
} from "../../convex/_generated/server";

const policy = {
  user: { maxActive: 1, maxQueued: 1, retryAfterMs: 1_000 },
  system: { maxActive: 1, maxQueued: 1, retryAfterMs: 1_000 },
};
const admission = components.workflowAdmission.admission;
const deadline = components.workflowDeadline.deadlines;

export const admitRunning = internalMutation({
  args: {
    workspaceId: v.string(),
    workflowRunId: v.string(),
    reservationKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(admission.reserve, {
      workspaceId: args.workspaceId,
      reservationKey: args.reservationKey,
      lane: "user",
      policy,
      legacyRunningRunIds: [],
      legacyQueuedRunIds: [],
    });
    await ctx.runMutation(admission.bind, args);
    await ctx.runMutation(admission.transition, {
      workflowRunId: args.workflowRunId,
      status: "running",
    });
    return null;
  },
});

export const admitNext = internalMutation({
  args: { workspaceId: v.string(), reservationKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(admission.reserve, {
      ...args,
      lane: "user",
      policy,
      legacyRunningRunIds: [],
      legacyQueuedRunIds: [],
    });
    return null;
  },
});

export const bindInvalidDeadlineWork = internalMutation({
  args: {
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const replacement = {
      ...args,
      requestedAt: args.requestedAt + 1,
      deadlineAt: args.deadlineAt + 1,
      runAt: args.runAt + 1,
    };
    await ctx.runMutation(deadline.prepare, replacement);
    await ctx.runMutation(deadline.bind, {
      scheduleKey: args.scheduleKey,
      requestedAt: replacement.requestedAt,
      workId: "invalid-work-id",
    });
    return null;
  },
});

export const currentDeadline = internalQuery({
  args: { workflowRunId: v.string(), generation: v.number() },
  handler: async (ctx, args) => await ctx.runQuery(deadline.current, args),
});
