/**
 * plan — the StackPlan shape and its DETERMINISTIC validators. The slicing
 * JUDGMENT is the agent's (per the skill); this file only checks the manifest:
 * size estimate, dependency order, completeness, depth, and shift-left
 * work-package metadata. None of this proves a slice is CI-green — that is the
 * required CI checks (spec §5).
 */
import {
  missingContractRiskIdsForLayers,
  unknownContractRiskIds,
  type ContractRiskId,
} from "./contract-risk-registry.mjs";

type Slice = {
  readonly id: number;
  readonly branch: string;
  readonly intention: string;
  readonly layers: readonly string[];
  readonly contractRiskIds: readonly ContractRiskId[];
  readonly existingModuleRepairChecklist?: ExistingModuleRepairChecklist;
  readonly workPackages: readonly WorkPackage[];
  readonly taskRefs: readonly string[];
  readonly rationale: string; // advisory only
  readonly estLines: number; // planning estimate; binding size is actual diff at submit
};

type WorkPackageKind = "fixture-to-real" | "pattern-instance" | "template-gap";

type WorkPackage = {
  readonly kind: WorkPackageKind;
  readonly target: string;
  readonly generatorCommand?: string;
  readonly followUpGates: readonly string[];
  readonly templateBacklogRef?: string;
  readonly templateResolutionPath?: string;
  readonly notes?: string;
};

type ExistingModuleRepairChecklist = {
  readonly existingTargetModules: readonly string[];
  readonly repairStrategy:
    "repair" | "extend" | "compatibility-wrap" | "leave-untouched";
  readonly compatibilityRisks: readonly string[];
  readonly policyDataOwnership: string;
  readonly promptVersioningImpact: string;
  readonly evalOrGateCoverage: readonly string[];
};

export type StackPlan = {
  readonly feature: string;
  readonly slices: readonly Slice[];
  readonly allTaskRefs: readonly string[];
  readonly adrRefs?: readonly string[];
};

export type StackPlanValidationOptions = {
  readonly reviewedAdrRefs?: ReadonlySet<string>;
};

// invariant: the per-PR changed-source-line budget (AGENTS.md §Workflow). A
// planning estimate over this is an early warning; the BINDING check is actual
// diff at submit (size.mts). Changing it is a process decision → a reviewed edit.
export const MAX_EST_LINES = 300;

// invariant: max stack depth — the CI-cost guardrail (spec §7). Each slice costs
// a full required-check run; deeper stacks burn minutes
// faster than they buy review value. A reviewed constant, pinned in config-drift.
export const MAX_DEPTH = 4;

// invariant: maestro-template's one-way layer order (AGENTS.md architecture). A slice may
// only depend DOWN: a lower-id slice must not introduce a layer that a higher-id
// slice's layer sits above. Index = rank; higher rank depends on lower.
const LAYER_ORDER = [
  "schema",
  "checks",
  "domain",
  "adapters",
  "capabilities",
  "workflows",
  "agents",
] as const;
const REPAIR_STRATEGIES = new Set([
  "repair",
  "extend",
  "compatibility-wrap",
  "leave-untouched",
]);
const WORK_PACKAGE_KINDS = new Set<WorkPackageKind>([
  "fixture-to-real",
  "pattern-instance",
  "template-gap",
]);

function rank(layer: string): number {
  const i = LAYER_ORDER.indexOf(layer as (typeof LAYER_ORDER)[number]);
  return i === -1 ? LAYER_ORDER.length : i; // unknown layers sort last (no constraint)
}

