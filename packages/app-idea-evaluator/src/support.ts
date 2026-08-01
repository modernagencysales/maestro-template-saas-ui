import type { BuildPackStageName } from "./buildPack";

export type GenerationIncident = {
  readonly incidentId: string;
  readonly packId: string;
  readonly purchaseId: string;
  readonly failedStage: BuildPackStageName;
  readonly status: "recoverable" | "needs-support" | "resumed";
  readonly requiresRepurchase: false;
  readonly operatorReason?: string;
};

export const createGenerationIncident = (input: {
  readonly incidentId: string;
  readonly packId: string;
  readonly purchaseId: string;
  readonly failedStage: BuildPackStageName;
}): GenerationIncident => ({
  ...input,
  status: "recoverable",
  requiresRepurchase: false,
});

export const resumeGenerationIncident = (
  incident: GenerationIncident,
  input: { readonly operatorReason: string },
): GenerationIncident => {
  if (incident.status !== "recoverable") {
    throw new Error("This generation incident is not recoverable.");
  }
  const operatorReason = input.operatorReason.trim();
  if (!operatorReason) {
    throw new Error("An operator reason is required to resume generation.");
  }
  return {
    ...incident,
    status: "resumed",
    requiresRepurchase: false,
    operatorReason,
  };
};
