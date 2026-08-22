import { describe, expect, it } from "vitest";

import {
  hashPromotionDecisionReceiptPayload,
  type PromotionDecisionReceipt,
  type PromotionDecisionReceiptPayload,
} from "./decision.js";
import {
  auditPromotionDecisionReceipt,
  type PromotionAuditExpectation,
  type PromotionLaunchAttempt,
  type PromotionReplayObservation,
} from "./audit.js";

const now = 5_000_000;
const digest = (character: string) => `sha256:${character.repeat(64)}`;

const receipt = (): PromotionDecisionReceipt => {
  const payload: PromotionDecisionReceiptPayload = {
    schemaVersion: 1,
    kind: "promotion-decision-receipt",
    mode: "verification-only",
    decision: "approve",
    transition: "staging->production",
    fromEnvironment: "staging",
    toEnvironment: "production",
    targetId: "customer-app",
    commitSha: "a".repeat(40),
    artifactHash: digest("b"),
    approverClass: "release-controller",
    evidence: [
      { class: "artifact-provenance", fingerprint: digest("c") },
      { class: "compatibility-verification", fingerprint: digest("d") },
      { class: "runtime-verification", fingerprint: digest("e") },
    ],
    workflowCensus: {
      capturedAt: now - 100,
      active: 4,
      restartable: 2,
      fingerprint: digest("f"),
    },
    verdictHash: digest("1"),
    verdictNonce: "promotion_nonce_0077",
    authority: {
      jobId: "woodpecker.deploy.production.77",
      leaseId: "lease-production-77",
      leaseNonce: "credential_lease_0077",
      credentialScopes: ["artifact:read", "backend:deploy", "frontend:deploy"],
      credentialSetFingerprint: digest("2"),
    },
    decidedAt: now,
    expiresAt: now + 100,
  };
  return {
    ...payload,
    canonicalHash: hashPromotionDecisionReceiptPayload(payload),
  };
};

const attempt = (value: PromotionDecisionReceipt): PromotionLaunchAttempt => ({
  fromEnvironment: value.fromEnvironment,
  toEnvironment: value.toEnvironment,
  targetId: value.targetId,
  commitSha: value.commitSha,
  artifactHash: value.artifactHash,
  evidence: value.evidence,
  workflowCensus: value.workflowCensus,
  verdictHash: value.verdictHash,
  verdictNonce: value.verdictNonce,
  jobId: value.authority.jobId,
  leaseId: value.authority.leaseId,
  leaseNonce: value.authority.leaseNonce,
  credentialSetFingerprint: value.authority.credentialSetFingerprint,
});

const observation = (
  value: PromotionDecisionReceipt,
  overrides: Partial<PromotionReplayObservation> = {},
): PromotionReplayObservation => ({
  schemaVersion: 1,
  kind: "promotion-decision-consumption",
  receiptHash: digest("3"),
  verdictNonce: "prior_verdict_nonce_01",
  leaseNonce: "prior_lease_nonce_0001",
  fromEnvironment: value.fromEnvironment,
  toEnvironment: value.toEnvironment,
  targetId: value.targetId,
  commitSha: value.commitSha,
  artifactHash: value.artifactHash,
  consumedAt: now - 10,
  ...overrides,
});

const expectation = (
  value: PromotionDecisionReceipt,
  overrides: Partial<PromotionAuditExpectation> = {},
): PromotionAuditExpectation => ({
  trustedReceipt: value,
  attempt: attempt(value),
  priorObservations: [],
  ...overrides,
});

