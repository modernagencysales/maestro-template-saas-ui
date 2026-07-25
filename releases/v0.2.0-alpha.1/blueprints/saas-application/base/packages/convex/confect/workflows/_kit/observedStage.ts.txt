import type { FunctionReference } from "convex/server";

import type { WorkflowNodeKind } from "../graph";
import {
  recordStageFailed,
  recordStageStarted,
  recordStageSucceeded,
} from "./observedStagePayload";

type StageMutationRef = FunctionReference<"mutation", "internal">;
type ExecutionIdentityRef = FunctionReference<"query", "internal">;

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

export const loadObservedWorkflowExecutionIdentity = async (
  step: {
    readonly workflowId?: string;
    readonly runQuery: (
      ref: ExecutionIdentityRef,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
  },
  ref: ExecutionIdentityRef,
  input: { readonly workspaceId: string; readonly workflowRunId: string },
) => {
  if (!step.workflowId) {
    throw new Error("Workflow component identity is unavailable.");
  }
  const value = await step.runQuery(ref, {
    ...input,
    componentWorkflowId: step.workflowId,
  });
  if (!isExecutionIdentity(value)) {
    throw new Error("Workflow execution identity is unavailable.");
  }
  return value;
};

const isExecutionIdentity = (
  value: unknown,
): value is { readonly generation: number; readonly observedAt: number } =>
  typeof value === "object" &&
  value !== null &&
  "generation" in value &&
  typeof value.generation === "number" &&
  Number.isInteger(value.generation) &&
  value.generation >= 0 &&
  "observedAt" in value &&
  typeof value.observedAt === "number" &&
  Number.isFinite(value.observedAt) &&
  value.observedAt >= 0;

export type RunObservedWorkflowStageInput<Result> = {
  readonly step: ObservedWorkflowStageStep;
  readonly refs?: ObservedWorkflowStageRefs;
  readonly workflowRunId?: string;
  readonly componentWorkflowId?: string;
  readonly nodeId: string;
  readonly label: string;
  readonly kind: WorkflowNodeKind | "subworkflow" | "event";
  readonly stageKey?: string;
  readonly lifecycleGeneration?: number;
  readonly externalEffect?: boolean;
  readonly observedAt?: number;
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
