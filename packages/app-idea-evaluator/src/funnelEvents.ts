import { evaluationVerdicts, type EvaluationVerdict } from "./schemas";

export type EvaluationCompletedEvent = {
  readonly name: "evaluation_completed";
  readonly evaluationId: string;
  readonly verdict: EvaluationVerdict;
  readonly durationMs: number;
  readonly modelCalls: number;
  readonly estimatedCostCents: number;
};

export type FunnelEvent = EvaluationCompletedEvent;

const eventKeys = new Set([
  "name",
  "evaluationId",
  "verdict",
  "durationMs",
  "modelCalls",
  "estimatedCostCents",
]);

export const validateFunnelEvent = (event: unknown): FunnelEvent => {
  if (typeof event !== "object" || event === null) {
    throw new Error("Funnel event must be an object.");
  }
  for (const key of Object.keys(event)) {
    if (!eventKeys.has(key)) {
      throw new Error(`${key} is not an allowed analytics property.`);
    }
  }
  const candidate = event as Record<string, unknown>;
  if (
    candidate.name !== "evaluation_completed" ||
    typeof candidate.evaluationId !== "string" ||
    !candidate.evaluationId.trim() ||
    typeof candidate.verdict !== "string" ||
    !evaluationVerdicts.includes(candidate.verdict as EvaluationVerdict) ||
    typeof candidate.durationMs !== "number" ||
    !Number.isFinite(candidate.durationMs) ||
    candidate.durationMs < 0 ||
    typeof candidate.modelCalls !== "number" ||
    !Number.isInteger(candidate.modelCalls) ||
    candidate.modelCalls < 0 ||
    typeof candidate.estimatedCostCents !== "number" ||
    !Number.isFinite(candidate.estimatedCostCents) ||
    candidate.estimatedCostCents < 0
  ) {
    throw new Error("Funnel event does not match the allowlisted schema.");
  }
  return candidate as FunnelEvent;
};
