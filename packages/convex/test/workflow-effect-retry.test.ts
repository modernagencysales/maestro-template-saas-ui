import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";

import {
  decodeWorkflowEffectContract,
  deriveLogicalEffectKey,
  initialWorkflowEffectState,
  planWorkflowEffectDispatch,
  transitionWorkflowEffectState,
  validateWorkflowEffectContract,
} from "../confect/workflows/_kit/effectReservations";

const guards = {
  approval: { kind: "required", evidenceRef: "approval-fixture" },
  quotaRate: { kind: "not-applicable", reason: "No metered provider." },
  spendKillSwitch: { kind: "required", evidenceRef: "spend-fixture" },
} as const;

const providerNative = {
  strategy: "provider-native",
  effectClass: "external",
  dedupeRetentionMs: 20_000,
  maxRetryWindowMs: 5_000,
  maxRestartWindowMs: 10_000,
  keyArgumentPath: "request.idempotencyKey",
  providerEvidenceRef: "provider-idempotency-fixture",
  duplicateDeliveryFixtureRef: "duplicate-delivery-fixture",
  redactionPolicyRef: "redaction.v1",
  guards,
} as const;

describe("workflow effect retry contract", () => {
  it.each([
    providerNative,
    {
      strategy: "durable-ledger-and-reconcile",
      effectClass: "external",
      dedupeRetentionMs: 20_000,
      maxRetryWindowMs: 5_000,
      maxRestartWindowMs: 10_000,
      reconciliationCapabilityRef: "capability.reconcileEffect.v1",
      reconciliationFixtureRef: "ambiguous-reconcile-fixture",
      redactionPolicyRef: "redaction.v1",
      guards,
    },
    {
      strategy: "non-retriable",
      effectClass: "external",
      reason: "Provider has no safe dedupe or reconciliation contract.",
      ambiguousOutcome: "manual-review",
      redactionPolicyRef: "redaction.v1",
      guards,
    },
  ])("decodes strategy $strategy", (contract) => {
    expect(Either.isRight(decodeWorkflowEffectContract(contract))).toBe(true);
  });

  it("rejects boolean idempotency claims", () => {
    expect(
      Either.isLeft(
        decodeWorkflowEffectContract({
          ...providerNative,
          strategy: undefined,
          idempotent: true,
        }),
      ),
    ).toBe(true);
  });

  it("requires dedupe retention to cover retry plus restart", () => {
    const result = validateWorkflowEffectContract(
      { ...providerNative, dedupeRetentionMs: 14_999 },
      { maxAttempts: 3, initialBackoffMs: 250, base: 2 },
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left.issue).toContain("dedupeRetentionMs");
    }
  });

  it("forbids automatic retry for non-retriable effects", () => {
    const contract = Either.getOrThrow(
      decodeWorkflowEffectContract({
        strategy: "non-retriable",
        effectClass: "external",
        reason: "No safe retry.",
        ambiguousOutcome: "manual-review",
        redactionPolicyRef: "redaction.v1",
        guards,
      }),
    );
    expect(
      Either.isLeft(
        validateWorkflowEffectContract(contract, {
          maxAttempts: 2,
          initialBackoffMs: 1,
          base: 2,
        }),
      ),
    ).toBe(true);
  });

  it("derives a stable logical key without an attempt number", () => {
    const input = {
      workspaceId: "workspace-1",
      workflowRunId: "run-1",
      workflowVersion: 2,
      generation: 3,
      stepName: "publish-brief.v2.i-n000012",
      instanceKey: "brief-12",
    } as const;
    expect(deriveLogicalEffectKey(input)).toBe(deriveLogicalEffectKey(input));
    expect(deriveLogicalEffectKey({ ...input, generation: 4 })).toBe(
      deriveLogicalEffectKey(input),
    );
    expect(deriveLogicalEffectKey(input)).not.toContain("attempt");
  });

  it("makes ambiguous outcomes explicit and refuses invalid transitions", () => {
    const submitted = Either.getOrThrow(
      transitionWorkflowEffectState(initialWorkflowEffectState, {
        kind: "submitted",
      }),
    );
    const ambiguous = Either.getOrThrow(
      transitionWorkflowEffectState(submitted, {
        kind: "ambiguous",
        strategy: "durable-ledger-and-reconcile",
      }),
    );
    expect(ambiguous).toEqual({
      state: "ambiguous",
      reconciliationState: "pending",
    });
    expect(
      Either.getOrThrow(
        transitionWorkflowEffectState(ambiguous, {
          kind: "manual-review",
        }),
      ),
    ).toEqual({ state: "terminal", reconciliationState: "manual-review" });
    expect(
      Either.isLeft(
        transitionWorkflowEffectState(initialWorkflowEffectState, {
          kind: "confirmed",
        }),
      ),
    ).toBe(true);
  });

  it("requires every guard before dispatch and never guesses through ambiguity", () => {
    expect(
      planWorkflowEffectDispatch({
        state: initialWorkflowEffectState,
        guardResults: {
          approval: "passed",
          quotaRate: "not-applicable",
          spendKillSwitch: "denied",
        },
      }),
    ).toEqual({ kind: "deny", guard: "spendKillSwitch" });
    expect(
      planWorkflowEffectDispatch({
        state: { state: "ambiguous", reconciliationState: "pending" },
        guardResults: {
          approval: "passed",
          quotaRate: "not-applicable",
          spendKillSwitch: "passed",
        },
      }),
    ).toEqual({ kind: "reconcile" });
  });
});
