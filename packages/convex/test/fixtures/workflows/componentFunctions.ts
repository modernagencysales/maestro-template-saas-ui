import { WorkflowManager } from "@convex-dev/workflow";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import { components } from "../../../convex/_generated/api";
import { internalMutation, mutation } from "../../../convex/_generated/server";

const workflow = new WorkflowManager(components.workflow);

export const terminalFailure = workflow
  .define({ args: {}, returns: v.null() })
  .handler(async (): Promise<null> => {
    throw new Error("characterized terminal failure");
  });

const terminalFailureRef = makeFunctionReference<
  "mutation",
  { args: Record<string, never> }
>("workflowConformance:terminalFailure") as unknown as FunctionReference<
  "mutation",
  "internal",
  { args: Record<string, never> }
>;

export const startEagerFailure = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> =>
    workflow.start(ctx, terminalFailureRef, {}, { startAsync: false }),
});

export const startQueuedFailure = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> =>
    workflow.start(ctx, terminalFailureRef, {}, { startAsync: true }),
});

export const echoStep = internalMutation({
  args: { value: v.string() },
  returns: v.string(),
  handler: async (_ctx, args): Promise<string> => args.value,
});
