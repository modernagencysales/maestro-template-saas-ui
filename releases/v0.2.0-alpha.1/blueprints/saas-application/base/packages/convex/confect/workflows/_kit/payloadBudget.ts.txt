import { getConvexSize, type Value } from "convex/values";
import * as Data from "effect/Data";

export const UPSTREAM_PAYLOAD_CEILINGS = {
  workflowStepReturnBytes: 800 << 10,
  workflowJournalBytes: 8 << 20,
  workpoolFunctionArgsBytes: 1_000_000,
  workpoolCompletionContextBytes: 1_000_000,
} as const;

export const MAESTRO_PAYLOAD_BUDGETS = {
  "step-args": { softBytes: 384 << 10, hardBytes: 512 << 10 },
  "step-result": { softBytes: 512 << 10, hardBytes: 640 << 10 },
  "journal-cumulative": { softBytes: 4 << 20, hardBytes: 6 << 20 },
  "event-value": { softBytes: 128 << 10, hardBytes: 256 << 10 },
  "nested-workflow-args": { softBytes: 384 << 10, hardBytes: 512 << 10 },
  "workflow-return": { softBytes: 512 << 10, hardBytes: 640 << 10 },
  "on-complete-context": { softBytes: 64 << 10, hardBytes: 128 << 10 },
  "product-projection": { softBytes: 128 << 10, hardBytes: 256 << 10 },
} as const;

export type WorkflowPayloadSurface = keyof typeof MAESTRO_PAYLOAD_BUDGETS;
export type WorkflowPayloadPhase =
  | "admission"
  | "pre-dispatch"
  | "post-await"
  | "pre-component-return"
  | "pre-component-send"
  | "pre-product-projection";

export type WorkflowPayloadDiagnostic = {
  readonly code:
    "WORKFLOW_PAYLOAD_HARD_LIMIT" | "WORKFLOW_CUMULATIVE_PAYLOAD_LIMIT";
  readonly surface: WorkflowPayloadSurface;
  readonly phase: WorkflowPayloadPhase;
  readonly measuredBytes: number;
  readonly thresholdBytes: number;
  readonly nodeId: string;
  readonly repair: "store-workflow-artifact";
};

export class WorkflowPayloadBudgetError extends Data.TaggedError(
  "WorkflowPayloadBudgetError",
)<{ readonly diagnostic: WorkflowPayloadDiagnostic }> {}

export type WorkflowPayloadMeasurement = {
  readonly measuredBytes: number;
  readonly softLimitBytes: number;
  readonly hardLimitBytes: number;
  readonly posture: "within-soft-limit" | "soft-limit-exceeded";
};

export const assertWorkflowPayloadBudget = (input: {
  readonly surface: Exclude<WorkflowPayloadSurface, "journal-cumulative">;
  readonly phase: WorkflowPayloadPhase;
  readonly nodeId: string;
  readonly value: unknown;
}): WorkflowPayloadMeasurement => {
  const budget = MAESTRO_PAYLOAD_BUDGETS[input.surface];
  const measuredBytes = getConvexSize(input.value as Value | undefined);
  if (measuredBytes > budget.hardBytes) {
    throw payloadFailure({
      code: "WORKFLOW_PAYLOAD_HARD_LIMIT",
      surface: input.surface,
      phase: input.phase,
      measuredBytes,
      thresholdBytes: budget.hardBytes,
      nodeId: input.nodeId,
      repair: "store-workflow-artifact",
    });
  }
  return {
    measuredBytes,
    softLimitBytes: budget.softBytes,
    hardLimitBytes: budget.hardBytes,
    posture:
      measuredBytes > budget.softBytes
        ? "soft-limit-exceeded"
        : "within-soft-limit",
  };
};

export type WorkflowPayloadReservation =
  | { readonly kind: "fixed"; readonly maxResultBytes: number }
  | { readonly kind: "artifact-reference" };

