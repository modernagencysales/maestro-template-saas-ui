import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getConvexSize } from "convex/values";
import { describe, expect, it } from "vitest";

import {
  MAESTRO_PAYLOAD_BUDGETS,
  UPSTREAM_PAYLOAD_CEILINGS,
  WorkflowPayloadBudgetError,
  admitWorkflowPayloadReservation,
  assertWorkflowPayloadBudget,
  observeWorkflowPayload,
  redactWorkflowBoundaryFailure,
} from "../confect/workflows/_kit/payloadBudget";

const compatibility = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../docs/template/convex-compatibility.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as { readonly payloadBudgets: unknown };

describe("workflow payload budget authority", () => {
  it("pins upstream and Workpool ceilings in the compatibility authority", () => {
    expect(compatibility.payloadBudgets).toEqual({
      upstream: UPSTREAM_PAYLOAD_CEILINGS,
      maestro: MAESTRO_PAYLOAD_BUDGETS,
    });
    expect(UPSTREAM_PAYLOAD_CEILINGS).toEqual({
      workflowStepReturnBytes: 819_200,
      workflowJournalBytes: 8_388_608,
      workpoolFunctionArgsBytes: 1_000_000,
      workpoolCompletionContextBytes: 1_000_000,
    });
  });

  it("measures real Convex values below the soft boundary", () => {
    const value = { message: "bounded" };
    const result = assertWorkflowPayloadBudget({
      surface: "step-result",
      phase: "pre-component-return",
      nodeId: "summarize.v1",
      value,
    });
    expect(result.measuredBytes).toBe(getConvexSize(value));
    expect(result.posture).toBe("within-soft-limit");
  });

  it("reports soft pressure without crossing the hard reservation", () => {
    const budget = MAESTRO_PAYLOAD_BUDGETS["event-value"];
    const value = "x".repeat(budget.softBytes + 128);
    const result = assertWorkflowPayloadBudget({
      surface: "event-value",
      phase: "pre-component-send",
      nodeId: "approval.v1",
      value,
    });
    expect(result.measuredBytes).toBeLessThanOrEqual(budget.hardBytes);
    expect(result.posture).toBe("soft-limit-exceeded");
  });

  it("fails before dispatch with typed redacted diagnostics", () => {
    const budget = MAESTRO_PAYLOAD_BUDGETS["step-args"];
    const canary = "provider-token-super-secret";
    const value = { canary, body: "x".repeat(budget.hardBytes) };

    expect(() =>
      assertWorkflowPayloadBudget({
        surface: "step-args",
        phase: "pre-dispatch",
        nodeId: "provider.v1",
        value,
      }),
    ).toThrow(WorkflowPayloadBudgetError);

    try {
      assertWorkflowPayloadBudget({
        surface: "step-args",
        phase: "pre-dispatch",
        nodeId: "provider.v1",
        value,
      });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(canary);
      expect(error).toMatchObject({
        diagnostic: {
          code: "WORKFLOW_PAYLOAD_HARD_LIMIT",
          surface: "step-args",
          phase: "pre-dispatch",
          nodeId: "provider.v1",
          thresholdBytes: budget.hardBytes,
          repair: "store-workflow-artifact",
        },
      });
    }
  });

  it("requires fixed reservations or artifact-reference results", () => {
    const admitted = admitWorkflowPayloadReservation({
      nodeId: "brief.v1",
      predictedJournalBytes: 1_024,
      reservation: { kind: "fixed", maxResultBytes: 2_048 },
    });
    expect(admitted.predictedJournalBytes).toBe(3_072);

    const artifact = admitWorkflowPayloadReservation({
      nodeId: "archive.v1",
      predictedJournalBytes: admitted.predictedJournalBytes,
      reservation: { kind: "artifact-reference" },
    });
    expect(artifact.predictedJournalBytes).toBeGreaterThan(
      admitted.predictedJournalBytes,
    );

    expect(() =>
      admitWorkflowPayloadReservation({
        nodeId: "unbounded.v1",
        predictedJournalBytes: 0,
        reservation: {
          kind: "fixed",
          maxResultBytes: Number.POSITIVE_INFINITY,
        },
      }),
    ).toThrow(/finite nonnegative/i);
  });

  it("tracks observed cumulative journal usage with the same hard guard", () => {
    const first = observeWorkflowPayload({
      nodeId: "one.v1",
      observedJournalBytes: 0,
      value: { ok: true },
    });
    expect(first.observedJournalBytes).toBe(getConvexSize({ ok: true }));

    const tooLarge = "x".repeat(
      MAESTRO_PAYLOAD_BUDGETS["journal-cumulative"].hardBytes,
    );
    expect(() =>
      observeWorkflowPayload({
        nodeId: "two.v1",
        observedJournalBytes: first.observedJournalBytes,
        value: tooLarge,
      }),
    ).toThrow(WorkflowPayloadBudgetError);
  });

  it("never projects raw provider failures into the component envelope", () => {
    const canary = "raw-sdk-secret-canary";
    const envelope = redactWorkflowBoundaryFailure(new Error(canary), {
      nodeId: "provider.v1",
      correlationId: "corr_0123456789",
    });
    expect(envelope).toEqual({
      code: "WORKFLOW_CAPABILITY_FAILED",
      safeMessage: "Workflow capability failed.",
      correlationId: "corr_0123456789",
      nodeId: "provider.v1",
    });
    expect(JSON.stringify(envelope)).not.toContain(canary);
  });
});
