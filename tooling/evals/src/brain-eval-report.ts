import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateBrainAnswers } from "./brain-answers";
import { evaluateBrainClassification } from "./brain-classification";
import { evaluateBrainMaintenance } from "./brain-maintenance";
import { evaluateBrainMultilingual } from "./brain-multilingual";
import { evaluateBrainPromptInjection } from "./brain-prompt-injection";

export type BrainEvalSplit = "train" | "dev" | "test";

export type ReviewerLabels = {
  readonly reviewerA: string;
  readonly reviewerB: string;
  readonly adjudicated: string;
};

export type BrainEvalCaseBase = {
  readonly id: string;
  readonly split: BrainEvalSplit;
  readonly labels: ReviewerLabels;
};

export type BrainEvalFailure = {
  readonly caseId: string;
  readonly message: string;
};

export type BrainEvalMetric = {
  readonly numerator: number;
  readonly denominator: number;
  readonly wilsonLower95: number;
  readonly threshold: number;
  readonly passed: boolean;
};

export type BrainEvalReceipt = {
  readonly suiteVersion: string;
  readonly fixtureHash: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly toolSchemaVersion: string;
  readonly totals: Record<string, number>;
  readonly metrics: Record<string, BrainEvalMetric>;
  readonly failures: readonly BrainEvalFailure[];
  readonly passed: boolean;
};

export type ModelPromptStatus =
  "candidate" | "evaluated" | "approved" | "rejected";

export type BrainEvalSuiteResult = {
  readonly suiteName: string;
  readonly receipt: BrainEvalReceipt;
  readonly status: ModelPromptStatus;
};

export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
};

export const sha256 = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export const wilsonLowerBound95 = (
  numerator: number,
  denominator: number,
): number => {
  if (denominator === 0) {
    return 0;
  }
  const z = 1.959963984540054;
  const phat = numerator / denominator;
  const z2 = z * z;
  return (
    (phat +
      z2 / (2 * denominator) -
      z *
        Math.sqrt((phat * (1 - phat) + z2 / (4 * denominator)) / denominator)) /
    (1 + z2 / denominator)
  );
};

export const metric = (
  numerator: number,
  denominator: number,
  threshold: number,
): BrainEvalMetric => {
  const wilsonLower95 = wilsonLowerBound95(numerator, denominator);
  return {
    numerator,
    denominator,
    wilsonLower95,
    threshold,
    passed:
      denominator > 0 &&
      (threshold === 1
        ? numerator === denominator
        : wilsonLower95 >= threshold),
  };
};

export const buildReceipt = (args: {
  readonly suiteVersion: string;
  readonly fixture: unknown;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly toolSchemaVersion: string;
  readonly totals: Record<string, number>;
  readonly metrics: Record<string, BrainEvalMetric>;
  readonly failures: readonly BrainEvalFailure[];
}): BrainEvalReceipt => {
  const metricsPassed = Object.values(args.metrics).every(
    (entry) => entry.passed,
  );
  return {
    suiteVersion: args.suiteVersion,
    fixtureHash: sha256(args.fixture),
    modelId: args.modelId,
    promptVersion: args.promptVersion,
    toolSchemaVersion: args.toolSchemaVersion,
    totals: args.totals,
    metrics: args.metrics,
    failures: args.failures,
    passed: metricsPassed && args.failures.length === 0,
  };
};

export const reviewedLabelPassed = (labels: ReviewerLabels): boolean =>
  labels.reviewerA === labels.reviewerB &&
  labels.reviewerA === labels.adjudicated;

export const assertRecord = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
};

export const assertString = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
};

export const assertNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
};

export const assertStringArray = (
  value: unknown,
  label: string,
): readonly string[] => {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${label} must be a string array.`);
  }
  return value;
};

export const assertLabels = (value: unknown): ReviewerLabels => {
  const labels = assertRecord(value, "labels");
  return {
    reviewerA: assertString(labels.reviewerA, "reviewer A label"),
    reviewerB: assertString(labels.reviewerB, "reviewer B label"),
    adjudicated: assertString(labels.adjudicated, "adjudicated label"),
  };
};

const fixturePath = fileURLToPath(
  new URL("../fixtures/maestro-brain/frozen-suite.json", import.meta.url),
);

export const loadFrozenBrainEvalFixture = (): unknown =>
  JSON.parse(readFileSync(fixturePath, "utf8"));

export const runFrozenBrainEvalSuites = (): readonly BrainEvalSuiteResult[] => {
  const fixture = loadFrozenBrainEvalFixture();
  const root = assertRecord(fixture, "Brain eval fixture");
  return [
    evaluateBrainClassification(root.classification),
    evaluateBrainAnswers(root.answers),
    evaluateBrainMaintenance(root.maintenance),
    evaluateBrainPromptInjection(root.promptInjection),
    evaluateBrainMultilingual(root.multilingual),
  ];
};

export const buildBrainEvalReport = () => {
  const suites = runFrozenBrainEvalSuites();
  return {
    generatedBy: "@maestro-template/evals brain:eval",
    fixtureHash: sha256(loadFrozenBrainEvalFixture()),
    suites,
    passed: suites.every(
      (suite) => suite.receipt.passed && suite.status === "approved",
    ),
  };
};

export const writeBrainEvalReport = (path: string): void => {
  writeFileSync(path, `${JSON.stringify(buildBrainEvalReport(), null, 2)}\n`);
};

export const checkFrozenBrainFixtures = (): BrainEvalReceipt => {
  const fixture = loadFrozenBrainEvalFixture();
  const root = assertRecord(fixture, "Brain eval fixture");
  const suites = [
    "classification",
    "answers",
    "maintenance",
    "promptInjection",
    "multilingual",
  ];
  const failures = suites.flatMap((suite) =>
    root[suite] === undefined
      ? [{ caseId: suite, message: "Suite fixture missing." }]
      : [],
  );
  return buildReceipt({
    suiteVersion: assertString(root.suiteVersion, "suite version"),
    fixture,
    modelId: assertString(root.modelId, "model id"),
    promptVersion: assertString(root.promptVersion, "prompt version"),
    toolSchemaVersion: assertString(
      root.toolSchemaVersion,
      "tool schema version",
    ),
    totals: { suites: suites.length },
    metrics: {
      fixtureCompleteness: metric(
        suites.length - failures.length,
        suites.length,
        1,
      ),
    },
    failures,
  });
};
