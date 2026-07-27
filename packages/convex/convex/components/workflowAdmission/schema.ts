import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({ workspaceId: v.string() }).index("workspace", [
    "workspaceId",
  ]),
  reservations: defineTable({
    workspaceId: v.string(),
    reservationKey: v.string(),
    workflowRunId: v.optional(v.string()),
    lane: v.union(v.literal("user"), v.literal("system")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("canceled"),
      v.literal("timedOut"),
    ),
  })
    .index("workspace_key", ["workspaceId", "reservationKey"])
    .index("workspace_lane_status", ["workspaceId", "lane", "status"])
    .index("run", ["workflowRunId"]),
});
