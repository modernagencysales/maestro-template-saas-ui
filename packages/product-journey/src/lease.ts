import type { JourneyLeaseHealth } from "./evidence";

export type AdmissionLease = {
  readonly health: JourneyLeaseHealth;
  readonly expiresAt: string;
};

export type AdmissionDependency = {
  readonly health: JourneyLeaseHealth | "suspended";
  readonly dependencies: readonly AdmissionDependency[];
};

export type EffectiveAdmissionInput = {
  readonly sourceState:
    "assembling" | "legacy_exposed" | "admitted" | "suspended";
  readonly lease: AdmissionLease;
  readonly dependencies: readonly AdmissionDependency[];
  readonly now?: Date;
};

export type EffectiveAdmissionState = {
  readonly sourceState: EffectiveAdmissionInput["sourceState"];
  readonly leaseHealth: JourneyLeaseHealth;
  readonly effectiveState: EffectiveAdmissionInput["sourceState"] | "stale";
};

const dependencyHealth = (
  dependency: AdmissionDependency,
): JourneyLeaseHealth => {
  if (dependency.health === "failing" || dependency.health === "suspended")
    return "failing";
  if (
    dependency.health === "stale" ||
    dependency.dependencies.some(
      (nested) => dependencyHealth(nested) !== "current",
    )
  )
    return "stale";
  return "current";
};

export const effectiveAdmissionState = (
  input: EffectiveAdmissionInput,
): EffectiveAdmissionState => {
  const now = input.now ?? new Date();
  const expired = Date.parse(input.lease.expiresAt) <= now.getTime();
  const dependency = input.dependencies
    .map(dependencyHealth)
    .find((health) => health !== "current");
  const leaseHealth: JourneyLeaseHealth =
    input.lease.health === "failing" || dependency === "failing"
      ? "failing"
      : expired || input.lease.health === "stale" || dependency === "stale"
        ? "stale"
        : "current";
  return {
    sourceState: input.sourceState,
    leaseHealth,
    effectiveState:
      input.sourceState === "admitted" && leaseHealth !== "current"
        ? "stale"
        : input.sourceState,
  };
};
