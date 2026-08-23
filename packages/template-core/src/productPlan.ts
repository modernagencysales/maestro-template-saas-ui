import * as Schema from "effect/Schema";

import {
  type ProductBehavior,
  type ProductContract,
  type ProductSurface,
  validateProductContract,
} from "./productContract";
import { WorkPackageSchema, type WorkPackage } from "./workPackage";

export type ProductPlanFrontmatter = {
  readonly planSchemaVersion: 1;
  readonly productContract: "product.contract.yaml";
  readonly workPackages: readonly [
    {
      readonly id: string;
      readonly behaviorIds: readonly [string, ...string[]];
      readonly appMapTargets: readonly [string, ...string[]];
      readonly work: WorkPackage;
    },
    ...{
      readonly id: string;
      readonly behaviorIds: readonly [string, ...string[]];
      readonly appMapTargets: readonly [string, ...string[]];
      readonly work: WorkPackage;
    }[],
  ];
  readonly proofs: readonly [
    {
      readonly behavior: string;
      readonly behaviorRevision: number;
      readonly level: "black-box";
      readonly surfaces: readonly [ProductSurface, ...ProductSurface[]];
      readonly observation: string;
      readonly failureWitness: string;
    },
    ...{
      readonly behavior: string;
      readonly behaviorRevision: number;
      readonly level: "black-box";
      readonly surfaces: readonly [ProductSurface, ...ProductSurface[]];
      readonly observation: string;
      readonly failureWitness: string;
    }[],
  ];
};

const nonBlankText = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const positiveInteger = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0)),
);
const behaviorId = nonBlankText.pipe(
  Schema.check(Schema.isPattern(/^BHV-[A-Z0-9]+-[0-9]+$/u)),
);
const workPackageId = nonBlankText.pipe(
  Schema.check(Schema.isPattern(/^WP-[A-Z0-9]+-[0-9]+$/u)),
);
const distinctBehaviorIds = Schema.NonEmptyArray(behaviorId).pipe(
  Schema.check(Schema.isUnique()),
);
const appMapTargets = Schema.NonEmptyArray(nonBlankText).pipe(
  Schema.check(Schema.isUnique()),
);
const productSurfaces = Schema.NonEmptyArray(
  Schema.Literals(["web-ui", "cli-process", "public-http"]),
).pipe(Schema.check(Schema.isUnique()));
const WorkPackagePlanItemSchema = Schema.Struct({
  id: workPackageId,
  behaviorIds: distinctBehaviorIds,
  appMapTargets,
  work: WorkPackageSchema,
});
const ProofSchema = Schema.Struct({
  behavior: behaviorId,
  behaviorRevision: positiveInteger,
  level: Schema.Literal("black-box"),
  surfaces: productSurfaces,
  observation: nonBlankText,
  failureWitness: nonBlankText,
});

export const ProductPlanFrontmatterSchema = Schema.Struct({
  planSchemaVersion: Schema.Literal(1),
  productContract: Schema.Literal("product.contract.yaml"),
  workPackages: Schema.NonEmptyArray(WorkPackagePlanItemSchema),
  proofs: Schema.NonEmptyArray(ProofSchema),
});

export const validateProductPlanFrontmatter = (
  value: unknown,
): ProductPlanFrontmatter =>
  Schema.decodeUnknownSync(ProductPlanFrontmatterSchema, {
    onExcessProperty: "error",
  })(value);

const setEqual = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === rightSet.size &&
    [...leftSet].every((value) => rightSet.has(value))
  );
};

const behaviorById = (
  contract: ProductContract,
): ReadonlyMap<string, ProductBehavior> =>
  new Map(contract.behaviors.map((behavior) => [behavior.id, behavior]));

type ProductPlanProof = ProductPlanFrontmatter["proofs"][number];

const validateWorkPackageBindings = (input: {
  readonly plan: ProductPlanFrontmatter;
  readonly behaviors: ReadonlyMap<string, ProductBehavior>;
  readonly workPackageIds: Set<string>;
}): readonly string[] => {
  const findings: string[] = [];
  for (const workPackage of input.plan.workPackages) {
    if (input.workPackageIds.has(workPackage.id)) {
      findings.push(`duplicate work-package id: ${workPackage.id}`);
    }
    input.workPackageIds.add(workPackage.id);
    for (const behaviorId of workPackage.behaviorIds) {
      const behavior = input.behaviors.get(behaviorId);
      if (!behavior) findings.push(`unknown behavior: ${behaviorId}`);
      else if (behavior.status === "retired") {
        findings.push(`retired behavior cited by active plan: ${behaviorId}`);
      }
    }
    const hasWebBehavior = workPackage.behaviorIds.some((behaviorId) =>
      input.behaviors.get(behaviorId)?.surfaces.includes("web-ui"),
    );
    if (hasWebBehavior && workPackage.work.frontend === undefined) {
      findings.push(
        `${workPackage.id} serves web-ui but is missing frontend screen authority`,
      );
    }
  }
  return findings;
};

const validateProofBindings = (input: {
  readonly plan: ProductPlanFrontmatter;
  readonly behaviors: ReadonlyMap<string, ProductBehavior>;
  readonly requiredProofs: Map<string, ProductPlanProof>;
}): readonly string[] => {
  const findings: string[] = [];
  for (const proof of input.plan.proofs) {
    const behavior = input.behaviors.get(proof.behavior);
    if (!behavior) {
      findings.push(`unknown proof behavior: ${proof.behavior}`);
      continue;
    }
    if (behavior.status === "retired") {
      findings.push(`retired behavior has a proof: ${proof.behavior}`);
      continue;
    }
    input.requiredProofs.set(proof.behavior, proof);
    if (proof.behaviorRevision !== behavior.revision) {
      findings.push(
        `${proof.behavior} proof revision ${proof.behaviorRevision} differs from contract revision ${behavior.revision}`,
      );
    }
    if (!setEqual(proof.surfaces, behavior.surfaces)) {
      findings.push(
        `${proof.behavior} proof surfaces differ from contract surfaces`,
      );
    }
  }
  return findings;
};

export const validateProductPlanBindings = (input: {
  readonly contract: ProductContract;
  readonly plans: readonly ProductPlanFrontmatter[];
}): readonly string[] => {
  const findings: string[] = [];
  const contract = validateProductContract(input.contract);
  const behaviors = behaviorById(contract);
  const workPackageIds = new Set<string>();
  const requiredProofs = new Map<
    string,
    ProductPlanFrontmatter["proofs"][number]
  >();

  for (const [planIndex, rawPlan] of input.plans.entries()) {
    const plan = validateProductPlanFrontmatter(rawPlan);
    const packageBehaviorIds = plan.workPackages.flatMap(
      ({ behaviorIds }) => behaviorIds,
    );
    const proofBehaviorIds = plan.proofs.map(({ behavior }) => behavior);
    if (!setEqual(packageBehaviorIds, proofBehaviorIds)) {
      findings.push(
        `plan ${planIndex} work-package and proof behavior IDs differ`,
      );
    }
    findings.push(
      ...validateWorkPackageBindings({ plan, behaviors, workPackageIds }),
      ...validateProofBindings({ plan, behaviors, requiredProofs }),
    );
  }

  for (const behavior of contract.behaviors) {
    if (behavior.status === "required" && !requiredProofs.has(behavior.id)) {
      findings.push(
        `required behavior ${behavior.id} is missing a black-box proof`,
      );
    }
  }
  return findings;
};
