export type Blueprint = {
  readonly id: string;
  readonly status: "implemented" | "planned";
};

export type MaestroMappingInput = {
  readonly blueprint: Blueprint;
  readonly fitScore: number;
  readonly purchaseCreditCents: number;
  readonly gaps: readonly string[];
};

export type MaestroPrimaryAction =
  "start-building" | "review-planned-blueprint" | "take-spec-elsewhere";

export type WorkPackage =
  | {
      readonly kind: "pattern-instance";
      readonly target: string;
      readonly generatorCommand: string;
      readonly followUpGates: readonly string[];
    }
  | {
      readonly kind: "fixture-to-real";
      readonly target: string;
      readonly persistenceOrProviderBoundary: string;
      readonly followUpGates: readonly string[];
    }
  | {
      readonly kind: "template-gap";
      readonly target: string;
      readonly templateBacklogRef: string;
      readonly templateResolutionPath: string;
      readonly followUpGates: readonly string[];
    };

export const validateWorkPackage = (value: unknown): WorkPackage => {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    throw new Error("Work package must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.kind === "template-gap" &&
    (typeof candidate.templateBacklogRef !== "string" ||
      typeof candidate.templateResolutionPath !== "string")
  ) {
    throw new Error(
      "A template gap requires a backlog reference and resolution path.",
    );
  }
  if (!Array.isArray(candidate.followUpGates)) {
    throw new Error("A work package requires follow-up gates.");
  }
  return candidate as WorkPackage;
};

export const mapBuildPackToMaestro = (input: MaestroMappingInput) => {
  const primaryAction: MaestroPrimaryAction =
    input.fitScore < 55
      ? "take-spec-elsewhere"
      : input.blueprint.status === "planned"
        ? "review-planned-blueprint"
        : "start-building";
  return {
    ...input,
    primaryAction,
    creditLabel: `$${(input.purchaseCreditCents / 100).toFixed(2)} Maestro credit`,
  };
};
