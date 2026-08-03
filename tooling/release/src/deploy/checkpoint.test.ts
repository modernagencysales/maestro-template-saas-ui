import { describe, expect, it } from "vitest";

import { issuePromotionVerdict } from "./verdict.js";
import {
  hashPromotionDecisionReceiptPayload,
  type PromotionDecisionReceipt,
  type PromotionDecisionReceiptPayload,
} from "./decision.js";
import type { PromotionReplayObservation } from "./audit.js";
import {
  compileAcceptedPromotionCheckpoint,
  verifyAcceptedPromotionCheckpoint,
  MAX_PROMOTION_CHECKPOINT_DELAY_MS,
} from "./checkpoint.js";

const now = 6_000_000;
const digest = (character: string) => `sha256:${character.repeat(64)}`;

const fixture = () => {
  const evidence = [
    { class: "artifact-provenance" as const, fingerprint: digest("c") },
    {
      class: "compatibility-verification" as const,
      fingerprint: digest("d"),
    },
    { class: "runtime-verification" as const, fingerprint: digest("e") },
  ];
  const workflowCensus = {
    capturedAt: now - 100,
    active: 5,
    restartable: 3,
    fingerprint: digest("f"),
  };
  const verdict = issuePromotionVerdict(
    {
      fromEnvironment: "staging",
      toEnvironment: "production",
      targetId: "customer-app",
      commitSha: "a".repeat(40),
      artifactHash: digest("b"),
      compatibility: [
        { component: "agent-pack", version: "7.2.0" },
        { component: "convex", version: "1.42.1" },
        { component: "workflow", version: "0.4.4" },
      ],
      evidence,
      workflowCensus,
      approverClass: "release-controller",
      ttlMs: 10_000,
    },
    { nowMs: () => now, nonce: () => "promotion_nonce_0088" },
  );
  const receiptPayload: PromotionDecisionReceiptPayload = {
    schemaVersion: 1,
    kind: "promotion-decision-receipt",
    mode: "verification-only",
    decision: "approve",
    transition: "staging->production",
    fromEnvironment: "staging",
    toEnvironment: "production",
    targetId: "customer-app",
    commitSha: verdict.commitSha,
    artifactHash: verdict.artifactHash,
    approverClass: verdict.approverClass,
    evidence,
    workflowCensus,
    verdictHash: verdict.canonicalHash,
    verdictNonce: verdict.nonce,
    authority: {
      jobId: "woodpecker.deploy.production.88",
      leaseId: "lease-production-88",
      leaseNonce: "credential_lease_0088",
      credentialScopes: ["artifact:read", "backend:deploy", "frontend:deploy"],
      credentialSetFingerprint: digest("2"),
    },
    decidedAt: now,
    expiresAt: now + 8_000,
  };
  const receipt: PromotionDecisionReceipt = {
    ...receiptPayload,
    canonicalHash: hashPromotionDecisionReceiptPayload(receiptPayload),
  };
  const auditObservation: PromotionReplayObservation = {
    schemaVersion: 1,
    kind: "promotion-decision-consumption",
    receiptHash: receipt.canonicalHash,
    verdictNonce: verdict.nonce,
    leaseNonce: receipt.authority.leaseNonce,
    fromEnvironment: receipt.fromEnvironment,
    toEnvironment: receipt.toEnvironment,
    targetId: receipt.targetId,
    commitSha: receipt.commitSha,
    artifactHash: receipt.artifactHash,
    consumedAt: now + 1,
  };
  return { verdict, receipt, auditObservation };
};

const compile = (
  value = fixture(),
  clock = now + 2,
  overrides: Partial<
    Parameters<typeof compileAcceptedPromotionCheckpoint>[0]
  > = {},
) =>
  compileAcceptedPromotionCheckpoint(
    {
      receipt: value.receipt,
      trustedReceipt: value.receipt,
      verdict: value.verdict,
      auditObservation: value.auditObservation,
      ...overrides,
    },
    { nowMs: () => clock },
  );

