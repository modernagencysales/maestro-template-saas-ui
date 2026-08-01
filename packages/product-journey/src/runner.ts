import { redactJourneyEvidence, stableJourneyJson } from "./redaction";

export type JourneyRuntimeIdentity = {
  readonly environment: string;
  readonly deploymentIdentity?: string;
};

export type JourneyInteraction = { readonly id: string };
export type JourneyReceiptHandle = {
  readonly handle: string;
  readonly kind: string;
};

export type JourneyDriver = {
  readonly invoke: (interaction: JourneyInteraction) => Promise<unknown>;
  readonly inspectReceipt: (handle: JourneyReceiptHandle) => Promise<unknown>;
  readonly identity: () => Promise<JourneyRuntimeIdentity>;
};

export type JourneyBoundary = {
  readonly id: string;
  readonly receipt: JourneyReceiptHandle;
};

export type JourneyScenario = {
  readonly id: string;
  readonly expectedTerminalOutcome: string;
  readonly interactions: readonly JourneyBoundary[];
};

export type JourneyPlan = {
  readonly journeyId: string;
  readonly journeyVersion: number;
  readonly commitSha: string;
  readonly environment: string;
  readonly providerPosture: "fake" | "test" | "deployed";
  readonly syntheticPersona: string;
  readonly scenarios: readonly JourneyScenario[];
};

export type JourneyBoundaryResult = {
  readonly id: string;
  readonly status: "passed" | "failed" | "not_reached";
  readonly receipt?: unknown;
  readonly error?: string;
};

export type JourneyScenarioReport = {
  readonly id: string;
  readonly expectedTerminalOutcome: string;
  readonly actualTerminalOutcome?: string;
  readonly earliestFailedBoundary?: string;
  readonly boundaries: readonly JourneyBoundaryResult[];
};

export type JourneyRunReport = {
  readonly protocolVersion: 1;
  readonly journeyId: string;
  readonly journeyVersion: number;
  readonly commitSha: string;
  readonly environment: string;
  readonly providerPosture: JourneyPlan["providerPosture"];
  readonly syntheticPersona: string;
  readonly runtimeIdentity: JourneyRuntimeIdentity;
  readonly scenarios: readonly JourneyScenarioReport[];
};

const outcomeOf = (value: unknown): string | undefined =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { outcome?: unknown }).outcome === "string"
    ? (value as { outcome: string }).outcome
    : undefined;

const redactedError = (_error: unknown): string => "[REDACTED ERROR]";

export const runJourney = async (
  plan: JourneyPlan,
  driver: JourneyDriver,
): Promise<JourneyRunReport> => {
  const runtimeIdentity = await driver.identity();
  const scenarios: JourneyScenarioReport[] = [];

  for (const scenario of plan.scenarios) {
    const boundaries: JourneyBoundaryResult[] = [];
    let failed = false;
    let actualTerminalOutcome: string | undefined;
    let earliestFailedBoundary: string | undefined;

    for (const boundary of scenario.interactions) {
      if (failed) {
        boundaries.push({ id: boundary.id, status: "not_reached" });
        continue;
      }
      try {
        actualTerminalOutcome =
          outcomeOf(await driver.invoke({ id: boundary.id })) ??
          actualTerminalOutcome;
        const receipt = redactJourneyEvidence(
          await driver.inspectReceipt(boundary.receipt),
        );
        boundaries.push({ id: boundary.id, status: "passed", receipt });
      } catch (error) {
        failed = true;
        earliestFailedBoundary = boundary.id;
        boundaries.push({
          id: boundary.id,
          status: "failed",
          error: redactedError(error),
        });
      }
    }
    scenarios.push({
      id: scenario.id,
      expectedTerminalOutcome: scenario.expectedTerminalOutcome,
      ...(actualTerminalOutcome === undefined ? {} : { actualTerminalOutcome }),
      ...(earliestFailedBoundary === undefined
        ? {}
        : { earliestFailedBoundary }),
      boundaries,
    });
  }
  return { ...plan, protocolVersion: 1, runtimeIdentity, scenarios };
};

export const toJourneyEvidenceJson = (report: JourneyRunReport): string =>
  stableJourneyJson(report);

export const toJourneyEvidenceMarkdown = (report: JourneyRunReport): string => {
  const lines = [
    `# Journey evidence: ${report.journeyId}`,
    "",
    `Commit: ${report.commitSha}`,
    `Environment: ${report.environment}`,
  ];
  for (const scenario of report.scenarios) {
    lines.push("", `## ${scenario.id}`);
    for (const boundary of scenario.boundaries)
      lines.push(`- ${boundary.id}: ${boundary.status}`);
  }
  return lines.join("\n");
};
