import {
  isVerifiedAdmissionProjection,
  type VerifiedAdmissionProjection,
} from "./attestation";
import type { JourneyLeaseHealth } from "./evidence";

export type AdmissionLease = {
  readonly health: JourneyLeaseHealth;
  readonly expiresAt: string;
  readonly attestationId: string;
  readonly runtimeIdentityHash: string;
  readonly evidenceHash: string;
};

export type AdmissionDependency = {
  readonly id: string;
  readonly health: JourneyLeaseHealth | "suspended";
  readonly verifiedAdmission: VerifiedAdmissionProjection;
  readonly dependencies: readonly AdmissionDependency[];
};

export type EffectiveAdmissionInput = {
  readonly sourceState:
    "assembling" | "legacy_exposed" | "admitted" | "suspended";
  readonly lease: AdmissionLease;
  readonly verifiedAdmission: VerifiedAdmissionProjection;
  readonly dependencies: readonly AdmissionDependency[];
  readonly now?: Date;
};

export type EffectiveAdmissionState = {
  readonly sourceState: EffectiveAdmissionInput["sourceState"];
  readonly leaseHealth: JourneyLeaseHealth;
  readonly effectiveState: EffectiveAdmissionInput["sourceState"] | "stale";
};

const validLeaseHealth = (value: unknown): value is JourneyLeaseHealth =>
  value === "current" || value === "stale" || value === "failing";
const validDependencyHealth = (
  value: unknown,
): value is AdmissionDependency["health"] =>
  validLeaseHealth(value) || value === "suspended";

const worse = (
  left: JourneyLeaseHealth,
  right: JourneyLeaseHealth,
): JourneyLeaseHealth => {
  if (left === "failing" || right === "failing") return "failing";
  if (left === "stale" || right === "stale") return "stale";
  return "current";
};

const sameIdentitySet = (
  expected: readonly string[],
  actual: readonly string[],
): boolean =>
  new Set(expected).size === expected.length &&
  new Set(actual).size === actual.length &&
  expected.length === actual.length &&
  expected.every((identity) => actual.includes(identity));

type DependencyProjection = {
  readonly valid: boolean;
  readonly health: JourneyLeaseHealth;
};

const projectDependency = (
  dependency: AdmissionDependency,
  path: Set<string>,
  seen: Set<string>,
  nowMs: number,
): DependencyProjection => {
  if (
    typeof dependency !== "object" ||
    dependency === null ||
    typeof dependency.id !== "string" ||
    dependency.id.length === 0 ||
    !validDependencyHealth(dependency.health) ||
    !Array.isArray(dependency.dependencies) ||
    !isVerifiedAdmissionProjection(dependency.verifiedAdmission) ||
    !Number.isFinite(Date.parse(dependency.verifiedAdmission.expiresAt)) ||
    Date.parse(dependency.verifiedAdmission.expiresAt) <= nowMs ||
    dependency.id !== dependency.verifiedAdmission.attestationId ||
    path.has(dependency.id) ||
    seen.has(dependency.id)
  )
    return { valid: false, health: "failing" };

  const childIds = dependency.dependencies.map((child) => child?.id);
  if (
    childIds.some((id) => typeof id !== "string") ||
    !sameIdentitySet(
      dependency.verifiedAdmission.dependencyAttestationIds,
      childIds as string[],
    )
  )
    return { valid: false, health: "failing" };

  seen.add(dependency.id);
  const nestedPath = new Set(path).add(dependency.id);
  let health: JourneyLeaseHealth =
    dependency.health === "suspended" ? "failing" : dependency.health;
  for (const child of dependency.dependencies) {
    const projected = projectDependency(child, nestedPath, seen, nowMs);
    if (!projected.valid) return projected;
    health = worse(health, projected.health);
  }
  return { valid: true, health };
};

const bindingIsCurrent = (
  lease: AdmissionLease,
  verified: VerifiedAdmissionProjection,
  nowMs: number,
): boolean =>
  isVerifiedAdmissionProjection(verified) &&
  Number.isFinite(Date.parse(verified.expiresAt)) &&
  Date.parse(verified.expiresAt) > nowMs &&
  Date.parse(lease.expiresAt) <= Date.parse(verified.expiresAt) &&
  lease.attestationId === verified.attestationId &&
  lease.runtimeIdentityHash === verified.runtimeIdentityHash &&
  lease.evidenceHash === verified.evidenceHash;

export const effectiveAdmissionState = (
  input: EffectiveAdmissionInput,
): EffectiveAdmissionState => {
  const failClosed = (): EffectiveAdmissionState => ({
    sourceState: input.sourceState,
    leaseHealth: "failing",
    effectiveState:
      input.sourceState === "admitted" ? "stale" : input.sourceState,
  });
  if (
    typeof input.lease !== "object" ||
    input.lease === null ||
    typeof input.lease.expiresAt !== "string" ||
    typeof input.lease.attestationId !== "string" ||
    typeof input.lease.runtimeIdentityHash !== "string" ||
    typeof input.lease.evidenceHash !== "string"
  )
    return failClosed();
  const nowMs = (input.now ?? new Date()).getTime();
  const expiresAt = Date.parse(input.lease.expiresAt);
  const validTime = Number.isFinite(nowMs) && Number.isFinite(expiresAt);
  let dependencyProjection: DependencyProjection = {
    valid: Array.isArray(input.dependencies),
    health: "current",
  };

  if (
    dependencyProjection.valid &&
    isVerifiedAdmissionProjection(input.verifiedAdmission)
  ) {
    const directIds = input.dependencies.map((dependency) => dependency?.id);
    dependencyProjection = {
      valid:
        directIds.every((id) => typeof id === "string") &&
        sameIdentitySet(
          input.verifiedAdmission.dependencyAttestationIds,
          directIds as string[],
        ),
      health: "current",
    };
    const seen = new Set<string>();
    for (const dependency of input.dependencies) {
      const projected = projectDependency(dependency, new Set(), seen, nowMs);
      dependencyProjection = {
        valid: dependencyProjection.valid && projected.valid,
        health: worse(dependencyProjection.health, projected.health),
      };
    }
  } else {
    dependencyProjection = { valid: false, health: "failing" };
  }

  const leaseHealth: JourneyLeaseHealth =
    !validTime ||
    !validLeaseHealth(input.lease.health) ||
    !bindingIsCurrent(input.lease, input.verifiedAdmission, nowMs) ||
    !dependencyProjection.valid
      ? "failing"
      : worse(
          input.lease.health,
          expiresAt <= nowMs ? "stale" : dependencyProjection.health,
        );
  return {
    sourceState: input.sourceState,
    leaseHealth,
    effectiveState:
      input.sourceState === "admitted" && leaseHealth !== "current"
        ? "stale"
        : input.sourceState,
  };
};
