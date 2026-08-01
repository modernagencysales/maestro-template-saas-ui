import type { ProductJourneyManifest } from "./manifest";

export type JourneyContractDiff = {
  readonly risk: "none" | "coverage_reduction";
  readonly requiresApproval: boolean;
  readonly reductions: readonly string[];
};

const removed = (
  base: readonly string[],
  proposed: readonly string[],
  label: string,
): string[] =>
  base
    .filter((value) => !proposed.includes(value))
    .map((value) => `${label}:${value}`);

export const diffJourneyContract = (
  base: ProductJourneyManifest,
  proposed: ProductJourneyManifest,
): JourneyContractDiff => {
  const reductions = [
    ...(base.actor === proposed.actor ? [] : ["actor coverage changed"]),
    ...removed(
      base.releaseEntrypoints,
      proposed.releaseEntrypoints,
      "transport",
    ),
    ...removed(
      base.requiredReceiptKinds,
      proposed.requiredReceiptKinds,
      "receipt",
    ),
    ...removed(
      base.scenarios.map(({ scenarioClass }) => scenarioClass),
      proposed.scenarios.map(({ scenarioClass }) => scenarioClass),
      "scenario",
    ),
    ...removed(
      base.scenarios.flatMap(({ forbiddenOutcomes }) => forbiddenOutcomes),
      proposed.scenarios.flatMap(({ forbiddenOutcomes }) => forbiddenOutcomes),
      "forbidden-outcome",
    ),
  ].sort();
  return {
    risk: reductions.length === 0 ? "none" : "coverage_reduction",
    requiresApproval: reductions.length > 0,
    reductions,
  };
};