describe("accepted promotion checkpoint compiler", () => {
  it("compiles a record-only packet from exact accepted sources", () => {
    const value = fixture();
    const result = compile(value);
    expect(result).toMatchObject({
      kind: "compiled",
      checkpoint: {
        schemaVersion: 1,
        kind: "accepted-promotion-checkpoint",
        mode: "record-only",
        status: "accepted",
        transition: "staging->production",
        fromEnvironment: "staging",
        toEnvironment: "production",
        targetId: "customer-app",
        commitSha: value.receipt.commitSha,
        artifactHash: value.receipt.artifactHash,
        compatibility: [
          { component: "agent-pack", version: "7.2.0" },
          { component: "convex", version: "1.42.1" },
          { component: "workflow", version: "0.4.4" },
        ],
        workflowCensus: { active: 5, restartable: 3 },
        authority: {
          jobId: "woodpecker.deploy.production.88",
          leaseId: "lease-production-88",
          credentialScopes: [
            "artifact:read",
            "backend:deploy",
            "frontend:deploy",
          ],
        },
        sources: {
          verdictHash: value.verdict.canonicalHash,
          verdictNonce: value.verdict.nonce,
          decisionReceiptHash: value.receipt.canonicalHash,
          leaseNonce: value.receipt.authority.leaseNonce,
        },
        acceptedAt: now + 1,
        compiledAt: now + 2,
        expiresAt: now + 8_000,
      },
    });
    if (result.kind !== "compiled") throw new Error("expected checkpoint");
    expect(Object.isFrozen(result.checkpoint)).toBe(true);
    expect(Object.isFrozen(result.checkpoint.compatibility)).toBe(true);
    expect(Object.isFrozen(result.checkpoint.authority)).toBe(true);
    expect(
      verifyAcceptedPromotionCheckpoint(
        result.checkpoint,
        result.checkpoint,
        now + 3,
      ),
    ).toEqual({ ok: true, checkpoint: result.checkpoint });
  });

  it("uses one injected clock and does not mutate accepted inputs", () => {
    const value = fixture();
    const before = structuredClone(value);
    let reads = 0;
    const result = compileAcceptedPromotionCheckpoint(
      {
        receipt: value.receipt,
        trustedReceipt: value.receipt,
        verdict: value.verdict,
        auditObservation: value.auditObservation,
      },
      {
        nowMs: () => {
          reads += 1;
          return now + 2;
        },
      },
    );
    expect(result.kind).toBe("compiled");
    expect(reads).toBe(1);
    expect(value).toEqual(before);
  });

  it("rejects stale or tampered decision receipts", () => {
    const value = fixture();
    expect(compile(value, value.receipt.expiresAt)).toMatchObject({
      kind: "blocked",
      findings: [{ code: "stale-input" }],
    });
    expect(
      compile(value, now + 2, {
        receipt: { ...value.receipt, artifactHash: digest("0") },
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: [{ code: "invalid-receipt" }],
    });
  });

  it("rejects tampered verdicts and compatibility substitution", () => {
    const value = fixture();
    expect(
      compile(value, now + 2, {
        verdict: {
          ...value.verdict,
          compatibility: [{ component: "workflow", version: "9.9.9" }],
        },
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: [{ code: "invalid-verdict" }],
    });

    const changedVerdict = issuePromotionVerdict(
      {
        fromEnvironment: value.verdict.fromEnvironment,
        toEnvironment: value.verdict.toEnvironment,
        targetId: value.verdict.targetId,
        commitSha: value.verdict.commitSha,
        artifactHash: value.verdict.artifactHash,
        compatibility: [{ component: "workflow", version: "9.9.9" }],
        evidence: value.verdict.evidence,
        workflowCensus: value.verdict.workflowCensus,
        approverClass: value.verdict.approverClass,
        ttlMs: 10_000,
      },
      { nowMs: () => now, nonce: () => "promotion_nonce_0099" },
    );
    expect(compile(value, now + 2, { verdict: changedVerdict })).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "source-binding-mismatch" }),
      ]),
    });
  });

  it("rejects open, mismatched, future, and delayed audit observations", () => {
    const value = fixture();
    expect(
      compile(value, now + 2, {
        auditObservation: { ...value.auditObservation, unexpected: true },
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: [{ code: "invalid-audit-observation" }],
    });
    expect(
      compile(value, now + 2, {
        auditObservation: {
          ...value.auditObservation,
          targetId: "other-app",
        },
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: [{ code: "source-binding-mismatch" }],
    });
    expect(
      compile(value, now + 2, {
        auditObservation: { ...value.auditObservation, consumedAt: now + 3 },
      }),
    ).toMatchObject({
      kind: "blocked",
      findings: [{ code: "audit-window-mismatch" }],
    });
    expect(
      compile(
        value,
        value.auditObservation.consumedAt +
          MAX_PROMOTION_CHECKPOINT_DELAY_MS +
          1,
      ),
    ).toMatchObject({
      kind: "blocked",
      findings: [{ code: "audit-window-mismatch" }],
    });
  });
});

describe("accepted promotion checkpoint verification", () => {
  const checkpoint = () => {
    const result = compile();
    if (result.kind !== "compiled") throw new Error("fixture must compile");
    return result.checkpoint;
  };

  it("rejects tampered, stale, mismatched, open, and reordered packets", () => {
    const value = checkpoint();
    expect(
      verifyAcceptedPromotionCheckpoint(
        { ...value, artifactHash: digest("0") },
        value,
        now + 3,
      ),
    ).toEqual({ ok: false, code: "tampered" });
    expect(
      verifyAcceptedPromotionCheckpoint(value, value, value.expiresAt),
    ).toEqual({ ok: false, code: "stale" });
    expect(
      verifyAcceptedPromotionCheckpoint(
        value,
        { ...value, targetId: "other-app" },
        now + 3,
      ),
    ).toEqual({ ok: false, code: "mismatch" });
    expect(
      verifyAcceptedPromotionCheckpoint(
        { ...value, unexpected: true },
        value,
        now + 3,
      ),
    ).toEqual({ ok: false, code: "invalid-checkpoint" });
    expect(
      verifyAcceptedPromotionCheckpoint(
        { ...value, compatibility: [...value.compatibility].reverse() },
        value,
        now + 3,
      ),
    ).toEqual({ ok: false, code: "invalid-checkpoint" });
  });
});
