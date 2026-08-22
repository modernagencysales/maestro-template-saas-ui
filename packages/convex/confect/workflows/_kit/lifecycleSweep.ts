import type { createWorkflowLifecycleControls } from "./lifecycle";
import type {
  WorkflowLifecyclePrincipal,
  WorkflowLifecycleReasonCode,
} from "./lifecycleControls";

type Controls = ReturnType<typeof createWorkflowLifecycleControls>;

export const runBoundedWorkflowRetentionSweep = async (
  controls: Controls,
  principal: WorkflowLifecyclePrincipal,
  input: {
    readonly cursor: string | null;
    readonly limit: number;
    readonly occurredAt: number;
  },
) => {
  const page = await controls.list(principal, {
    cursor: input.cursor,
    limit: input.limit,
  });
  const accepted: string[] = [];
  const refused: string[] = [];
  for (const run of page.page) {
    const controlInput = {
      workflowRunId: run.workflowRunId,
      reasonCode: "retention-sweep" as WorkflowLifecycleReasonCode,
      occurredAt: input.occurredAt,
    };
    try {
      await controls.cleanup(principal, controlInput);
      accepted.push(run.workflowRunId);
    } catch {
      try {
        await controls.reconcileCleanup(principal, controlInput);
        accepted.push(run.workflowRunId);
      } catch {
        refused.push(run.workflowRunId);
      }
    }
  }
  return {
    accepted,
    refused,
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  };
};