const ADR_REF_PATTERN =
  /^docs\/template\/adr\/\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function validatePlan(
  input: unknown,
  options: StackPlanValidationOptions = {},
): string[] {
  if (!isStackPlan(input)) return ["plan must match the StackPlan shape"];
  const plan = input;
  const errors: string[] = [];

  errors.push(...validateAdrRefs(plan.adrRefs ?? [], options.reviewedAdrRefs));

  for (const s of plan.slices) {
    if (s.estLines > MAX_EST_LINES)
      errors.push(
        `slice ${s.id} estLines ${s.estLines} exceeds ${MAX_EST_LINES}`,
      );
    const contractRiskIds = contractRiskIdsFor(s);
    const unknownRiskIds = unknownContractRiskIds(contractRiskIds);
    if (unknownRiskIds.length > 0) {
      errors.push(
        `slice ${s.id} references unknown contractRiskIds: ${unknownRiskIds.join(", ")}`,
      );
    }
    const missingRiskIds = missingContractRiskIdsForLayers({
      layers: s.layers,
      contractRiskIds,
    });
    if (missingRiskIds.length > 0) {
      errors.push(
        `slice ${s.id} missing layer-required contractRiskIds: ${missingRiskIds.join(", ")}`,
      );
    }
    errors.push(...validateExistingModuleRepairChecklist(s));
    errors.push(...validateWorkPackages(s));
  }

  if (plan.slices.length > MAX_DEPTH)
    errors.push(
      `stack depth ${plan.slices.length} exceeds MAX_DEPTH ${MAX_DEPTH}`,
    );

  // dependency order: the highest layer-rank a slice TOUCHES must be
  // non-decreasing down the stack — a later slice may add higher layers, but an
  // earlier slice must not sit above a later one.
  let floor = -1;
  for (const s of [...plan.slices].sort((a, b) => a.id - b.id)) {
    const ranks = s.layers.map(rank);
    if (ranks.length === 0) continue;
    const top = Math.max(...ranks);
    if (top < floor)
      errors.push(
        `slice ${s.id} breaks dependency order: layer rank ${top} below earlier ${floor}`,
      );
    floor = Math.max(floor, top);
  }

  const shipped = new Set(plan.slices.flatMap((s) => s.taskRefs));
  for (const ref of plan.allTaskRefs)
    if (!shipped.has(ref)) errors.push(`stack does not cover task ${ref}`);

  return errors;
}

function validateAdrRefs(
  adrRefs: readonly string[],
  reviewedAdrRefs: ReadonlySet<string> | undefined,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, adrRef] of adrRefs.entries()) {
    if (!ADR_REF_PATTERN.test(adrRef)) {
      errors.push(
        `adrRefs[${index}] must be an authoritative docs/template/adr/NNNN-name.md path`,
      );
      continue;
    }
    if (seen.has(adrRef)) {
      errors.push(`adrRefs[${index}] duplicates ${adrRef}`);
      continue;
    }
    seen.add(adrRef);
    if (reviewedAdrRefs !== undefined && !reviewedAdrRefs.has(adrRef)) {
      errors.push(`adrRefs[${index}] does not name an existing accepted ADR`);
    }
  }
  return errors;
}

function validateWorkPackages(slice: Slice): string[] {
  if (!Array.isArray(slice.workPackages) || slice.workPackages.length === 0) {
    return [`slice ${slice.id} workPackages must be a non-empty array`];
  }

  return slice.workPackages.flatMap((workPackage, index) =>
    validateWorkPackage(slice.id, index, workPackage),
  );
}

function validateWorkPackage(
  sliceId: number,
  index: number,
  workPackage: WorkPackage,
): string[] {
  const prefix = `slice ${sliceId} workPackages[${index}]`;
  const errors: string[] = [];

  if (!WORK_PACKAGE_KINDS.has(workPackage.kind)) {
    errors.push(
      `${prefix}.kind must be fixture-to-real, pattern-instance, or template-gap`,
    );
  }
  if (!nonEmptyString(workPackage.target)) {
    errors.push(`${prefix}.target must be a non-empty string`);
  }
  if (!nonEmptyStringArray(workPackage.followUpGates)) {
    errors.push(`${prefix}.followUpGates must be a non-empty string array`);
  }

  if (
    workPackage.kind === "pattern-instance" &&
    !nonEmptyString(workPackage.generatorCommand)
  ) {
    errors.push(
      `${prefix}.generatorCommand is required for pattern-instance work`,
    );
  }

  if (workPackage.kind === "template-gap") {
    if (!nonEmptyString(workPackage.templateBacklogRef)) {
      errors.push(`${prefix}.templateBacklogRef is required for template-gap`);
    }
    if (!nonEmptyString(workPackage.templateResolutionPath)) {
      errors.push(
        `${prefix}.templateResolutionPath is required for template-gap`,
      );
    }
  }

  return errors;
}

