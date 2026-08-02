import { buildPackStageNames, type BuildPackStageName } from "./buildPack";
import { evaluationVerdicts, type EvaluationVerdict } from "./schemas";

export type EvaluationCompletedEvent = {
  readonly name: "evaluation_completed";
  readonly evaluationId: string;
  readonly verdict: EvaluationVerdict;
  readonly durationMs: number;
  readonly modelCalls: number;
  readonly estimatedCostCents: number;
};

export type FunnelEvent =
  | EvaluationCompletedEvent
  | { readonly name: "checkout_started"; readonly reportId: string }
  | {
      readonly name: "entitlement_granted";
      readonly reportId: string;
      readonly purchaseStatus: "paid";
    }
  | { readonly name: "build_pack_started"; readonly packId: string }
  | {
      readonly name: "build_pack_stage_changed";
      readonly packId: string;
      readonly stage: BuildPackStageName;
      readonly status: "completed" | "failed-recoverable" | "needs-support";
      readonly attempts: number;
    }
  | {
      readonly name: "build_pack_exported";
      readonly packId: string;
      readonly format: "markdown" | "print-html";
    }
  | {
      readonly name: "maestro_offer_selected";
      readonly packId: string;
      readonly blueprintId: string;
      readonly fit: "strong" | "partial" | "low";
    };

const eventKeys = {
  evaluation_completed: [
    "name",
    "evaluationId",
    "verdict",
    "durationMs",
    "modelCalls",
    "estimatedCostCents",
  ],
  checkout_started: ["name", "reportId"],
  entitlement_granted: ["name", "reportId", "purchaseStatus"],
  build_pack_started: ["name", "packId"],
  build_pack_stage_changed: ["name", "packId", "stage", "status", "attempts"],
  build_pack_exported: ["name", "packId", "format"],
  maestro_offer_selected: ["name", "packId", "blueprintId", "fit"],
} as const satisfies Record<FunnelEvent["name"], readonly string[]>;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  isNonNegativeNumber(value) && Number.isInteger(value);

export const validateFunnelEvent = (event: unknown): FunnelEvent => {
  if (typeof event !== "object" || event === null) {
    throw new Error("Funnel event must be an object.");
  }

  const candidate = event as Record<string, unknown>;
  const name = candidate.name;
  if (typeof name !== "string" || !(name in eventKeys)) {
    throw new Error("Funnel event does not match the allowlisted schema.");
  }

  const allowedKeys = new Set<string>(eventKeys[name as FunnelEvent["name"]]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${key} is not an allowed analytics property.`);
    }
  }

  const valid = (() => {
    switch (name) {
      case "evaluation_completed":
        return (
          isNonEmptyString(candidate.evaluationId) &&
          typeof candidate.verdict === "string" &&
          evaluationVerdicts.includes(candidate.verdict as EvaluationVerdict) &&
          isNonNegativeNumber(candidate.durationMs) &&
          isNonNegativeInteger(candidate.modelCalls) &&
          isNonNegativeNumber(candidate.estimatedCostCents)
        );
      case "checkout_started":
      case "build_pack_started":
        return isNonEmptyString(
          candidate[name === "checkout_started" ? "reportId" : "packId"],
        );
      case "entitlement_granted":
        return (
          isNonEmptyString(candidate.reportId) &&
          candidate.purchaseStatus === "paid"
        );
      case "build_pack_stage_changed":
        return (
          isNonEmptyString(candidate.packId) &&
          typeof candidate.stage === "string" &&
          buildPackStageNames.includes(candidate.stage as BuildPackStageName) &&
          (candidate.status === "completed" ||
            candidate.status === "failed-recoverable" ||
            candidate.status === "needs-support") &&
          isNonNegativeInteger(candidate.attempts)
        );
      case "build_pack_exported":
        return (
          isNonEmptyString(candidate.packId) &&
          (candidate.format === "markdown" || candidate.format === "print-html")
        );
      case "maestro_offer_selected":
        return (
          isNonEmptyString(candidate.packId) &&
          isNonEmptyString(candidate.blueprintId) &&
          (candidate.fit === "strong" ||
            candidate.fit === "partial" ||
            candidate.fit === "low")
        );
      default:
        return false;
    }
  })();

  if (!valid) {
    throw new Error("Funnel event does not match the allowlisted schema.");
  }
  return candidate as FunnelEvent;
};
