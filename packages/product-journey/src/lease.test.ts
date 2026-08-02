import { describe, expect, it } from "vitest";
import {
  type AdmissionClaims,
  type VerifiedAdmissionProjection,
  canonicalAdmissionClaims,
  verifyAdmissionAttestation,
} from "./attestation";
import type { AdmissionDependency, EffectiveAdmissionInput } from "./lease";
import { effectiveAdmissionState } from "./lease";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const verified = (
  journeyId = "root",
  dependencyAttestationIds: readonly string[] = [],
): VerifiedAdmissionProjection => {
  const identity = {
    repository: "maestro/template",
    commitSha: "commit-1",
    journeyId,
    journeyVersion: 1,
    journeyHash: `${journeyId}-hash`,
    contractHash: "contract-1",
    testHash: "test-1",
    generatedIdentity: "generated-1",
    deploymentIdentity: "deploy-1",
    environment: "staging",
    runtimeConfigDigest: digest("a"),
    evidenceReportDigest: digest("b"),
    requiredScenarioIds: ["success"],
    dependencyAttestationIds,
  };
  const claims: AdmissionClaims = {
    protocolVersion: 1,
    ...identity,
    issuer: "ci.example",
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-08-02T00:00:00.000Z",
    passedScenarioIds: ["success"],
    skippedScenarioIds: [],
    notReachedScenarioIds: [],
  };
  const result = verifyAdmissionAttestation(
    { ...claims, signature: canonicalAdmissionClaims(claims) },
    identity,
    { "ci.example": { verify: bytesEqual } },
    new Date("2026-08-01T12:00:00.000Z"),
  );
  if (!result.ok) throw new Error(`verification failed: ${result.reason}`);
  return result.verified;
};

const currentInput = (
  projection: VerifiedAdmissionProjection = verified(),
): EffectiveAdmissionInput => ({
  sourceState: "admitted",
  lease: {
    health: "current",
    expiresAt: "2026-08-02T00:00:00.000Z",
    attestationId: projection.attestationId,
    runtimeIdentityHash: projection.runtimeIdentityHash,
    evidenceHash: projection.evidenceHash,
  },
  verifiedAdmission: projection,
  dependencies: [],
  now: new Date("2026-08-01T00:00:00.000Z"),
});

const dependency = (
  projection: VerifiedAdmissionProjection,
  nested: readonly AdmissionDependency[] = [],
): AdmissionDependency => ({
  id: projection.attestationId,
  health: "current",
  verifiedAdmission: projection,
  dependencies: nested,
});

describe("effectiveAdmissionState", () => {
  it("admits only with the exact projection returned by verification", () => {
    expect(effectiveAdmissionState(currentInput())).toMatchObject({
      leaseHealth: "current",
      effectiveState: "admitted",
    });
    const projection = verified();
    const copied = { ...projection } as VerifiedAdmissionProjection;
    expect(
      effectiveAdmissionState({
        ...currentInput(projection),
        verifiedAdmission: copied,
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it.each(["attestationId", "runtimeIdentityHash", "evidenceHash"] as const)(
    "fails closed when the lease %s does not match verified admission",
    (field) => {
      const input = currentInput();
      expect(
        effectiveAdmissionState({
          ...input,
          lease: { ...input.lease, [field]: "old-value" },
        }),
      ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
    },
  );

  it("does not let a lease outlive its verified attestation", () => {
    const input = currentInput();
    expect(
      effectiveAdmissionState({
        ...input,
        lease: { ...input.lease, expiresAt: "2026-08-03T00:00:00.000Z" },
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("requires every signed dependency exactly once with its verified identity", () => {
    const child = verified("child");
    const root = verified("root", [child.attestationId]);
    expect(effectiveAdmissionState(currentInput(root))).toMatchObject({
      leaseHealth: "failing",
    });
    expect(
      effectiveAdmissionState({
        ...currentInput(root),
        dependencies: [dependency(child)],
      }),
    ).toMatchObject({ leaseHealth: "current", effectiveState: "admitted" });
    expect(
      effectiveAdmissionState({
        ...currentInput(root),
        dependencies: [dependency(root)],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
    expect(
      effectiveAdmissionState({
        ...currentInput(root),
        dependencies: [dependency(child), dependency(child)],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("propagates authenticated dependency health", () => {
    const child = verified("child");
    const root = verified("root", [child.attestationId]);
    expect(
      effectiveAdmissionState({
        ...currentInput(root),
        dependencies: [{ ...dependency(child), health: "failing" }],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it.each([
    ["empty id", { id: "" }],
    ["malformed health", { health: "green" }],
    ["malformed dependencies", { dependencies: null }],
  ])("fails closed for %s", (_name, replacement) => {
    const child = verified("child");
    const root = verified("root", [child.attestationId]);
    const malformed = {
      ...dependency(child),
      ...replacement,
    } as AdmissionDependency;
    expect(
      effectiveAdmissionState({
        ...currentInput(root),
        dependencies: [malformed],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("detects logical duplicate cycles by dependency id", () => {
    const child = verified("child");
    const root = verified("root", [child.attestationId]);
    const duplicate = dependency(child);
    const logicalCycle = dependency(child, [duplicate]);
    expect(
      effectiveAdmissionState({
        ...currentInput(root),
        dependencies: [logicalCycle],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("fails closed for invalid lease dates and health", () => {
    const input = currentInput();
    expect(
      effectiveAdmissionState({
        ...input,
        lease: { ...input.lease, expiresAt: "invalid" },
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
    expect(
      effectiveAdmissionState({
        ...input,
        lease: { ...input.lease, health: "green" as "current" },
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("fails closed for a malformed lease object", () => {
    expect(
      effectiveAdmissionState({
        ...currentInput(),
        lease: null as unknown as EffectiveAdmissionInput["lease"],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });
});
