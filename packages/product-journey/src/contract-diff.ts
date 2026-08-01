import { createHash } from "node:crypto";
import type { ProductJourneyManifest } from "./manifest";
import { canonicalStringify, compareCodePoints } from "./ordering";

export type JourneyContractDiff = {
  readonly risk: "none" | "coverage_reduction";
  readonly requiresApproval: boolean;
  readonly reductions: readonly string[];
};

const structuralHash = (value: unknown): string =>
  createHash("sha256").update(canonicalStringify(value)).digest("hex");

const recordChange = (
  reductions: string[],
  label: string,
  prior: unknown,
  proposed: unknown,
): void => {
  const priorHash = structuralHash(prior);
  const proposedHash = structuralHash(proposed);
  if (priorHash !== proposedHash) {
    reductions.push(`${label}:${priorHash}->${proposedHash}`);
  }
};

const scenarioIdentities = (
  manifest: ProductJourneyManifest,
): readonly string[] =>
  manifest.scenarios
    .map((scenario) => `${scenario.id}:${structuralHash(scenario)}`)
    .sort(compareCodePoints);

export const diffJourneyContract = (
  base: ProductJourneyManifest,
  proposed: ProductJourneyManifest,
): JourneyContractDiff => {
  const reductions: string[] = [];
  recordChange(reductions, "actor", base.actor, proposed.actor);
  recordChange(reductions, "goal", base.goal, proposed.goal);
  recordChange(
    reductions,
    "release-proof",
    base.releaseProof,
    proposed.releaseProof,
  );
  recordChange(
    reductions,
    "coverage-profile",
    base.coverageProfile,
    proposed.coverageProfile,
  );
  recordChange(
    reductions,
    "transport",
    [...base.releaseEntrypoints].sort(compareCodePoints),
    [...proposed.releaseEntrypoints].sort(compareCodePoints),
  );
  recordChange(
    reductions,
    "receipt",
    [...base.requiredReceiptKinds].sort(compareCodePoints),
    [...proposed.requiredReceiptKinds].sort(compareCodePoints),
  );
  recordChange(reductions, "graph", base.graph, proposed.graph);
  recordChange(
    reductions,
    "dependency",
    base.dependsOnJourneys,
    proposed.dependsOnJourneys,
  );
  recordChange(
    reductions,
    "legacy-exposure",
    base.legacyExposure,
    proposed.legacyExposure,
  );

  const priorScenarios = scenarioIdentities(base);
  const proposedScenarios = scenarioIdentities(proposed);
  const proposedCounts = new Map<string, number>();
  for (const identity of proposedScenarios) {
    proposedCounts.set(identity, (proposedCounts.get(identity) ?? 0) + 1);
  }
  for (const identity of priorScenarios) {
    const remaining = proposedCounts.get(identity) ?? 0;
    if (remaining === 0)
      reductions.push(`scenario-removed-or-changed:${identity}`);
    else proposedCounts.set(identity, remaining - 1);
  }
  const priorCounts = new Map<string, number>();
  for (const identity of priorScenarios) {
    priorCounts.set(identity, (priorCounts.get(identity) ?? 0) + 1);
  }
  for (const identity of proposedScenarios) {
    const remaining = priorCounts.get(identity) ?? 0;
    if (remaining === 0)
      reductions.push(`scenario-added-or-changed:${identity}`);
    else priorCounts.set(identity, remaining - 1);
  }

  reductions.sort(compareCodePoints);
  return {
    risk: reductions.length === 0 ? "none" : "coverage_reduction",
    requiresApproval: reductions.length > 0,
    reductions,
  };
};
