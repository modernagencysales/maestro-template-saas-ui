import { describe, expect, it } from "vitest";
import {
  type AdmissionAttestation,
  verifyAdmissionAttestation,
} from "./attestation";

const identity = {
  repository: "maestro/template",
  commitSha: "commit-1",
  journeyId: "workspace-export",
  journeyVersion: 1,
  journeyHash: "journey-1",
  contractHash: "contract-1",
  testHash: "test-1",
  generatedIdentity: "generated-1",
  deploymentIdentity: "deploy-1",
  environment: "staging",
};

const attestation = (): AdmissionAttestation => ({
  protocolVersion: 1,
  ...identity,
  dependencyAttestationIds: ["dependency-1"],
  issuer: "ci.example",
  issuedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-08-02T00:00:00.000Z",
  payload: new Uint8Array([1, 2, 3]),
  signature: new Uint8Array([4, 5, 6]),
});

const trusted = {
  "ci.example": {
    verify: () => true,
  },
};

describe("verifyAdmissionAttestation", () => {
  it("refuses attestations for a different commit", () => {
    expect(
      verifyAdmissionAttestation(
        attestation(),
        { ...identity, commitSha: "commit-2" },
        trusted,
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "COMMIT_MISMATCH" });
  });

  it.each([
    ["journeyHash", "JOURNEY_HASH_MISMATCH"],
    ["contractHash", "CONTRACT_MISMATCH"],
    ["generatedIdentity", "GENERATED_IDENTITY_MISMATCH"],
    ["deploymentIdentity", "DEPLOYMENT_MISMATCH"],
  ] as const)("refuses a mismatched %s", (field, reason) => {
    expect(
      verifyAdmissionAttestation(
        attestation(),
        { ...identity, [field]: "different" },
        trusted,
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason });
  });

  it("refuses expired attestations", () => {
    expect(
      verifyAdmissionAttestation(
        attestation(),
        identity,
        trusted,
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects the local issuer outside local development", () => {
    expect(
      verifyAdmissionAttestation(
        { ...attestation(), issuer: "local" },
        identity,
        { ...trusted, local: { verify: () => true } },
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "LOCAL_ISSUER_FORBIDDEN" });
  });
});
