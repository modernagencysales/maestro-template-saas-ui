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

export type BrainAnswerCase = BrainEvalCaseBase & {
  readonly kind: "claim" | "no-evidence";
  readonly output: {
    readonly claimEntailed: boolean;
    readonly citationLocatorResolved: boolean;
    readonly redactionMarker: boolean;
    readonly abstained: boolean;
    readonly inventedSource: boolean;
  };
};

export const parseBrainAnswerCases = (
  value: unknown,
): readonly BrainAnswerCase[] => {
  if (!Array.isArray(value)) throw new Error("Answer suite must be an array.");
  return value.map((candidate) => {
    const record = assertRecord(candidate, "answer case");
    const output = assertRecord(record.output, "answer output");
    return {
      id: assertString(record.id, "answer case id"),
      split: assertString(
        record.split,
        "answer split",
      ) as BrainAnswerCase["split"],
      labels: assertLabels(record.labels),
      kind: assertString(record.kind, "answer kind") as BrainAnswerCase["kind"],
      output: {
        claimEntailed: output.claimEntailed === true,
        citationLocatorResolved: output.citationLocatorResolved === true,
        redactionMarker: output.redactionMarker === true,
        abstained: output.abstained === true,
        inventedSource: output.inventedSource === true,
      },
    };
  });
};

export const evaluateBrainAnswers = (
  suiteFixture: unknown,
): BrainEvalSuiteResult => {
  const suite = assertRecord(suiteFixture, "answers fixture");
  const cases = parseBrainAnswerCases(suite.cases);
  const testCases = cases.filter((entry) => entry.split === "test");
  const claimCases = testCases.filter((entry) => entry.kind === "claim");
  const noEvidenceCases = testCases.filter(
    (entry) => entry.kind === "no-evidence",
  );
  const failures: BrainEvalFailure[] = [];

  const entailed = claimCases.filter((entry) => {
    const passed =
      reviewedLabelPassed(entry.labels) && entry.output.claimEntailed;
    if (!passed)
      failures.push({
        caseId: entry.id,
        message: "Answer claim must be entailed by cited exact revision.",
      });
    return passed;
  }).length;
  const locators = testCases.filter((entry) => {
    const passed =
      entry.output.citationLocatorResolved || entry.output.redactionMarker;
    if (!passed)
      failures.push({
        caseId: entry.id,
        message:
          "Answer citation locator must resolve or return explicit redaction.",
      });
    return passed;
  }).length;
  const abstentions = noEvidenceCases.filter((entry) => {
    const passed = entry.output.abstained && !entry.output.inventedSource;
    if (!passed)
      failures.push({
        caseId: entry.id,
        message: "No-evidence answer must abstain without invented sources.",
      });
    return passed;
  }).length;

  const receipt = buildReceipt({
    suiteVersion: assertString(suite.suiteVersion, "answers suite version"),
    fixture: suiteFixture,
    modelId: assertString(suite.modelId, "answers model id"),
    promptVersion: assertString(suite.promptVersion, "answers prompt version"),
    toolSchemaVersion: assertString(
      suite.toolSchemaVersion,
      "answers tool schema version",
    ),
    totals: { cases: cases.length, testCases: testCases.length },
    metrics: {
      entailment: metric(entailed, claimCases.length, 0.95),
      locatorResolution: metric(locators, testCases.length, 1),
      noEvidenceAbstention: metric(abstentions, noEvidenceCases.length, 0.95),
    },
    failures,
  });

  return {
    suiteName: "answers",
    receipt,
    status: receipt.passed ? "approved" : "rejected",
  };
};
