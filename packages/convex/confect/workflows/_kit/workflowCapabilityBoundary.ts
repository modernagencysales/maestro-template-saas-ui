import type { Value } from "convex/values";

import {
  admitWorkflowPayloadReservation,
  assertWorkflowPayloadBudget,
  observeWorkflowPayload,
  redactWorkflowBoundaryFailure,
  type RedactedWorkflowFailure,
} from "./payloadBudget";

export type WorkflowArtifactReference = {
  readonly artifactId: string;
  readonly contentHash: string;
  readonly measuredBytes: number;
  readonly sensitivity: "internal" | "confidential" | "restricted";
};

export type WorkflowCapabilityPayloadPolicy = {
  readonly maxResultBytes: number;
  readonly resultMode: "inline" | "artifact-reference";
};

export class RedactedWorkflowCapabilityError extends Error {
  readonly diagnostic: RedactedWorkflowFailure;

  constructor(diagnostic: RedactedWorkflowFailure) {
    super(diagnostic.safeMessage);
    this.name = "RedactedWorkflowCapabilityError";
    this.diagnostic = diagnostic;
  }
}

type WorkflowCapabilityBoundaryInput<Result> = {
  readonly nodeId: string;
  readonly correlationId: string;
  readonly args: Value;
  readonly payloadPolicy: WorkflowCapabilityPayloadPolicy;
  readonly predictedJournalBytes: number;
  readonly observedJournalBytes: number;
  readonly execute: () => Promise<Result>;
  readonly persistArtifact?: (
    result: Result,
  ) => Promise<WorkflowArtifactReference>;
} & (
  | {
      readonly consequential: true;
      readonly reauthorize: () => Promise<void>;
    }
  | {
      readonly consequential?: false;
      readonly reauthorize?: never;
    }
);

export const runWorkflowCapabilityBoundary = async <Result>(
  input: WorkflowCapabilityBoundaryInput<Result>,
): Promise<{
  readonly result: Result | WorkflowArtifactReference;
  readonly predictedJournalBytes: number;
  readonly observedJournalBytes: number;
}> => {
  assertWorkflowPayloadBudget({
    surface: "step-args",
    phase: "pre-dispatch",
    nodeId: input.nodeId,
    value: input.args,
  });
  const admission = admitWorkflowPayloadReservation({
    nodeId: input.nodeId,
    predictedJournalBytes: input.predictedJournalBytes,
    reservation:
      input.payloadPolicy.resultMode === "artifact-reference"
        ? { kind: "artifact-reference" }
        : { kind: "fixed", maxResultBytes: input.payloadPolicy.maxResultBytes },
  });

  let result: Result;
  try {
    if (input.consequential) await input.reauthorize();
    result = await input.execute();
  } catch (error) {
    throw new RedactedWorkflowCapabilityError(
      redactWorkflowBoundaryFailure(error, input),
    );
  }

  const durableResult = await materializeResult(input, result);
  const observed = observeWorkflowPayload({
    nodeId: input.nodeId,
    observedJournalBytes: input.observedJournalBytes,
    value: durableResult as Value,
  });
  return {
    result: durableResult,
    predictedJournalBytes: admission.predictedJournalBytes,
    observedJournalBytes: observed.observedJournalBytes,
  };
};

const materializeResult = async <Result>(
  input: {
    readonly nodeId: string;
    readonly payloadPolicy: WorkflowCapabilityPayloadPolicy;
    readonly persistArtifact?: (
      result: Result,
    ) => Promise<WorkflowArtifactReference>;
  },
  result: Result,
): Promise<Result | WorkflowArtifactReference> => {
  if (input.payloadPolicy.resultMode === "artifact-reference") {
    if (!input.persistArtifact) {
      throw new Error("Artifact result persistence is not configured.");
    }
    const reference = await input.persistArtifact(result);
    assertWorkflowPayloadBudget({
      surface: "step-result",
      phase: "pre-component-return",
      nodeId: input.nodeId,
      value: reference,
    });
    return reference;
  }
  const measurement = assertWorkflowPayloadBudget({
    surface: "step-result",
    phase: "pre-component-return",
    nodeId: input.nodeId,
    value: result as Value,
  });
  if (measurement.measuredBytes > input.payloadPolicy.maxResultBytes) {
    throw new Error("Workflow result exceeds its declared fixed reservation.");
  }
  return result;
};
