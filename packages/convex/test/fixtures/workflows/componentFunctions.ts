import {
  WorkflowManager,
  type WorkflowId,
  vWorkflowId,
} from "@convex-dev/workflow";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import { components } from "../../../convex/_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "../../../convex/_generated/server";

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

const ref = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"mutation", Args, Result>(
    `workflowConformance:${name}`,
  ) as unknown as FunctionReference<"mutation", "internal", Args, Result>;

const echoStepRef = ref<{ value: string }, string>("echoStep");

export const eventWorkflow = workflow
  .define({ args: {}, returns: v.boolean() })
  .handler(async (step): Promise<boolean> => {
    const result = await step.awaitEvent<{ approved: boolean }>({
      name: "approved",
      validator: v.object({ approved: v.boolean() }),
    });
    return result.approved;
  });

const eventWorkflowRef = ref<{ args: Record<string, never> }, WorkflowId>(
  "eventWorkflow",
);

export const startEventBeforeWait = mutation({
  args: {},
  returns: vWorkflowId,
  handler: async (ctx): Promise<WorkflowId> => {
    const workflowId = await workflow.start(
      ctx,
      eventWorkflowRef,
      {},
      {
        startAsync: true,
      },
    );
    await workflow.sendEvent(ctx, {
      workflowId,
      name: "approved",
      validator: v.object({ approved: v.boolean() }),
      value: { approved: true },
    });
    return workflowId;
  },
});

export const sendInvalidEventPayload = mutation({
  args: { workflowId: vWorkflowId },
  returns: v.null(),
  handler: async (ctx, { workflowId }): Promise<null> => {
    await workflow.sendEvent(ctx, {
      workflowId,
      name: "approved",
      validator: v.object({ approved: v.boolean() }),
      value: { approved: "yes" } as unknown as { approved: boolean },
    });
    return null;
  },
});

export const parallelWorkflow = workflow
  .define({ args: {}, returns: v.array(v.string()) })
  .handler(
    async (step): Promise<string[]> =>
      await Promise.all([
        step.runMutation(echoStepRef, { value: "left" }, { name: "left" }),
        step.runMutation(echoStepRef, { value: "right" }, { name: "right" }),
      ]),
  );

const parallelWorkflowRef = ref<{ args: Record<string, never> }, WorkflowId>(
  "parallelWorkflow",
);

export const startParallel = mutation({
  args: {},
  returns: vWorkflowId,
  handler: async (ctx): Promise<WorkflowId> =>
    await workflow.start(ctx, parallelWorkflowRef, {}, { startAsync: true }),
});

export const waitingChild = workflow
  .define({ args: {}, returns: v.null() })
  .handler(async (step): Promise<null> => {
    await step.awaitEvent({ name: "release" });
    return null;
  });

const waitingChildRef = ref<{ args: Record<string, never> }, WorkflowId>(
  "waitingChild",
);

export const parentWorkflow = workflow
  .define({ args: {}, returns: v.string() })
  .handler(async (step): Promise<string> => {
    await step.runWorkflow(waitingChildRef, {}, { name: "child" });
    return "child-complete";
  });

const parentWorkflowRef = ref<{ args: Record<string, never> }, WorkflowId>(
  "parentWorkflow",
);

export const startParent = mutation({
  args: {},
  returns: vWorkflowId,
  handler: async (ctx): Promise<WorkflowId> =>
    await workflow.start(ctx, parentWorkflowRef, {}, { startAsync: true }),
});

export const restartWorkflow = workflow
  .define({ args: {}, returns: v.null() })
  .handler(async (step): Promise<null> => {
    await step.runMutation(
      echoStepRef,
      { value: "first" },
      { name: "duplicate" },
    );
    await step.runMutation(
      echoStepRef,
      { value: "middle" },
      { name: "middle" },
    );
    await step.runMutation(
      echoStepRef,
      { value: "latest" },
      { name: "duplicate" },
    );
    await step.runMutation(echoStepRef, { value: "tail" }, { name: "tail" });
    throw new Error("restart characterization failure");
  });

const restartWorkflowRef = ref<{ args: Record<string, never> }, WorkflowId>(
  "restartWorkflow",
);

export const startRestartWorkflow = mutation({
  args: {},
  returns: vWorkflowId,
  handler: async (ctx): Promise<WorkflowId> =>
    await workflow.start(ctx, restartWorkflowRef, {}, { startAsync: true }),
});

export const successfulWorkflow = workflow
  .define({ args: {}, returns: v.string() })
  .handler(async (): Promise<string> => "preserved");

const successfulWorkflowRef = ref<{ args: Record<string, never> }, WorkflowId>(
  "successfulWorkflow",
);
const missingOnCompleteRef = ref<
  {
    workflowId: WorkflowId;
    result:
      | { kind: "success"; returnValue: unknown }
      | { kind: "failed"; error: string }
      | { kind: "canceled" };
    context: { test: boolean };
  },
  null
>("missingOnComplete");

export const startFailingOnComplete = mutation({
  args: {},
  returns: vWorkflowId,
  handler: async (ctx): Promise<WorkflowId> =>
    await workflow.start(
      ctx,
      successfulWorkflowRef,
      {},
      {
        onComplete: missingOnCompleteRef,
        context: { test: true },
        startAsync: true,
      },
    ),
});

export const cancelWorkflow = mutation({
  args: { workflowId: vWorkflowId },
  returns: v.null(),
  handler: async (ctx, { workflowId }): Promise<null> => {
    await workflow.cancel(ctx, workflowId);
    return null;
  },
});

export const restartFromDuplicate = mutation({
  args: { workflowId: vWorkflowId },
  returns: v.null(),
  handler: async (ctx, { workflowId }): Promise<null> => {
    await workflow.restart(ctx, workflowId, {
      from: "duplicate",
      startAsync: true,
    });
    return null;
  },
});

export const cleanupWorkflow = mutation({
  args: { workflowId: vWorkflowId },
  returns: v.boolean(),
  handler: async (ctx, { workflowId }): Promise<boolean> =>
    await workflow.cleanup(ctx, workflowId),
});

export const workflowStatus = query({
  args: { workflowId: vWorkflowId },
  returns: v.any(),
  handler: async (ctx, { workflowId }): Promise<unknown> =>
    await workflow.status(ctx, workflowId),
});

export const listWorkflows = query({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number() },
  returns: v.any(),
  handler: async (ctx, { cursor, numItems }): Promise<unknown> =>
    await workflow.list(ctx, {
      order: "asc",
      paginationOpts: { cursor, numItems },
    }),
});

export const listWorkflowSteps = query({
  args: {
    workflowId: vWorkflowId,
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, { workflowId, cursor, numItems }): Promise<unknown> =>
    await workflow.listSteps(ctx, workflowId, {
      order: "asc",
      paginationOpts: { cursor, numItems },
    }),
});
