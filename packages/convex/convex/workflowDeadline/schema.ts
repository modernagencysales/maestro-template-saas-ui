import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  schedules: defineTable({
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
    state: v.union(
      v.literal("preparing"),
      v.literal("scheduled"),
      v.literal("retryScheduled"),
      v.literal("timedOut"),
      v.literal("reconciled"),
      v.literal("noOp"),
      v.literal("failed"),
    ),
    workId: v.optional(v.string()),
    attemptCount: v.optional(v.number()),
    retryAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    actualStartedAt: v.optional(v.number()),
    latenessMs: v.optional(v.number()),
    expired: v.optional(v.boolean()),
    expiredByMs: v.optional(v.number()),
    noOpReason: v.optional(
      v.union(
        v.literal("terminal-run"),
        v.literal("stale-generation"),
        v.literal("stale-schedule"),
        v.literal("deadline-not-reached"),
      ),
    ),
  })
    .index("schedule_key", ["scheduleKey"])
    .index("run_generation", ["workflowRunId", "generation"]),
});