export type WorkflowPayloadAdmission = {
  readonly predictedJournalBytes: number;
  readonly reservationBytes: number;
  readonly posture: "within-soft-limit" | "soft-limit-exceeded";
};

export const ARTIFACT_REFERENCE_RESERVATION_BYTES = 4 << 10;

export const admitWorkflowPayloadReservation = (input: {
  readonly nodeId: string;
  readonly predictedJournalBytes: number;
  readonly reservation: WorkflowPayloadReservation;
}): WorkflowPayloadAdmission => {
  assertFiniteNonnegative(
    input.predictedJournalBytes,
    "predicted journal bytes",
  );
  const reservationBytes =
    input.reservation.kind === "artifact-reference"
      ? ARTIFACT_REFERENCE_RESERVATION_BYTES
      : input.reservation.maxResultBytes;
  assertFiniteNonnegative(reservationBytes, "maximum result reservation");
  const predictedJournalBytes = input.predictedJournalBytes + reservationBytes;
  return assertCumulativeBudget({
    nodeId: input.nodeId,
    measuredBytes: predictedJournalBytes,
    phase: "admission",
    reservationBytes,
  });
};

export const observeWorkflowPayload = (input: {
  readonly nodeId: string;
  readonly observedJournalBytes: number;
  readonly value: unknown;
}): {
  readonly observedJournalBytes: number;
  readonly measuredBytes: number;
} => {
  assertFiniteNonnegative(input.observedJournalBytes, "observed journal bytes");
  const measuredBytes = getConvexSize(input.value as Value | undefined);
  const observedJournalBytes = input.observedJournalBytes + measuredBytes;
  assertCumulativeBudget({
    nodeId: input.nodeId,
    measuredBytes: observedJournalBytes,
    phase: "post-await",
    reservationBytes: measuredBytes,
  });
  return { observedJournalBytes, measuredBytes };
};

const assertCumulativeBudget = (input: {
  readonly nodeId: string;
  readonly measuredBytes: number;
  readonly phase: WorkflowPayloadPhase;
  readonly reservationBytes: number;
}): WorkflowPayloadAdmission => {
  const budget = MAESTRO_PAYLOAD_BUDGETS["journal-cumulative"];
  if (input.measuredBytes > budget.hardBytes) {
    throw payloadFailure({
      code: "WORKFLOW_CUMULATIVE_PAYLOAD_LIMIT",
      surface: "journal-cumulative",
      phase: input.phase,
      measuredBytes: input.measuredBytes,
      thresholdBytes: budget.hardBytes,
      nodeId: input.nodeId,
      repair: "store-workflow-artifact",
    });
  }
  return {
    predictedJournalBytes: input.measuredBytes,
    reservationBytes: input.reservationBytes,
    posture:
      input.measuredBytes > budget.softBytes
        ? "soft-limit-exceeded"
        : "within-soft-limit",
  };
};

export type RedactedWorkflowFailure = {
  readonly code: "WORKFLOW_CAPABILITY_FAILED";
  readonly safeMessage: "Workflow capability failed.";
  readonly correlationId: string;
  readonly nodeId: string;
};

export const redactWorkflowBoundaryFailure = (
  error: unknown,
  context: { readonly correlationId: string; readonly nodeId: string },
): RedactedWorkflowFailure => {
  void error;
  return {
    code: "WORKFLOW_CAPABILITY_FAILED",
    safeMessage: "Workflow capability failed.",
    correlationId: boundedIdentifier(context.correlationId, "unavailable"),
    nodeId: boundedIdentifier(context.nodeId, "unknown-node"),
  };
};

const boundedIdentifier = (value: string, fallback: string): string =>
  /^[A-Za-z0-9._:@/-]{1,128}$/.test(value) ? value : fallback;

const assertFiniteNonnegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite nonnegative bytes`);
  }
};

const payloadFailure = (
  diagnostic: WorkflowPayloadDiagnostic,
): WorkflowPayloadBudgetError => new WorkflowPayloadBudgetError({ diagnostic });
