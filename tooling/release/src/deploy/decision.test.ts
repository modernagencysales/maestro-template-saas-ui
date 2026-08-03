import { describe, expect, it } from "vitest";

import type { PromotionVerdict } from "./contract.js";
import type {
  DeployAuthorityExpectation,
  DeployCredentialLeaseAttestation,
} from "./authority.js";
import {
  evaluatePromotionRequirements,
  type PromotionReadinessInput,
  type PromotionRequirementEvidence,
} from "./requirements.js";
import { issuePromotionVerdict } from "./verdict.js";
import type { PromotionVerdictExpectation } from "./verify.js";
import {
  decidePromotion,
  projectPromotionVerdictEvidence,
  verifyPromotionDecisionReceipt,
  type PromotionDecisionInput,
} from "./decision.js";
import { hashTrustedProductionApproval } from "./trustedAuthority.js";

const now = 4_000_000;
const commitSha = "a".repeat(40);
const artifactHash = `sha256:${"b".repeat(64)}`;
const fingerprint = (index: number) =>
  `sha256:${index.toString(16).padStart(64, "0")}`;

const productionSpecs = [
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

const readiness = (): PromotionReadinessInput => {
  const evidence: readonly PromotionRequirementEvidence[] = productionSpecs.map(
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
      expiresAt: now + 100,
    }),
  );
  const census = evidence.find(
    ({ requirement }) => requirement === "workflow-census",
  );
  if (census === undefined) throw new Error("fixture requires census evidence");
  return {
    fromEnvironment: "staging",
    toEnvironment: "production",
    targetId: "customer-app",
    commitSha,
    artifactHash,
    approverClass: "release-controller",
    evidence,
    workflowCensus: {
      capturedAt: census.observedAt,
      active: 3,
      restartable: 2,
      fingerprint: census.fingerprint,
    },
  };
};

const requiredCensus = (value: PromotionReadinessInput) => {
  if (value.workflowCensus === undefined) {
    throw new Error("production fixture requires workflow census");
  }
  return value.workflowCensus;
};

const verdictExpectation = (
  value: PromotionVerdict,
): PromotionVerdictExpectation => ({
  fromEnvironment: value.fromEnvironment,
  toEnvironment: value.toEnvironment,
  targetId: value.targetId,
  commitSha: value.commitSha,
  artifactHash: value.artifactHash,
  compatibility: value.compatibility,
  evidence: value.evidence,
  workflowCensus: value.workflowCensus,
  approverClass: value.approverClass,
  issuedAt: value.issuedAt,
  expiresAt: value.expiresAt,
  nonce: value.nonce,
});

const credentialLease = (
  verdict: PromotionVerdict,
): DeployCredentialLeaseAttestation => ({
  schemaVersion: 1,
  kind: "deploy-credential-lease",
  jobClass: "gated-deploy",
  jobId: "woodpecker.deploy.production.55",
  leaseId: "lease-production-55",
  environment: "production",
  targetId: "customer-app",
  credentialScopes: ["artifact:read", "backend:deploy", "frontend:deploy"],
  credentialSetFingerprint: `sha256:${"e".repeat(64)}`,
  verdictHash: verdict.canonicalHash,
  verdictNonce: verdict.nonce,
  issuedAt: now + 1,
  expiresAt: now + 50,
  nonce: "credential_lease_0055",
});

