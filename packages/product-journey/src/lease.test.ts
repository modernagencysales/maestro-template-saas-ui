import { describe, expect, it } from "vitest";
import type { AdmissionDependency, EffectiveAdmissionInput } from "./lease";
import { effectiveAdmissionState } from "./lease";

const currentInput = (): EffectiveAdmissionInput => ({
  sourceState: "admitted",
  lease: {
    health: "current",
    expiresAt: "2026-08-02T00:00:00.000Z",
    attestationId: "attestation-1",
    runtimeIdentityHash: "runtime-1",
    evidenceHash: "evidence-1",
  },
  verifiedAdmission: {
    ok: true,
    attestationId: "attestation-1",
    runtimeIdentityHash: "runtime-1",
    evidenceHash: "evidence-1",
  },
  dependencies: [],
  now: new Date("2026-08-01T00:00:00.000Z"),
});

describe("effectiveAdmissionState", () => {
  it("keeps an admitted journey current only for matching verified evidence", () => {
    expect(effectiveAdmissionState(currentInput())).toEqual({
      sourceState: "admitted",
      leaseHealth: "current",
      effectiveState: "admitted",
    });
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

  it("does not admit an unverified lease", () => {
    expect(
      effectiveAdmissionState({
        ...currentInput(),
        verifiedAdmission: { ok: false },
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("fails closed for an invalid lease date", () => {
    const input = currentInput();
    expect(
      effectiveAdmissionState({
        ...input,
        lease: { ...input.lease, expiresAt: "invalid" },
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("propagates nested failing over stale", () => {
    expect(
      effectiveAdmissionState({
        ...currentInput(),
        dependencies: [
          { id: "stale", health: "stale", dependencies: [] },
          {
            id: "parent",
            health: "current",
            dependencies: [
              { id: "failing", health: "failing", dependencies: [] },
            ],
          },
        ],
      }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });

  it("fails closed for dependency cycles", () => {
    const first = {
      id: "first",
      health: "current",
      dependencies: [],
    } as unknown as AdmissionDependency & {
      dependencies: AdmissionDependency[];
    };
    const second = {
      id: "second",
      health: "current",
      dependencies: [first],
    } as AdmissionDependency;
    first.dependencies.push(second);
    expect(
      effectiveAdmissionState({ ...currentInput(), dependencies: [first] }),
    ).toMatchObject({ leaseHealth: "failing", effectiveState: "stale" });
  });
});
