import type { FunctionReference } from "convex/server";

import type { WorkflowNodeKind } from "../graph";
import {
  recordStageFailed,
  recordStageStarted,
  recordStageSucceeded,
} from "./observedStagePayload";

type StageMutationRef = FunctionReference<"mutation", "internal">;

export type ObservedWorkflowStageRefs = {
  readonly recordStageStarted?: StageMutationRef;
  readonly recordStageFinished?: StageMutationRef;
};

export type ObservedWorkflowStageStep = {
  readonly runMutation: (
    ref: StageMutationRef,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type RunObservedWorkflowStageInput<Result> = {
  readonly step: ObservedWorkflowStageStep;
  readonly refs?: ObservedWorkflowStageRefs;
  readonly workflowRunId?: string;
  readonly componentWorkflowId?: string;
  readonly nodeId: string;
  readonly label: string;
  readonly kind: WorkflowNodeKind;
  readonly stageKey?: string;
  readonly attemptNumber?: number | "unknown";
  readonly order?: number;
  readonly run: () => Promise<Result>;
};

export const runObservedWorkflowStage = async <Result>(
  input: RunObservedWorkflowStageInput<Result>,
): Promise<Result> => {
  await recordStageStarted(input);

  try {
    const result = await input.run();
    await recordStageSucceeded(input, result);
    return result;
  } catch (error) {
    await recordStageFailed(input, error);
    throw error;
  }
};
