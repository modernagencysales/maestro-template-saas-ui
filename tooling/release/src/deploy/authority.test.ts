import { describe, expect, it } from "vitest";

import type { PromotionVerdict } from "./contract.js";
import { issuePromotionVerdict } from "./verdict.js";
import type { PromotionVerdictExpectation } from "./verify.js";
import {
  parseDeployCredentialLeaseAttestation,
  verifyDeployAuthority,
  type DeployAuthorityExpectation,
  type DeployCredentialLeaseAttestation,
} from "./authority.js";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const now = 2_000_000;

const verdict = (toEnvironment = "production") =>
  issuePromotionVerdict(
    {
      fromEnvironment:
        toEnvironment === "production"
          ? "staging"
          : toEnvironment === "staging"
            ? "preview"
            : "dev",
      toEnvironment,
      targetId: "customer-app",
      commitSha: "a".repeat(40),
      artifactHash: digest("b"),
      compatibility: [{ component: "workflow", version: "0.4.4" }],
      evidence: [{ class: "artifact-provenance", fingerprint: digest("c") }],
      workflowCensus: {
        capturedAt: now - 10,
        active: 2,
        restartable: 1,
        fingerprint: digest("d"),
      },
      approverClass: "release-controller",
      ttlMs: 60_000,
    },
    { nowMs: () => now, nonce: () => "promotion_nonce_0001" },
  );

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

const lease = (value: PromotionVerdict): DeployCredentialLeaseAttestation => ({
  schemaVersion: 1,
  kind: "deploy-credential-lease",
  jobClass: "gated-deploy",
  jobId: "woodpecker.deploy.production.42",
  leaseId: "lease-production-42",
  environment: value.toEnvironment,
  targetId: value.targetId,
  credentialScopes: ["artifact:read", "backend:deploy", "frontend:deploy"],
  credentialSetFingerprint: digest("e"),
  verdictHash: value.canonicalHash,
  verdictNonce: value.nonce,
  issuedAt: now + 1,
  expiresAt: now + 30_000,
  nonce: "credential_lease_0001",
});

const expectation = (
  value: PromotionVerdict,
  credentialLease = lease(value),
): DeployAuthorityExpectation => ({
  verdict: verdictExpectation(value),
  lease: credentialLease,
});

describe("deploy credential lease contract", () => {
  it("parses a closed, frozen, credential-free gated-job attestation", () => {
    const value = lease(verdict());
    const parsed = parseDeployCredentialLeaseAttestation(value);
    expect(parsed).toEqual(value);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.credentialScopes)).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/secret|token|password/i);
  });

  it.each([
    [
      "unknown credential surface",
      (value: Record<string, unknown>) => {
        value.secret = "no";
      },
    ],
    ["missing job", (value: Record<string, unknown>) => delete value.jobId],
    [
      "wrong job class",
      (value: Record<string, unknown>) => {
        value.jobClass = "general";
      },
    ],
    [
      "duplicate scope",
      (value: Record<string, unknown>) => {
        (value.credentialScopes as string[]).push("artifact:read");
      },
    ],
    [
      "reordered scope",
      (value: Record<string, unknown>) => {
        (value.credentialScopes as string[]).reverse();
      },
    ],
  ] as const)("rejects %s", (_label, mutate) => {
    const value = structuredClone(lease(verdict())) as unknown as Record<
      string,
      unknown
    >;
    mutate(value);
    expect(() => parseDeployCredentialLeaseAttestation(value)).toThrow();
  });
});

