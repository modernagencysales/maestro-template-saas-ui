import * as Exit from "effect/Exit";
import * as Result from "effect/Result";

import {
  decodeWorkflowOnCompleteContext,
  transitionWorkflowLifecycle,
  type WorkflowLifecycleState,
  type WorkflowOnCompleteContext,
} from "./lifecycleState";

export const decodeCompletionContext = (
  input: unknown,
): Result.Result<WorkflowOnCompleteContext, string> => {
  const decoded = decodeWorkflowOnCompleteContext(input);
  return Exit.isFailure(decoded)
    ? Result.fail("Completion context is invalid.")
    : Result.succeed(decoded.value);
};

export const planCompletionTransition = (
  state: WorkflowLifecycleState,
  execution: "terminal" | "canceled",
): Result.Result<WorkflowLifecycleState, string> =>
  Result.mapError(
    transitionWorkflowLifecycle(state, {
      kind: execution === "terminal" ? "mark-terminal" : "mark-canceled",
      workspaceId: state.workspaceId,
      workflowRunId: state.workflowRunId,
      generation: state.generation,
    }),
    (error) => error.reason,
  );
