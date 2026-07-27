import type { FunctionReference } from "convex/server";

import type {
  WorkflowCompletionResult,
  WorkflowOnCompleteContext,
} from "../lifecycleReconciliation";

type CompletionRef = FunctionReference<
  "mutation",
  "internal",
  {
    readonly componentWorkflowId: string;
    readonly context: WorkflowOnCompleteContext;
    readonly result: WorkflowCompletionResult;
  },
  { readonly status: "success" | "failed" | "canceled" }
>;

export const reconcileObservedWorkflowCompletion = async (
  context: {
    readonly runMutation: (
      ref: CompletionRef,
      args: {
        readonly componentWorkflowId: string;
        readonly context: WorkflowOnCompleteContext;
        readonly result: WorkflowCompletionResult;
      },
    ) => Promise<unknown>;
  },
  ref: CompletionRef,
  input: {
    readonly workflowId: string;
    readonly context: WorkflowOnCompleteContext;
    readonly result: WorkflowCompletionResult;
  },
): Promise<void> => {
  await context.runMutation(ref, {
    componentWorkflowId: input.workflowId,
    context: input.context,
    result: input.result,
  });
};