const fixture = (): {
  readonly input: PromotionDecisionInput;
  readonly verdict: PromotionVerdict;
  readonly authorityExpectation: DeployAuthorityExpectation;
} => {
  const readinessInput = readiness();
  const readinessResult = evaluatePromotionRequirements(readinessInput, {
    nowMs: () => now,
  });
  if (readinessResult.kind !== "ready") {
    throw new Error("fixture readiness must pass");
  }
  const evidence = projectPromotionVerdictEvidence(readinessResult);
  const verdict = issuePromotionVerdict(
    {
      fromEnvironment: readinessInput.fromEnvironment,
      toEnvironment: readinessInput.toEnvironment,
      targetId: readinessInput.targetId,
      commitSha: readinessInput.commitSha,
      artifactHash: readinessInput.artifactHash,
      compatibility: [{ component: "workflow", version: "0.4.4" }],
      evidence,
      workflowCensus: requiredCensus(readinessInput),
      approverClass: readinessInput.approverClass,
      ttlMs: 60_000,
    },
    { nowMs: () => now, nonce: () => "promotion_nonce_0055" },
  );
  const lease = credentialLease(verdict);
  const authorityExpectation = {
    verdict: verdictExpectation(verdict),
    lease,
  };
  const approvalEvidence = readinessInput.evidence.find(
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
    targetId: readinessInput.targetId,
    commitSha: readinessInput.commitSha,
    artifactHash: readinessInput.artifactHash,
    approvalEvidenceFingerprint: approvalEvidence.fingerprint,
    issuedAt: now,
    expiresAt: now + 50,
    nonce: "approval_nonce_0055",
  };
  const approval = {
    ...approvalPayload,
    canonicalHash: hashTrustedProductionApproval(approvalPayload),
  };
  return {
    verdict,
    authorityExpectation,
    input: {
      verdict,
      lease,
      authorityExpectation,
      readiness: readinessInput,
      trustedProductionApproval: { candidate: approval, expected: approval },
    },
  };
};

