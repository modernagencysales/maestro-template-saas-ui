import { describe, expect, it } from "vitest";
import { issuePromotionVerdict } from "./verdict.js";
import { verifyAndConsumeDeployAuthority } from "./consumption.js";
import {
  hashTrustedProductionApproval,
  verifyTrustedProductionApproval,
  type TrustedProductionApprovalPayload,
} from "./trustedAuthority.js";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const now = 1_000;

describe("promotion authority closure", () => {
  it("atomically rejects concurrent verdict and lease replay", async () => {
    const verdict = issuePromotionVerdict(
      {
        fromEnvironment: "staging",
        toEnvironment: "production",
        targetId: "app",
        commitSha: "a".repeat(40),
        artifactHash: digest("b"),
        compatibility: [{ component: "workflow", version: "1" }],
        evidence: [
          { class: "security-verification", fingerprint: digest("c") },
        ],
        workflowCensus: {
          capturedAt: now,
          active: 0,
          restartable: 0,
          fingerprint: digest("d"),
        },
        approverClass: "release-controller",
      },
      { nowMs: () => now, nonce: () => "verdict_nonce_0001" },
    );
    const lease = {
      schemaVersion: 1 as const,
      kind: "deploy-credential-lease" as const,
      jobClass: "gated-deploy" as const,
      jobId: "job.1",
      leaseId: "lease.1",
      environment: "production",
      targetId: "app",
      credentialScopes: ["artifact:read"],
      credentialSetFingerprint: digest("e"),
      verdictHash: verdict.canonicalHash,
      verdictNonce: verdict.nonce,
      issuedAt: now,
      expiresAt: now + 1_000,
      nonce: "lease_nonce_000001",
    };
    const expectation = { verdict: { ...verdict }, lease };
    let consumed = false;
    const nonceConsumer = {
      consumeExactlyOnce: async () => {
        if (consumed) return { kind: "replayed" as const };
        consumed = true;
        return { kind: "consumed" as const };
      },
    };
    const first = await verifyAndConsumeDeployAuthority(
      { verdict, lease },
      expectation,
      { nowMs: () => now + 1, nonceConsumer },
    );
    const second = await verifyAndConsumeDeployAuthority(
      { verdict, lease },
      expectation,
      { nowMs: () => now + 1, nonceConsumer },
    );
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, code: "lease-replayed" });
  });

  it("rejects a forged issuer and excessive trusted approval lifetime", () => {
    const payload: TrustedProductionApprovalPayload = {
      schemaVersion: 1,
      kind: "trusted-production-approval",
      issuerId: "release-board",
      issuerClass: "release-controller",
      environment: "production",
      targetId: "app",
      commitSha: "a".repeat(40),
      artifactHash: digest("b"),
      approvalEvidenceFingerprint: digest("c"),
      issuedAt: now,
      expiresAt: now + 1_000,
      nonce: "approval_nonce_001",
    };
    const trusted = {
      ...payload,
      canonicalHash: hashTrustedProductionApproval(payload),
    };
    const forgedPayload = { ...payload, issuerId: "attacker" };
    const forged = {
      ...forgedPayload,
      canonicalHash: hashTrustedProductionApproval(forgedPayload),
    };
    expect(verifyTrustedProductionApproval(forged, trusted, now + 1).ok).toBe(
      false,
    );
    const longPayload = { ...payload, expiresAt: now + 60 * 60 * 1_000 };
    const long = {
      ...longPayload,
      canonicalHash: hashTrustedProductionApproval(longPayload),
    };
    expect(verifyTrustedProductionApproval(long, long, now + 1).ok).toBe(false);
  });
});
