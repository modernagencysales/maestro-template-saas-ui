import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cancellations: defineTable({ workflowId: v.string() }).index(
    "by_workflowId",
    ["workflowId"],
  ),
});
