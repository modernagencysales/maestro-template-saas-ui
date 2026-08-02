import { describe, expect, it } from "vitest";

import type { PromotionVerdict } from "./contract.js";
import {
  evaluatePromotionRequirements,
  type PromotionReadinessInput,
  type PromotionRequirementEvidence,
} from "./requirements.js";
import { issuePromotionVerdict } from "./verdict.js";
import type { PromotionVerdictExpectation } from "./verify.js";
import type { DeployCredentialLeaseAttestation } from "./authority.js";
import {
  decidePromotion,
  projectPromotionVerdictEvidence,
} from "./decision.js";
import { hashTrustedProductionApproval } from "./trustedAuthority.js";
import { auditPromotionDecisionReceipt } from "./audit.js";
import {
  compileAcceptedPromotionCheckpoint,
  verifyAcceptedPromotionCheckpoint,
} from "./checkpoint.js";

const now = 7_000_000;
const commitSha = "a".repeat(40);
const artifactHash = `sha256:${"b".repeat(64)}`;
const fingerprint = (index: number) =>
  `sha256:${index.toString(16).padStart(64, "0")}`;

const requirementSpecs = [
  ["exact-staged-artifact", "hosted-staging"],
  ["hosted-e2e", "hosted-staging"],
  ["human-approval", "production-approval"],
  ["migration-readiness", "mechanical"],
  ["operator-receipt", "hosted-staging"],
  ["privacy-no-network", "mechanical"],
  ["provider-posture", "hosted-staging"],
  ["rollback-readiness", "mechanical"],
  ["workflow-census", "hosted-staging"],
  ["workflow-compatibility", "mechanical"],
] as const;

const readinessInput = (): PromotionReadinessInput => {
  const evidence: readonly PromotionRequirementEvidence[] =
    requirementSpecs.map(
      ([requirement, evidenceClass], index): PromotionRequirementEvidence => ({
        requirement,
        evidenceClass,
        outcome: "pass",
        environment: "production",
        targetId: "customer-app",
        commitSha,
        artifactHash,
        fingerprint: fingerprint(index + 1),
        observedAt: now - 100,
        expiresAt: now + 10_000,
      }),
    );
  const censusEvidence = evidence.find(
    ({ requirement }) => requirement === "workflow-census",
  );
  if (censusEvidence === undefined) throw new Error("fixture requires census");
  return {
    fromEnvironment: "staging",
    toEnvironment: "production",
    targetId: "customer-app",
    commitSha,
    artifactHash,
    approverClass: "release-controller",
    evidence,
    workflowCensus: {
      capturedAt: censusEvidence.observedAt,
      active: 6,
      restartable: 4,
      fingerprint: censusEvidence.fingerprint,
    },
  };
};

const verdictExpectation = (
  verdict: PromotionVerdict,
): PromotionVerdictExpectation => ({
  fromEnvironment: verdict.fromEnvironment,
  toEnvironment: verdict.toEnvironment,
  targetId: verdict.targetId,
  commitSha: verdict.commitSha,
  artifactHash: verdict.artifactHash,
  compatibility: verdict.compatibility,
  evidence: verdict.evidence,
  workflowCensus: verdict.workflowCensus,
  approverClass: verdict.approverClass,
  issuedAt: verdict.issuedAt,
  expiresAt: verdict.expiresAt,
  nonce: verdict.nonce,
});

