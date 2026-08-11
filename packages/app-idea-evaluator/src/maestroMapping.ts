import {
  WorkPackageSchema,
  validateWorkPackage,
} from "@maestro-template/template-core";
import type { WorkPackage } from "@maestro-template/template-core";

import type { CompleteBuildPack } from "./buildPack";

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

export { WorkPackageSchema, validateWorkPackage };
export type { WorkPackage };

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

export type MaestroGeneratorCatalogEntry = {
  readonly target: string;
  readonly status: "implemented" | "planned";
  readonly generatorCommand: string;
  readonly followUpGates: readonly string[];
};

export type MaestroTemplateGap = {
  readonly target: string;
  readonly templateBacklogRef: string;
  readonly templateResolutionPath: string;
  readonly followUpGates: readonly string[];
};

export type CompleteMaestroMapping = ReturnType<
  typeof mapBuildPackToMaestro
> & {
  readonly domainNouns: readonly string[];
  readonly capabilities: readonly string[];
  readonly workflows: readonly string[];
  readonly providers: readonly string[];
  readonly workPackages: readonly WorkPackage[];
  readonly gates: readonly string[];
  readonly handoffPrompt: string;
};

const domainNoun = (entry: string): string =>
  (entry.split(/\s+[—–-]\s+/u)[0] ?? entry).trim();

export const mapCompleteBuildPackToMaestro = ({
  pack,
  blueprint,
  fitScore,
  purchaseCreditCents,
  catalog,
  gaps,
}: {
  readonly pack: CompleteBuildPack;
  readonly blueprint: Blueprint;
  readonly fitScore: number;
  readonly purchaseCreditCents: number;
  readonly catalog: readonly MaestroGeneratorCatalogEntry[];
  readonly gaps: readonly MaestroTemplateGap[];
}): CompleteMaestroMapping => {
  const implementedPackages = catalog
    .filter(({ status }) => status === "implemented")
    .map((entry): WorkPackage =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: entry.target,
        generatorCommand: entry.generatorCommand,
        followUpGates: [...entry.followUpGates],
      }),
    );
  const gapPackages = gaps.map((gap): WorkPackage =>
    validateWorkPackage({
      kind: "template-gap",
      target: gap.target,
      templateBacklogRef: gap.templateBacklogRef,
      templateResolutionPath: gap.templateResolutionPath,
      followUpGates: [...gap.followUpGates],
    }),
  );
  const workPackages = [...implementedPackages, ...gapPackages];
  const mapped = mapBuildPackToMaestro({
    blueprint,
    fitScore,
    purchaseCreditCents,
    gaps: gaps.map(({ target }) => target),
  });
  const gates = [
    ...pack.acceptanceCriteria,
    ...workPackages.flatMap(({ followUpGates }) => followUpGates),
  ];
  const workPackagePlan = workPackages
    .map((workPackage) => {
      if (workPackage.kind === "pattern-instance") {
        return `- ${workPackage.target}: ${workPackage.generatorCommand}`;
      }
      if (workPackage.kind === "fixture-to-real") {
        return `- ${workPackage.target}: ${workPackage.persistenceOrProviderBoundary}`;
      }
      return `- ${workPackage.target}: ${workPackage.templateResolutionPath} (${workPackage.templateBacklogRef})`;
    })
    .join("\n");
  const handoffPrompt = [
    "Build the product described by this Complete Build Pack.",
    `Product brief: ${pack.productBrief}`,
    `Customer and problem: ${pack.customerAndProblem}`,
    `Architecture: ${pack.architecture}`,
    `Blueprint: ${blueprint.id} (${blueprint.status})`,
    "Use these work packages:",
    workPackagePlan || "- No executable Maestro work package is claimed.",
    "Treat every acceptance criterion and follow-up gate as required evidence.",
  ].join("\n\n");

  return {
    ...mapped,
    domainNouns: pack.dataModel.map(domainNoun).filter(Boolean),
    capabilities: [...pack.requirements],
    workflows: [...pack.userJourneys],
    providers: [...pack.integrations],
    workPackages,
    gates,
    handoffPrompt,
  };
};
