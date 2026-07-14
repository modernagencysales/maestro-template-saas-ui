import {
  assertLabels,
  assertRecord,
  assertString,
  assertStringArray,
  buildReceipt,
  metric,
  reviewedLabelPassed,
  type BrainEvalCaseBase,
  type BrainEvalFailure,
  type BrainEvalSuiteResult,
} from "./brain-eval-report";

export type BrainClassificationCase = BrainEvalCaseBase & {
  readonly allowedTargets: readonly string[];
  readonly expectedTarget: string | null;
  readonly outputTargets: readonly string[];
  readonly committedTarget: string | null;
};

export const parseBrainClassificationCases = (
  value: unknown,
): readonly BrainClassificationCase[] => {
  if (!Array.isArray(value)) {
    throw new Error("Classification suite must be an array.");
  }
  return value.map((candidate) => {
    const record = assertRecord(candidate, "classification case");
    return {
      id: assertString(record.id, "classification case id"),
      split: assertString(
        record.split,
        "classification split",
      ) as BrainClassificationCase["split"],
      labels: assertLabels(record.labels),
      allowedTargets: assertStringArray(
        record.allowedTargets,
        "allowed targets",
      ),
      expectedTarget:
        record.expectedTarget === null
          ? null
          : assertString(record.expectedTarget, "expected target"),
      outputTargets: assertStringArray(record.outputTargets, "output targets"),
      committedTarget:
        record.committedTarget === null
          ? null
          : assertString(record.committedTarget, "committed target"),
    };
  });
};

export const evaluateBrainClassification = (
  suiteFixture: unknown,
): BrainEvalSuiteResult => {
  const suite = assertRecord(suiteFixture, "classification fixture");
  const cases = parseBrainClassificationCases(suite.cases);
  const testCases = cases.filter((entry) => entry.split === "test");
  const failures: BrainEvalFailure[] = [];

  let agreement = 0;
  let allowlist = 0;
  let singleTarget = 0;
  let noCrossClientCommit = 0;

  for (const testCase of testCases) {
    const labelAgreement =
      reviewedLabelPassed(testCase.labels) &&
      testCase.labels.adjudicated === (testCase.expectedTarget ?? "no-route");
    if (labelAgreement) agreement += 1;
    else
      failures.push({
        caseId: testCase.id,
        message: "Classification must match adjudicated reviewer label.",
      });

    const insideAllowlist = testCase.outputTargets.every((target) =>
      testCase.allowedTargets.includes(target),
    );
    if (insideAllowlist) allowlist += 1;
    else
      failures.push({
        caseId: testCase.id,
        message: "Classification target must stay inside pinned allowlist.",
      });

    const atMostOne = testCase.outputTargets.length <= 1;
    if (atMostOne) singleTarget += 1;
    else
      failures.push({
        caseId: testCase.id,
        message: "Classification must choose zero or one target.",
      });

    const noCrossClient =
      testCase.committedTarget === null ||
      testCase.committedTarget === testCase.expectedTarget;
    if (noCrossClient) noCrossClientCommit += 1;
    else
      failures.push({
        caseId: testCase.id,
        message: "Classification must not commit a cross-client route.",
      });
  }

  const receipt = buildReceipt({
    suiteVersion: assertString(
      suite.suiteVersion,
      "classification suite version",
    ),
    fixture: suiteFixture,
    modelId: assertString(suite.modelId, "classification model id"),
    promptVersion: assertString(
      suite.promptVersion,
      "classification prompt version",
    ),
    toolSchemaVersion: assertString(
      suite.toolSchemaVersion,
      "classification tool schema version",
    ),
    totals: { cases: cases.length, testCases: testCases.length },
    metrics: {
      agreement: metric(agreement, testCases.length, 0.9),
      allowlist: metric(allowlist, testCases.length, 1),
      singleTarget: metric(singleTarget, testCases.length, 1),
      noCrossClientCommit: metric(noCrossClientCommit, testCases.length, 1),
    },
    failures,
  });

  return {
    suiteName: "classification",
    receipt,
    status: receipt.passed ? "approved" : "rejected",
  };
};
