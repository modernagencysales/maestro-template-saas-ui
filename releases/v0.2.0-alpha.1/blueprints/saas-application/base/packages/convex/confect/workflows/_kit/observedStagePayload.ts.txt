import type { RunObservedWorkflowStageInput } from "./observedStage";
import { getConvexSize, type Value } from "convex/values";

import { sha256Hex } from "../../shared/sha256";
import { redactWorkflowBoundaryFailure } from "./payloadBudget";

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
          outputJson: safeStringify(successReceipt(result)),
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
          errorJson: safeStringify(
            redactWorkflowBoundaryFailure(error, {
              correlationId: input.workflowRunId ?? "unavailable",
              nodeId: input.nodeId,
            }),
          ),
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
  lifecycleGeneration: input.lifecycleGeneration,
  externalEffect: input.externalEffect,
  observedAt: input.observedAt,
  ...(typeof input.attemptNumber === "number"
    ? { attemptNumber: input.attemptNumber }
    : {}),
  order: input.order,
});

const successReceipt = (result: unknown) => {
  const serialized = safeStringify(result);
  const artifactId = readArtifactId(result);
  return {
    kind: artifactId ? "artifact-reference" : "bounded-inline",
    measuredBytes: getConvexSize(result as Value),
    contentHash: sha256Hex(serialized),
    ...(artifactId ? { artifactId } : {}),
  };
};

const readArtifactId = (result: unknown): string | undefined =>
  typeof result === "object" &&
  result !== null &&
  "artifactId" in result &&
  typeof result.artifactId === "string"
    ? result.artifactId
    : undefined;

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