describe("promotion decision composition", () => {
  it("combines exact readiness, verdict, and gated authority into one receipt", () => {
    const value = fixture();
    const result = decidePromotion(value.input, { nowMs: () => now + 2 });
    expect(result).toMatchObject({
      kind: "approved",
      receipt: {
        schemaVersion: 1,
        kind: "promotion-decision-receipt",
        mode: "verification-only",
        decision: "approve",
        transition: "staging->production",
        fromEnvironment: "staging",
        toEnvironment: "production",
        targetId: "customer-app",
        commitSha,
        artifactHash,
        approverClass: "release-controller",
        workflowCensus: { active: 3, restartable: 2 },
        verdictHash: value.verdict.canonicalHash,
        verdictNonce: value.verdict.nonce,
        authority: {
          jobId: "woodpecker.deploy.production.55",
          leaseId: "lease-production-55",
          leaseNonce: "credential_lease_0055",
          credentialScopes: [
            "artifact:read",
            "backend:deploy",
            "frontend:deploy",
          ],
        },
        decidedAt: now + 2,
        expiresAt: now + 50,
      },
    });
    if (result.kind !== "approved") throw new Error("expected approval");
    expect(Object.isFrozen(result.receipt)).toBe(true);
    expect(Object.isFrozen(result.receipt.authority)).toBe(true);
    expect(Object.isFrozen(result.receipt.evidence)).toBe(true);
    expect(
      verifyPromotionDecisionReceipt(result.receipt, result.receipt, now + 3),
    ).toEqual({ ok: true, receipt: result.receipt });
  });

  it("reads one injected decision clock", () => {
    const value = fixture();
    let reads = 0;
    expect(
      decidePromotion(value.input, {
        nowMs: () => {
          reads += 1;
          return now + 2;
        },
      }).kind,
    ).toBe("approved");
    expect(reads).toBe(1);
  });

  it("blocks failed requirements even when authority is valid", () => {
    const value = fixture();
    const evidence = value.input.readiness.evidence.map((entry) =>
      entry.requirement === "migration-readiness"
        ? { ...entry, outcome: "fail" as const }
        : entry,
    );
    expect(
      decidePromotion(
        {
          ...value.input,
          readiness: { ...value.input.readiness, evidence },
        },
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({
          source: "requirements",
          code: "evidence-failed",
        }),
      ]),
    });
  });

  it("blocks invalid authority even when requirements pass", () => {
    const value = fixture();
    expect(
      decidePromotion(
        {
          ...value.input,
          lease: {
            ...(value.input.lease as DeployCredentialLeaseAttestation),
            jobId: "parallel.deploy.99",
          },
        },
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({ source: "authority" }),
      ]),
    });
  });

  it("blocks readiness facts bound to a different artifact than the verdict", () => {
    const value = fixture();
    const changedHash = `sha256:${"0".repeat(64)}`;
    const changedReadiness = {
      ...value.input.readiness,
      artifactHash: changedHash,
      evidence: value.input.readiness.evidence.map((entry) => ({
        ...entry,
        artifactHash: changedHash,
      })),
    };
    expect(
      decidePromotion(
        { ...value.input, readiness: changedReadiness },
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({
      kind: "blocked",
      findings: expect.arrayContaining([
        expect.objectContaining({
          source: "authority",
          code: "trusted-production-approval-rejected",
        }),
      ]),
    });
  });

  it("blocks a verdict whose typed evidence does not contain exact requirements", () => {
    const value = fixture();
    const wrongVerdict = issuePromotionVerdict(
      {
        fromEnvironment: "staging",
        toEnvironment: "production",
        targetId: "customer-app",
        commitSha,
        artifactHash,
        compatibility: [{ component: "workflow", version: "0.4.4" }],
        evidence: [
          {
            class: "runtime-verification",
            fingerprint: `sha256:${"0".repeat(64)}`,
          },
        ],
        workflowCensus: requiredCensus(value.input.readiness),
        approverClass: "release-controller",
        ttlMs: 60_000,
      },
      { nowMs: () => now, nonce: () => "promotion_nonce_0066" },
    );
    const lease = credentialLease(wrongVerdict);
    const authorityExpectation = {
      verdict: verdictExpectation(wrongVerdict),
      lease,
    };
    expect(
      decidePromotion(
        {
          ...value.input,
          verdict: wrongVerdict,
          lease,
          authorityExpectation,
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
  });

  it("propagates verdict and lease replay rejection without a receipt", () => {
    const value = fixture();
    expect(
      decidePromotion(value.input, {
        nowMs: () => now + 2,
        consumedVerdictNonces: [value.verdict.nonce],
      }),
    ).toMatchObject({ kind: "blocked" });
    const lease = value.input.lease as DeployCredentialLeaseAttestation;
    expect(
      decidePromotion(value.input, {
        nowMs: () => now + 2,
        consumedLeaseNonces: [lease.nonce],
      }),
    ).toMatchObject({ kind: "blocked" });
  });
});

describe("promotion decision receipt verification", () => {
  const approvedReceipt = () => {
    const value = fixture();
    const result = decidePromotion(value.input, { nowMs: () => now + 2 });
    if (result.kind !== "approved") throw new Error("fixture must approve");
    return result.receipt;
  };

  it("rejects tampered, stale, mismatched, and structurally open receipts", () => {
    const receipt = approvedReceipt();
    expect(
      verifyPromotionDecisionReceipt(
        { ...receipt, targetId: "other-app" },
        receipt,
        now + 3,
      ),
    ).toEqual({ ok: false, code: "tampered" });
    expect(
      verifyPromotionDecisionReceipt(receipt, receipt, receipt.expiresAt),
    ).toEqual({ ok: false, code: "stale" });
    expect(
      verifyPromotionDecisionReceipt(
        receipt,
        { ...receipt, targetId: "other-app" },
        now + 3,
      ),
    ).toEqual({ ok: false, code: "mismatch" });
    expect(
      verifyPromotionDecisionReceipt(
        { ...receipt, unexpected: true },
        receipt,
        now + 3,
      ),
    ).toEqual({ ok: false, code: "invalid-receipt" });
    expect(
      verifyPromotionDecisionReceipt(
        { ...receipt, evidence: [...receipt.evidence].reverse() },
        receipt,
        now + 3,
      ),
    ).toEqual({ ok: false, code: "invalid-receipt" });
  });
});