describe("full promotion authority chain", () => {
  it("accepts one exact chain and fails closed at evidence and audit boundaries", () => {
    const readiness = readinessInput();
    const requirements = evaluatePromotionRequirements(readiness, {
      nowMs: () => now,
    });
    expect(requirements.kind).toBe("ready");
    if (requirements.kind !== "ready")
      throw new Error("requirements must pass");

    const verdict = issuePromotionVerdict(
      {
        fromEnvironment: readiness.fromEnvironment,
        toEnvironment: readiness.toEnvironment,
        targetId: readiness.targetId,
        commitSha: readiness.commitSha,
        artifactHash: readiness.artifactHash,
        compatibility: [
          { component: "agent-pack", version: "7.2.0" },
          { component: "convex", version: "1.42.1" },
          { component: "workflow", version: "0.4.4" },
        ],
        evidence: projectPromotionVerdictEvidence(requirements),
        workflowCensus: requiredCensus(readiness),
        approverClass: readiness.approverClass,
        ttlMs: 9_000,
      },
      { nowMs: () => now, nonce: () => "promotion_nonce_0101" },
    );
    const lease: DeployCredentialLeaseAttestation = {
      schemaVersion: 1,
      kind: "deploy-credential-lease",
      jobClass: "gated-deploy",
      jobId: "woodpecker.deploy.production.101",
      leaseId: "lease-production-101",
      environment: "production",
      targetId: "customer-app",
      credentialScopes: ["artifact:read", "backend:deploy", "frontend:deploy"],
      credentialSetFingerprint: `sha256:${"c".repeat(64)}`,
      verdictHash: verdict.canonicalHash,
      verdictNonce: verdict.nonce,
      issuedAt: now + 1,
      expiresAt: now + 8_000,
      nonce: "credential_lease_0101",
    };
    const authorityExpectation = {
      verdict: verdictExpectation(verdict),
      lease,
    };
    const approvalEvidence = readiness.evidence.find(
      ({ requirement }) => requirement === "human-approval",
    );
    if (approvalEvidence === undefined)
      throw new Error("production fixture needs human approval evidence");
    const approvalPayload = {
      schemaVersion: 1 as const,
      kind: "trusted-production-approval" as const,
      issuerId: "release-board",
      issuerClass: "release-controller" as const,
      environment: "production" as const,
      targetId: readiness.targetId,
      commitSha: readiness.commitSha,
      artifactHash: readiness.artifactHash,
      approvalEvidenceFingerprint: approvalEvidence.fingerprint,
      issuedAt: now,
      expiresAt: now + 8_000,
      nonce: "approval_nonce_0101",
    };
    const approval = {
      ...approvalPayload,
      canonicalHash: hashTrustedProductionApproval(approvalPayload),
    };

    const decision = decidePromotion(
      {
        verdict,
        lease,
        authorityExpectation,
        readiness,
        trustedProductionApproval: { candidate: approval, expected: approval },
      },
      { nowMs: () => now + 2 },
    );
    expect(decision.kind).toBe("approved");
    if (decision.kind !== "approved") throw new Error("decision must approve");

    const audit = auditPromotionDecisionReceipt(
      decision.receipt,
      {
        trustedReceipt: decision.receipt,
        attempt: {
          fromEnvironment: decision.receipt.fromEnvironment,
          toEnvironment: decision.receipt.toEnvironment,
          targetId: decision.receipt.targetId,
          commitSha: decision.receipt.commitSha,
          artifactHash: decision.receipt.artifactHash,
          evidence: decision.receipt.evidence,
          workflowCensus: decision.receipt.workflowCensus,
          verdictHash: decision.receipt.verdictHash,
          verdictNonce: decision.receipt.verdictNonce,
          jobId: decision.receipt.authority.jobId,
          leaseId: decision.receipt.authority.leaseId,
          leaseNonce: decision.receipt.authority.leaseNonce,
          credentialSetFingerprint:
            decision.receipt.authority.credentialSetFingerprint,
        },
        priorObservations: [],
      },
      { nowMs: () => now + 3 },
    );
    expect(audit.ok).toBe(true);
    if (!audit.ok) throw new Error("audit must accept");

    const checkpoint = compileAcceptedPromotionCheckpoint(
      {
        receipt: decision.receipt,
        trustedReceipt: decision.receipt,
        verdict,
        auditObservation: audit.observation,
      },
      { nowMs: () => now + 4 },
    );
    expect(checkpoint.kind).toBe("compiled");
    if (checkpoint.kind !== "compiled")
      throw new Error("checkpoint must compile");
    expect(
      verifyAcceptedPromotionCheckpoint(
        checkpoint.checkpoint,
        checkpoint.checkpoint,
        now + 5,
      ),
    ).toEqual({ ok: true, checkpoint: checkpoint.checkpoint });
    expect(checkpoint.checkpoint).toMatchObject({
      mode: "record-only",
      status: "accepted",
      compatibility: [
        { component: "agent-pack", version: "7.2.0" },
        { component: "convex", version: "1.42.1" },
        { component: "workflow", version: "0.4.4" },
      ],
      sources: {
        verdictHash: verdict.canonicalHash,
        decisionReceiptHash: decision.receipt.canonicalHash,
        auditObservationHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
    });

    const driftedReadiness = {
      ...readiness,
      evidence: readiness.evidence.map((entry) =>
        entry.requirement === "workflow-compatibility"
          ? { ...entry, fingerprint: `sha256:${"0".repeat(64)}` }
          : entry,
      ),
    };
    expect(
      decidePromotion(
        {
          verdict,
          lease,
          authorityExpectation,
          readiness: driftedReadiness,
          trustedProductionApproval: {
            candidate: approval,
            expected: approval,
          },
        },
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({
          source: "binding",
          code: "evidence-mismatch",
        }),
      ]),
    });

    expect(
      auditPromotionDecisionReceipt(
        decision.receipt,
        {
          trustedReceipt: decision.receipt,
          attempt: {
            fromEnvironment: decision.receipt.fromEnvironment,
            toEnvironment: decision.receipt.toEnvironment,
            targetId: decision.receipt.targetId,
            commitSha: decision.receipt.commitSha,
            artifactHash: `sha256:${"0".repeat(64)}`,
            evidence: decision.receipt.evidence,
            workflowCensus: decision.receipt.workflowCensus,
            verdictHash: decision.receipt.verdictHash,
            verdictNonce: decision.receipt.verdictNonce,
            jobId: decision.receipt.authority.jobId,
            leaseId: decision.receipt.authority.leaseId,
            leaseNonce: decision.receipt.authority.leaseNonce,
            credentialSetFingerprint:
              decision.receipt.authority.credentialSetFingerprint,
          },
          priorObservations: [],
        },
        { nowMs: () => now + 3 },
      ),
    ).toMatchObject({ ok: false, code: "artifact-drift" });
  });
});

const requiredCensus = (readiness: PromotionReadinessInput) => {
  if (readiness.workflowCensus === undefined) {
    throw new Error("production readiness requires census");
  }
  return readiness.workflowCensus;
};
