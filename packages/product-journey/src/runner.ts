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
  readonly expectedReceipt?: Readonly<Record<string, unknown>>;
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
  readonly expectedRuntimeIdentity: JourneyRuntimeIdentity;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const containsExpected = (actual: unknown, expected: unknown): boolean => {
  if (isRecord(expected))
    return (
      isRecord(actual) &&
      Object.entries(expected).every(([key, value]) =>
        containsExpected(actual[key], value),
      )
    );
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => containsExpected(actual[index], value))
    );
  return Object.is(actual, expected);
};

const receiptMatches = (boundary: JourneyBoundary, receipt: unknown): boolean =>
  isRecord(receipt) &&
  Object.prototype.hasOwnProperty.call(receipt, "handle") &&
  Object.prototype.hasOwnProperty.call(receipt, "kind") &&
  receipt.handle === boundary.receipt.handle &&
  receipt.kind === boundary.receipt.kind &&
  (boundary.expectedReceipt === undefined ||
    containsExpected(receipt, boundary.expectedReceipt));

const identityMatches = (
  actual: JourneyRuntimeIdentity,
  expected: JourneyRuntimeIdentity,
  planEnvironment: string,
): boolean =>
  planEnvironment === expected.environment &&
  actual.environment === expected.environment &&
  actual.deploymentIdentity === expected.deploymentIdentity;

const identityFailure = (scenario: JourneyScenario): JourneyScenarioReport => ({
  id: scenario.id,
  expectedTerminalOutcome: scenario.expectedTerminalOutcome,
  ...(scenario.interactions[0] === undefined
    ? {
        earliestFailedBoundary: "$terminal",
        boundaries: [
          {
            id: "$terminal",
            status: "failed" as const,
            error: "RUNTIME_IDENTITY_MISMATCH",
          },
        ],
      }
    : {
        earliestFailedBoundary: scenario.interactions[0].id,
        boundaries: scenario.interactions.map((boundary, index) => ({
          id: boundary.id,
          status: index === 0 ? ("failed" as const) : ("not_reached" as const),
          ...(index === 0 ? { error: "RUNTIME_IDENTITY_MISMATCH" } : {}),
        })),
      }),
});

const createReport = (
  plan: JourneyPlan,
  runtimeIdentity: JourneyRuntimeIdentity,
  scenarios: readonly JourneyScenarioReport[],
): JourneyRunReport => ({
  protocolVersion: 1,
  journeyId: plan.journeyId,
  journeyVersion: plan.journeyVersion,
  commitSha: plan.commitSha,
  environment: plan.environment,
  providerPosture: plan.providerPosture,
  syntheticPersona: plan.syntheticPersona,
  runtimeIdentity,
  scenarios,
});

export const runJourney = async (
  plan: JourneyPlan,
  driver: JourneyDriver,
): Promise<JourneyRunReport> => {
  const runtimeIdentity = await driver.identity();
  if (
    !identityMatches(
      runtimeIdentity,
      plan.expectedRuntimeIdentity,
      plan.environment,
    )
  )
    return createReport(
      plan,
      runtimeIdentity,
      plan.scenarios.map(identityFailure),
    );

  const scenarios: JourneyScenarioReport[] = [];
  for (const scenario of plan.scenarios) {
    if (scenario.interactions.length === 0) {
      scenarios.push({
        id: scenario.id,
        expectedTerminalOutcome: scenario.expectedTerminalOutcome,
        earliestFailedBoundary: "$terminal",
        boundaries: [
          {
            id: "$terminal",
            status: "failed",
            error: "NO_DECLARED_INTERACTION",
          },
        ],
      });
      continue;
    }
    const boundaries: JourneyBoundaryResult[] = [];
    let failed = false;
    let actualTerminalOutcome: string | undefined;
    let earliestFailedBoundary: string | undefined;

    for (const [index, boundary] of scenario.interactions.entries()) {
      if (failed) {
        boundaries.push({ id: boundary.id, status: "not_reached" });
        continue;
      }
      try {
        const invocation = await driver.invoke({ id: boundary.id });
        if (index === scenario.interactions.length - 1)
          actualTerminalOutcome = outcomeOf(invocation);
        const rawReceipt = await driver.inspectReceipt(boundary.receipt);
        if (!receiptMatches(boundary, rawReceipt))
          throw new Error("RECEIPT_ASSERTION_FAILED");
        boundaries.push({
          id: boundary.id,
          status: "passed",
          receipt: redactJourneyEvidence(rawReceipt),
        });
      } catch {
        failed = true;
        earliestFailedBoundary = boundary.id;
        boundaries.push({
          id: boundary.id,
          status: "failed",
          error: "[REDACTED ERROR]",
        });
      }
    }

    if (!failed && actualTerminalOutcome !== scenario.expectedTerminalOutcome) {
      const terminal = boundaries.at(-1);
      if (terminal !== undefined) {
        earliestFailedBoundary = terminal.id;
        boundaries[boundaries.length - 1] = {
          ...terminal,
          status: "failed",
          error: "TERMINAL_OUTCOME_MISMATCH",
        };
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
  return createReport(plan, runtimeIdentity, scenarios);
};

export const toJourneyEvidenceJson = (report: JourneyRunReport): string =>
  stableJourneyJson(report);

const markdownField = (value: unknown): string => {
  const redacted = redactJourneyEvidence(String(value));
  const text = typeof redacted === "string" ? redacted : String(redacted);
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]{}()#+\-.!|>])/g, "\\$1")
    .replace(/\r?\n/g, "\\n");
};

const markdownCode = (value: unknown): string =>
  `\`${stableJourneyJson(value)
    .replace(/`/g, "&#96;")
    .replace(/\r?\n/g, "\\n")}\``;

export const toJourneyEvidenceMarkdown = (report: JourneyRunReport): string => {
  const lines = [
    `# Journey evidence: ${report.journeyId}`,
    "",
    `Protocol version: ${markdownField(report.protocolVersion)}`,
    `Journey version: ${markdownField(report.journeyVersion)}`,
    `Commit: ${markdownField(report.commitSha)}`,
    `Environment: ${markdownField(report.environment)}`,
    `Provider posture: ${markdownField(report.providerPosture)}`,
    `Synthetic persona: ${markdownField(report.syntheticPersona)}`,
    `Runtime environment: ${markdownField(report.runtimeIdentity.environment)}`,
    `Deployment identity: ${markdownField(report.runtimeIdentity.deploymentIdentity ?? "none")}`,
  ];
  lines[0] = `# Journey evidence: ${markdownField(report.journeyId)}`;
  for (const scenario of report.scenarios) {
    lines.push(
      "",
      `## ${markdownField(scenario.id)}`,
      `Expected terminal outcome: ${markdownField(scenario.expectedTerminalOutcome)}`,
      `Actual terminal outcome: ${markdownField(scenario.actualTerminalOutcome ?? "none")}`,
      `Earliest failed boundary: ${markdownField(scenario.earliestFailedBoundary ?? "none")}`,
    );
    for (const boundary of scenario.boundaries) {
      lines.push(
        `- ${markdownField(boundary.id)}: ${markdownField(boundary.status)}`,
      );
      if (boundary.error !== undefined)
        lines.push(`  Error: ${markdownField(boundary.error)}`);
      if (boundary.receipt !== undefined)
        lines.push(`  Receipt: ${markdownCode(boundary.receipt)}`);
    }
  }
  return lines.join("\n");
};
