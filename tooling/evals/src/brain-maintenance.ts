import {
  assertLabels,
  assertRecord,
  assertString,
  buildReceipt,
  metric,
  reviewedLabelPassed,
  type BrainEvalCaseBase,
  type BrainEvalFailure,
  type BrainEvalSuiteResult,
} from "./brain-eval-report";

export type BrainMaintenanceCase = BrainEvalCaseBase & {
  readonly output: {
    readonly factualChangeCited: boolean;
    readonly acceptedWithoutFactualCorrection: boolean;
    readonly staleOrRevokedPublish: boolean;
  };
};

export const parseBrainMaintenanceCases = (
  value: unknown,
): readonly BrainMaintenanceCase[] => {
  if (!Array.isArray(value))
    throw new Error("Maintenance suite must be an array.");
  return value.map((candidate) => {
    const record = assertRecord(candidate, "maintenance case");
    const output = assertRecord(record.output, "maintenance output");
    return {
      id: assertString(record.id, "maintenance case id"),
      split: assertString(
        record.split,
        "maintenance split",
      ) as BrainMaintenanceCase["split"],
      labels: assertLabels(record.labels),
      output: {
        factualChangeCited: output.factualChangeCited === true,
        acceptedWithoutFactualCorrection:
          output.acceptedWithoutFactualCorrection === true,
        staleOrRevokedPublish: output.staleOrRevokedPublish === true,
      },
    };
  });
};

export const evaluateBrainMaintenance = (
  suiteFixture: unknown,
): BrainEvalSuiteResult => {
  const suite = assertRecord(suiteFixture, "maintenance fixture");
  const cases = parseBrainMaintenanceCases(suite.cases);
  const testCases = cases.filter((entry) => entry.split === "test");
  const failures: BrainEvalFailure[] = [];

  const cited = testCases.filter((entry) => {
    const passed = entry.output.factualChangeCited;
    if (!passed)
      failures.push({
        caseId: entry.id,
        message: "Maintenance factual changes must be cited.",
      });
    return passed;
  }).length;
  const accepted = testCases.filter((entry) => {
    const passed =
      reviewedLabelPassed(entry.labels) &&
      entry.output.acceptedWithoutFactualCorrection;
    if (!passed)
      failures.push({
        caseId: entry.id,
        message:
          "Maintenance proposal must be accepted without factual correction.",
      });
    return passed;
  }).length;
  const fresh = testCases.filter((entry) => {
    const passed = !entry.output.staleOrRevokedPublish;
    if (!passed)
      failures.push({
        caseId: entry.id,
        message: "Maintenance must not publish stale or revoked content.",
      });
    return passed;
  }).length;

  const receipt = buildReceipt({
    suiteVersion: assertString(suite.suiteVersion, "maintenance suite version"),
    fixture: suiteFixture,
    modelId: assertString(suite.modelId, "maintenance model id"),
    promptVersion: assertString(
      suite.promptVersion,
      "maintenance prompt version",
    ),
    toolSchemaVersion: assertString(
      suite.toolSchemaVersion,
      "maintenance tool schema version",
    ),
    totals: { cases: cases.length, testCases: testCases.length },
    metrics: {
      citationCoverage: metric(cited, testCases.length, 1),
      acceptedWithoutCorrection: metric(accepted, testCases.length, 0.8),
      freshness: metric(fresh, testCases.length, 1),
    },
    failures,
  });

  return {
    suiteName: "maintenance",
    receipt,
    status: receipt.passed ? "approved" : "rejected",
  };
};
