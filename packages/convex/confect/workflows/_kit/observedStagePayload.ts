import type { RunObservedWorkflowStageInput } from "./observedStage";

export const recordStageStarted = <Result>(
  input: RunObservedWorkflowStageInput<Result>,
): Promise<void> =>
  quarantineObservation(() =>
    input.refs?.recordStageStarted
      ? input.step.runMutation(input.refs.recordStageStarted, {
          ...stageObservationArgs(input),
          status: "running",
        })
      : Promise.resolve(),
  );

export const recordStageSucceeded = <Result>(
  input: RunObservedWorkflowStageInput<Result>,
  result: Result,
): Promise<void> =>
  quarantineObservation(() =>
    input.refs?.recordStageFinished
      ? input.step.runMutation(input.refs.recordStageFinished, {
          ...stageObservationArgs(input),
          status: "succeeded",
          outputJson: safeStringify(result),
        })
      : Promise.resolve(),
  );

export const recordStageFailed = <Result>(
  input: RunObservedWorkflowStageInput<Result>,
  error: unknown,
): Promise<void> =>
  quarantineObservation(() =>
    input.refs?.recordStageFinished
      ? input.step.runMutation(input.refs.recordStageFinished, {
          ...stageObservationArgs(input),
          status: "failed",
          errorJson: safeStringify({ message: errorMessage(error) }),
        })
      : Promise.resolve(),
  );

const stageObservationArgs = <Result>(
  input: RunObservedWorkflowStageInput<Result>,
): Record<string, unknown> => ({
  workflowRunId: input.workflowRunId,
  componentWorkflowId: input.componentWorkflowId,
  nodeId: input.nodeId,
  label: input.label,
  kind: input.kind,
  stageKey: input.stageKey ?? input.nodeId,
  ...(typeof input.attemptNumber === "number"
    ? { attemptNumber: input.attemptNumber }
    : {}),
  order: input.order,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const quarantineObservation = async (
  observe: () => Promise<unknown>,
): Promise<void> => {
  try {
    await observe();
  } catch {
    // Observability must not replace the workflow's original result or failure.
  }
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
};
