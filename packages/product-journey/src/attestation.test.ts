import { describe, expect, it } from "vitest";
import {
  type AdmissionClaims,
  type AdmissionAttestation,
  canonicalAdmissionClaims,
  verifyAdmissionAttestation,
} from "./attestation";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;

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
  runtimeConfigDigest: digest("a"),
  evidenceReportDigest: digest("b"),
  requiredScenarioIds: ["success", "authorization-denial"],
  dependencyAttestationIds: ["dependency-1"],
};

const unsigned = (): AdmissionClaims => ({
  protocolVersion: 1 as const,
  ...identity,
  issuer: "ci.example",
  issuedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-08-02T00:00:00.000Z",
  passedScenarioIds: ["success", "authorization-denial"],
  skippedScenarioIds: [],
  notReachedScenarioIds: [],
});

const sign = (claims: AdmissionClaims): AdmissionAttestation => ({
  ...claims,
  signature: canonicalAdmissionClaims(claims),
});

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const trusted = {
  "ci.example": { verify: bytesEqual },
  "ci.alternate": { verify: bytesEqual },
};

const verify = (attestation: AdmissionAttestation) =>
  verifyAdmissionAttestation(
    attestation,
    identity,
    trusted,
    new Date("2026-08-01T12:00:00.000Z"),
  );

describe("verifyAdmissionAttestation", () => {
  it("accepts an exact, current, trusted attestation", () => {
    expect(verify(sign(unsigned()))).toEqual({ ok: true });
  });

  it.each([
    ["repository", "other/repository"],
    ["commitSha", "commit-2"],
    ["journeyId", "other-journey"],
    ["journeyVersion", 2],
    ["journeyHash", "journey-2"],
    ["contractHash", "contract-2"],
    ["testHash", "test-2"],
    ["generatedIdentity", "generated-2"],
    ["deploymentIdentity", "deploy-2"],
    ["runtimeConfigDigest", digest("c")],
    ["evidenceReportDigest", digest("d")],
    ["requiredScenarioIds", ["other-scenario"]],
    ["passedScenarioIds", ["success"]],
    ["skippedScenarioIds", ["authorization-denial"]],
    ["notReachedScenarioIds", ["authorization-denial"]],
    ["dependencyAttestationIds", ["dependency-2"]],
    ["issuer", "ci.alternate"],
    ["issuedAt", "2026-08-01T00:01:00.000Z"],
    ["expiresAt", "2026-08-02T00:01:00.000Z"],
  ] as const)(
    "rejects a signed attestation after swapping %s",
    (field, value) => {
      const signed = sign(unsigned());
      expect(verify({ ...signed, [field]: value })).toEqual({
        ok: false,
        reason: "INVALID_SIGNATURE",
      });
    },
  );

  it("uses a deterministic canonical claims encoding", () => {
    const claims = unsigned();
    expect(new TextDecoder().decode(canonicalAdmissionClaims(claims))).toBe(
      new TextDecoder().decode(canonicalAdmissionClaims({ ...claims })),
    );
  });

  it("binds secret-shaped claim strings without redacting their bytes", () => {
    const first = canonicalAdmissionClaims({
      ...unsigned(),
      repository: "secret=repository-one",
    });
    const second = canonicalAdmissionClaims({
      ...unsigned(),
      repository: "secret=repository-two",
    });
    expect(bytesEqual(first, second)).toBe(false);
  });

  it("refuses runtime dependency identity mismatches", () => {
    expect(
      verifyAdmissionAttestation(
        sign(unsigned()),
        { ...identity, dependencyAttestationIds: ["dependency-2"] },
        trusted,
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "DEPENDENCY_MISMATCH" });
  });

  it.each([
    [
      "missing runtime configuration digest",
      { runtimeConfigDigest: undefined },
      "RUNTIME_CONFIG_DIGEST_INVALID",
    ],
    [
      "malformed runtime configuration digest",
      { runtimeConfigDigest: "not-a-digest" },
      "RUNTIME_CONFIG_DIGEST_INVALID",
    ],
    [
      "missing evidence report digest",
      { evidenceReportDigest: undefined },
      "EVIDENCE_REPORT_DIGEST_INVALID",
    ],
    [
      "malformed evidence report digest",
      { evidenceReportDigest: "not-a-digest" },
      "EVIDENCE_REPORT_DIGEST_INVALID",
    ],
  ] as const)("fails closed for %s", (_name, replacement, reason) => {
    const claims = { ...unsigned(), ...replacement } as AdmissionClaims;
    expect(verify(sign(claims))).toEqual({ ok: false, reason });
  });

  it.each([
    ["runtimeConfigDigest", "RUNTIME_CONFIG_MISMATCH"],
    ["evidenceReportDigest", "EVIDENCE_REPORT_MISMATCH"],
    ["requiredScenarioIds", "REQUIRED_SCENARIOS_MISMATCH"],
  ] as const)("refuses a runtime %s mismatch", (field, reason) => {
    const expected = {
      ...identity,
      [field]: field === "requiredScenarioIds" ? ["other"] : digest("f"),
    };
    expect(
      verifyAdmissionAttestation(
        sign(unsigned()),
        expected,
        trusted,
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason });
  });

  it.each([
    ["missing required pass", { passedScenarioIds: ["success"] }],
    [
      "skipped required scenario",
      { skippedScenarioIds: ["authorization-denial"] },
    ],
    [
      "not-reached required scenario",
      { notReachedScenarioIds: ["authorization-denial"] },
    ],
  ] as const)(
    "rejects incomplete scenario closure: %s",
    (_name, replacement) => {
      expect(verify(sign({ ...unsigned(), ...replacement }))).toEqual({
        ok: false,
        reason: "SCENARIO_CLOSURE_INCOMPLETE",
      });
    },
  );

  it("fails closed when scenario closure claims are missing", () => {
    const claims = {
      ...unsigned(),
      passedScenarioIds: undefined,
    } as unknown as AdmissionClaims;
    expect(verify(sign(claims))).toEqual({
      ok: false,
      reason: "SCENARIO_CLOSURE_INCOMPLETE",
    });
  });

  it.each([
    ["invalid issuedAt", { issuedAt: "not-a-date" }, "INVALID_TIME"],
    ["invalid expiresAt", { expiresAt: "not-a-date" }, "INVALID_TIME"],
    [
      "inverted interval",
      { issuedAt: "2026-08-03T00:00:00.000Z" },
      "INVALID_TIME",
    ],
    [
      "future issuance",
      {
        issuedAt: "2026-08-01T12:06:00.000Z",
        expiresAt: "2026-08-02T00:00:00.000Z",
      },
      "NOT_YET_VALID",
    ],
    ["expired", { expiresAt: "2026-08-01T11:59:59.000Z" }, "EXPIRED"],
  ] as const)("fails closed for %s", (_name, replacement, reason) => {
    expect(verify(sign({ ...unsigned(), ...replacement }))).toEqual({
      ok: false,
      reason,
    });
  });

  it("rejects the local issuer outside local development", () => {
    const localClaims = { ...unsigned(), issuer: "local" };
    expect(
      verifyAdmissionAttestation(
        sign(localClaims),
        identity,
        { ...trusted, local: { verify: bytesEqual } },
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "LOCAL_ISSUER_FORBIDDEN" });
  });
});
