import type { JourneyLeaseHealth } from "./evidence";

export type AdmissionLease = {
  readonly health: JourneyLeaseHealth;
  readonly expiresAt: string;
  readonly attestationId: string;
  readonly runtimeIdentityHash: string;
  readonly evidenceHash: string;
};

export type VerifiedAdmission =
  | {
      readonly ok: true;
      readonly attestationId: string;
      readonly runtimeIdentityHash: string;
      readonly evidenceHash: string;
    }
  | { readonly ok: false };

export type AdmissionDependency = {
  readonly id: string;
  readonly health: JourneyLeaseHealth | "suspended";
  readonly dependencies: readonly AdmissionDependency[];
};

export type EffectiveAdmissionInput = {
  readonly sourceState:
    "assembling" | "legacy_exposed" | "admitted" | "suspended";
  readonly lease: AdmissionLease;
  readonly verifiedAdmission: VerifiedAdmission;
  readonly dependencies: readonly AdmissionDependency[];
  readonly now?: Date;
};

export type EffectiveAdmissionState = {
  readonly sourceState: EffectiveAdmissionInput["sourceState"];
  readonly leaseHealth: JourneyLeaseHealth;
  readonly effectiveState: EffectiveAdmissionInput["sourceState"] | "stale";
};

const worse = (
  left: JourneyLeaseHealth,
  right: JourneyLeaseHealth,
): JourneyLeaseHealth => {
  if (left === "failing" || right === "failing") return "failing";
  if (left === "stale" || right === "stale") return "stale";
  return "current";
};

const dependencyHealth = (
  dependency: AdmissionDependency,
  visiting: Set<AdmissionDependency>,
  memo: Map<AdmissionDependency, JourneyLeaseHealth>,
): JourneyLeaseHealth => {
  const known = memo.get(dependency);
  if (known !== undefined) return known;
  if (visiting.has(dependency)) return "failing";
  visiting.add(dependency);
  let health: JourneyLeaseHealth =
    dependency.health === "suspended" ? "failing" : dependency.health;
  for (const nested of dependency.dependencies)
    health = worse(health, dependencyHealth(nested, visiting, memo));
  visiting.delete(dependency);
  memo.set(dependency, health);
  return health;
};

const bindingIsCurrent = (
  lease: AdmissionLease,
  verified: VerifiedAdmission,
): boolean =>
  verified.ok &&
  lease.attestationId === verified.attestationId &&
  lease.runtimeIdentityHash === verified.runtimeIdentityHash &&
  lease.evidenceHash === verified.evidenceHash;

export const effectiveAdmissionState = (
  input: EffectiveAdmissionInput,
): EffectiveAdmissionState => {
  const nowMs = (input.now ?? new Date()).getTime();
  const expiresAt = Date.parse(input.lease.expiresAt);
  const validTime = Number.isFinite(nowMs) && Number.isFinite(expiresAt);
  const memo = new Map<AdmissionDependency, JourneyLeaseHealth>();
  let dependency: JourneyLeaseHealth = "current";
  for (const item of input.dependencies)
    dependency = worse(dependency, dependencyHealth(item, new Set(), memo));

  const leaseHealth: JourneyLeaseHealth =
    !validTime || !bindingIsCurrent(input.lease, input.verifiedAdmission)
      ? "failing"
      : worse(input.lease.health, expiresAt <= nowMs ? "stale" : dependency);
  return {
    sourceState: input.sourceState,
    leaseHealth,
    effectiveState:
      input.sourceState === "admitted" && leaseHealth !== "current"
        ? "stale"
        : input.sourceState,
  };
};