describe("promotion decision replay audit", () => {
  it("returns one frozen observation without mutating replay history", () => {
    const value = receipt();
    const history: PromotionReplayObservation[] = [];
    const before = structuredClone(history);
    let reads = 0;
    const result = auditPromotionDecisionReceipt(
      value,
      expectation(value, { priorObservations: history }),
      {
        nowMs: () => {
          reads += 1;
          return now + 1;
        },
      },
    );
    expect(result).toEqual({
      ok: true,
      observation: {
        schemaVersion: 1,
        kind: "promotion-decision-consumption",
        receiptHash: value.canonicalHash,
        verdictNonce: value.verdictNonce,
        leaseNonce: value.authority.leaseNonce,
        fromEnvironment: "staging",
        toEnvironment: "production",
        targetId: "customer-app",
        commitSha: value.commitSha,
        artifactHash: value.artifactHash,
        consumedAt: now + 1,
      },
    });
    expect(result.ok && Object.isFrozen(result.observation)).toBe(true);
    expect(reads).toBe(1);
    expect(history).toEqual(before);
  });

  it.each([
    "receipt",
    "verdict",
    "lease",
    "verdict-as-lease",
    "lease-as-verdict",
  ] as const)("rejects same-target %s identity reuse", (identity) => {
    const value = receipt();
    const prior = observation(value, {
      ...(identity === "receipt" ? { receiptHash: value.canonicalHash } : {}),
      ...(identity === "verdict" ? { verdictNonce: value.verdictNonce } : {}),
      ...(identity === "lease"
        ? { leaseNonce: value.authority.leaseNonce }
        : {}),
      ...(identity === "verdict-as-lease"
        ? { leaseNonce: value.verdictNonce }
        : {}),
      ...(identity === "lease-as-verdict"
        ? { verdictNonce: value.authority.leaseNonce }
        : {}),
    });
    expect(
      auditPromotionDecisionReceipt(
        value,
        expectation(value, { priorObservations: [prior] }),
        { nowMs: () => now + 1 },
      ),
    ).toMatchObject({ ok: false, code: "nonce-reuse" });
  });

  it("rejects identity reuse from another environment or target", () => {
    const value = receipt();
    const prior = observation(value, {
      verdictNonce: value.verdictNonce,
      fromEnvironment: "preview",
      toEnvironment: "staging",
      targetId: "other-app",
    });
    expect(
      auditPromotionDecisionReceipt(
        value,
        expectation(value, { priorObservations: [prior] }),
        { nowMs: () => now + 1 },
      ),
    ).toMatchObject({ ok: false, code: "cross-environment-replay" });
  });

  it("rejects a cross-environment or cross-target launch attempt", () => {
    const value = receipt();
    for (const changed of [
      { ...attempt(value), toEnvironment: "staging" as const },
      { ...attempt(value), targetId: "other-app" },
    ]) {
      expect(
        auditPromotionDecisionReceipt(
          value,
          expectation(value, { attempt: changed }),
          { nowMs: () => now + 1 },
        ),
      ).toMatchObject({ ok: false, code: "cross-environment-replay" });
    }
  });

  it("rejects stale receipt windows and tampered receipt bytes", () => {
    const value = receipt();
    expect(
      auditPromotionDecisionReceipt(value, expectation(value), {
        nowMs: () => value.expiresAt,
      }),
    ).toMatchObject({ ok: false, code: "stale-window" });
    expect(
      auditPromotionDecisionReceipt(
        { ...value, artifactHash: digest("0") },
        expectation(value),
        { nowMs: () => now + 1 },
      ),
    ).toMatchObject({ ok: false, code: "tampered-receipt" });
  });

  it("rejects artifact drift independently from other bindings", () => {
    const value = receipt();
    expect(
      auditPromotionDecisionReceipt(
        value,
        expectation(value, {
          attempt: { ...attempt(value), artifactHash: digest("0") },
        }),
        { nowMs: () => now + 1 },
      ),
    ).toMatchObject({ ok: false, code: "artifact-drift" });
  });

  it("rejects changed, missing, or reordered evidence and census drift", () => {
    const value = receipt();
    const attempts: PromotionLaunchAttempt[] = [
      { ...attempt(value), evidence: value.evidence.slice(1) },
      { ...attempt(value), evidence: [...value.evidence].reverse() },
      {
        ...attempt(value),
        evidence: value.evidence.map((entry, index) =>
          index === 0 ? { ...entry, fingerprint: digest("0") } : entry,
        ),
      },
      {
        ...attempt(value),
        workflowCensus: { ...value.workflowCensus, active: 5 },
      },
    ];
    for (const changed of attempts) {
      expect(
        auditPromotionDecisionReceipt(
          value,
          expectation(value, { attempt: changed }),
          { nowMs: () => now + 1 },
        ),
      ).toMatchObject({ ok: false, code: "evidence-drift" });
    }
  });

  it("rejects commit, verdict, job, lease, and credential binding drift", () => {
    const value = receipt();
    for (const changed of [
      { ...attempt(value), commitSha: "0".repeat(40) },
      { ...attempt(value), verdictHash: digest("0") },
      { ...attempt(value), verdictNonce: "other_verdict_nonce_1" },
      { ...attempt(value), jobId: "parallel.deploy.1" },
      { ...attempt(value), leaseId: "other-lease" },
      { ...attempt(value), leaseNonce: "other_lease_nonce_001" },
      { ...attempt(value), credentialSetFingerprint: digest("0") },
    ]) {
      expect(
        auditPromotionDecisionReceipt(
          value,
          expectation(value, { attempt: changed }),
          { nowMs: () => now + 1 },
        ),
      ).toMatchObject({ ok: false, code: "binding-drift" });
    }
  });

  it("fails closed for duplicate, malformed, or future replay history", () => {
    const value = receipt();
    const first = observation(value);
    for (const priorObservations of [
      [first, { ...first, consumedAt: first.consumedAt + 1 }],
      [{ ...first, receiptHash: "invalid" }],
      [{ ...first, consumedAt: now + 2 }],
    ]) {
      expect(
        auditPromotionDecisionReceipt(
          value,
          expectation(value, { priorObservations }),
          { nowMs: () => now + 1 },
        ),
      ).toMatchObject({ ok: false, code: "invalid-replay-history" });
    }
  });
});