function contractRiskIdsFor(slice: Slice): readonly ContractRiskId[] {
  return Array.isArray(slice.contractRiskIds) ? slice.contractRiskIds : [];
}

function validateExistingModuleRepairChecklist(slice: Slice): string[] {
  if (!contractRiskIdsFor(slice).includes("existing-module-repair-checklist")) {
    return [];
  }
  const checklist = slice.existingModuleRepairChecklist;
  if (checklist === undefined) {
    return [
      `slice ${slice.id} missing existingModuleRepairChecklist for existing-module-repair-checklist`,
    ];
  }
  const errors: string[] = [];
  if (!nonEmptyStringArray(checklist.existingTargetModules)) {
    errors.push(
      `slice ${slice.id} existingModuleRepairChecklist.existingTargetModules must be a non-empty string array`,
    );
  }
  if (!REPAIR_STRATEGIES.has(checklist.repairStrategy)) {
    errors.push(
      `slice ${slice.id} existingModuleRepairChecklist.repairStrategy must be repair, extend, compatibility-wrap, or leave-untouched`,
    );
  }
  if (!nonEmptyStringArray(checklist.compatibilityRisks)) {
    errors.push(
      `slice ${slice.id} existingModuleRepairChecklist.compatibilityRisks must be a non-empty string array`,
    );
  }
  if (!nonEmptyString(checklist.policyDataOwnership)) {
    errors.push(
      `slice ${slice.id} existingModuleRepairChecklist.policyDataOwnership must be a non-empty string`,
    );
  }
  if (!nonEmptyString(checklist.promptVersioningImpact)) {
    errors.push(
      `slice ${slice.id} existingModuleRepairChecklist.promptVersioningImpact must be a non-empty string`,
    );
  }
  if (!nonEmptyStringArray(checklist.evalOrGateCoverage)) {
    errors.push(
      `slice ${slice.id} existingModuleRepairChecklist.evalOrGateCoverage must be a non-empty string array`,
    );
  }
  return errors;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every(nonEmptyString)
  );
}

function stringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isStackPlan(value: unknown): value is StackPlan {
  return (
    isRecord(value) &&
    nonEmptyString(value.feature) &&
    Array.isArray(value.slices) &&
    value.slices.every(isSlice) &&
    stringArray(value.allTaskRefs) &&
    (value.adrRefs === undefined || stringArray(value.adrRefs))
  );
}

function isSlice(value: unknown): value is Slice {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    nonEmptyString(value.branch) &&
    nonEmptyString(value.intention) &&
    stringArray(value.layers) &&
    stringArray(value.contractRiskIds) &&
    Array.isArray(value.workPackages) &&
    value.workPackages.every(isWorkPackage) &&
    stringArray(value.taskRefs) &&
    typeof value.rationale === "string" &&
    typeof value.estLines === "number" &&
    Number.isFinite(value.estLines) &&
    (value.existingModuleRepairChecklist === undefined ||
      isExistingModuleRepairChecklist(value.existingModuleRepairChecklist))
  );
}

function isWorkPackage(value: unknown): value is WorkPackage {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    typeof value.target === "string" &&
    stringArray(value.followUpGates) &&
    (value.generatorCommand === undefined ||
      typeof value.generatorCommand === "string") &&
    (value.templateBacklogRef === undefined ||
      typeof value.templateBacklogRef === "string") &&
    (value.templateResolutionPath === undefined ||
      typeof value.templateResolutionPath === "string") &&
    (value.notes === undefined || typeof value.notes === "string")
  );
}

function isExistingModuleRepairChecklist(
  value: unknown,
): value is ExistingModuleRepairChecklist {
  return (
    isRecord(value) &&
    stringArray(value.existingTargetModules) &&
    typeof value.repairStrategy === "string" &&
    stringArray(value.compatibilityRisks) &&
    typeof value.policyDataOwnership === "string" &&
    typeof value.promptVersioningImpact === "string" &&
    stringArray(value.evalOrGateCoverage)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