describe("deploy authority verification", () => {
  it.each(["staging", "production"])(
    "binds an exact %s verdict to the gated job without deploying",
    (environment) => {
      const promotionVerdict = verdict(environment);
      const credentialLease = lease(promotionVerdict);
      const result = verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expectation(promotionVerdict, credentialLease),
        { nowMs: () => now + 2 },
      );
      expect(result).toEqual({
        ok: true,
        authorization: {
          kind: "deploy-authority-verification",
          mode: "verification-only",
          environment,
          targetId: "customer-app",
          jobId: "woodpecker.deploy.production.42",
          leaseId: "lease-production-42",
          credentialScopes: [
            "artifact:read",
            "backend:deploy",
            "frontend:deploy",
          ],
          credentialSetFingerprint: digest("e"),
          verdictHash: promotionVerdict.canonicalHash,
          verdictNonce: promotionVerdict.nonce,
          leaseNonce: "credential_lease_0001",
          verifiedAt: now + 2,
        },
      });
    },
  );

  it("rejects a valid preview verdict because it is not deploy authority", () => {
    const preview = verdict("preview");
    expect(
      verifyDeployAuthority(
        { verdict: preview, lease: lease(preview) },
        expectation(preview),
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({ ok: false, code: "lease-mismatch" });
  });

  it.each([
    ["jobId", "parallel.deploy.99"],
    ["leaseId", "other-lease"],
    ["environment", "staging"],
    ["targetId", "other-app"],
    ["credentialSetFingerprint", digest("0")],
    ["verdictHash", digest("0")],
    ["verdictNonce", "promotion_nonce_0002"],
    ["nonce", "credential_lease_0002"],
  ] as const)("rejects changed %s authority", (key, replacement) => {
    const promotionVerdict = verdict();
    const changed = { ...lease(promotionVerdict), [key]: replacement };
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: changed },
        expectation(promotionVerdict),
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({ ok: false, code: "lease-mismatch" });
  });

  it("rejects scope substitution and reordering against trusted authority", () => {
    const promotionVerdict = verdict();
    const credentialLease = lease(promotionVerdict);
    for (const credentialScopes of [
      ["artifact:read", "backend:deploy"],
      [...credentialLease.credentialScopes].reverse(),
    ]) {
      expect(
        verifyDeployAuthority(
          {
            verdict: promotionVerdict,
            lease: { ...credentialLease, credentialScopes },
          },
          expectation(promotionVerdict, credentialLease),
          { nowMs: () => now + 2 },
        ),
      ).not.toMatchObject({ ok: true });
    }
  });

  it("rejects a lease outside the verdict window", () => {
    const promotionVerdict = verdict();
    const credentialLease = {
      ...lease(promotionVerdict),
      expiresAt: promotionVerdict.expiresAt + 1,
    };
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expectation(promotionVerdict, credentialLease),
        { nowMs: () => now + 2 },
      ),
    ).toMatchObject({ ok: false, code: "lease-mismatch" });
  });

  it("rejects future, stale, and replayed leases", () => {
    const promotionVerdict = verdict();
    const credentialLease = lease(promotionVerdict);
    const expected = expectation(promotionVerdict, credentialLease);
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expected,
        { nowMs: () => credentialLease.issuedAt - 1 },
      ),
    ).toMatchObject({ ok: false, code: "lease-not-yet-valid" });
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expected,
        { nowMs: () => credentialLease.expiresAt },
      ),
    ).toMatchObject({ ok: false, code: "lease-expired" });
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expected,
        {
          nowMs: () => now + 2,
          consumedLeaseNonces: [credentialLease.nonce],
        },
      ),
    ).toMatchObject({ ok: false, code: "lease-replayed" });
  });

  it("propagates stale and replayed verdict rejection before lease approval", () => {
    const promotionVerdict = verdict();
    const credentialLease = lease(promotionVerdict);
    const expected = expectation(promotionVerdict, credentialLease);
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expected,
        { nowMs: () => promotionVerdict.expiresAt },
      ),
    ).toMatchObject({
      ok: false,
      code: "verdict-rejected",
      verdictCode: "expired",
    });
    expect(
      verifyDeployAuthority(
        { verdict: promotionVerdict, lease: credentialLease },
        expected,
        {
          nowMs: () => now + 2,
          consumedVerdictNonces: [promotionVerdict.nonce],
        },
      ),
    ).toMatchObject({
      ok: false,
      code: "verdict-rejected",
      verdictCode: "nonce-replayed",
    });
  });
});
