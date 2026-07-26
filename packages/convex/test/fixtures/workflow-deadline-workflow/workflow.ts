import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

const failedCancellationOnce = new Set<string>();

export const cancel = mutation({
  args: { workflowId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      args.workflowId.includes("retry-once") &&
      !failedCancellationOnce.has(args.workflowId)
    ) {
      failedCancellationOnce.add(args.workflowId);
      throw new ConvexError("INJECTED_WORKFLOW_CANCEL_FAILURE");
    }
    const existing = await ctx.db
      .query("cancellations")
      .withIndex("by_workflowId", (q) => q.eq("workflowId", args.workflowId))
      .unique();
    if (existing) throw new ConvexError("DUPLICATE_WORKFLOW_CANCEL");
    await ctx.db.insert("cancellations", { workflowId: args.workflowId });
    return null;
  },
});
