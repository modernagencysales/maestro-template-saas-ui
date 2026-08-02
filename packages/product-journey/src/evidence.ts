import type { JourneyReceiptEnvelope } from "./receipts";

export type JourneyLeaseHealth = "current" | "stale" | "failing";

export type JourneyEvidenceVerdict =
  "passed" | "failed" | "incomplete" | "not_applicable";

export type JourneyEvidenceScenarioResult = {
  readonly scenarioId: string;
  readonly verdict: JourneyEvidenceVerdict;
  readonly durationMs: number;
  readonly expectedTerminalOutcome: string;
  readonly actualTerminalOutcome?: string;
  readonly earliestFailedBoundary?: string;
};

export type JourneyEvidenceReport = {
  readonly protocolVersion: 1;
  readonly journeyId: string;
  readonly journeyVersion: number;
  readonly commitSha: string;
  readonly environment: string;
  readonly providerPosture: "fake" | "test" | "deployed";
  readonly syntheticPersona: string;
  readonly verdict: JourneyEvidenceVerdict;
  readonly leaseHealth: JourneyLeaseHealth;
  readonly scenarioResults: readonly JourneyEvidenceScenarioResult[];
  readonly receipts: readonly JourneyReceiptEnvelope[];
  readonly deployedProof?: {
    readonly deploymentIdentity: string;
    readonly commitSha: string;
  };
};
