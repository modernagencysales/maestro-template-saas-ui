import {
  buildFreeReport,
  scoreEvaluation,
  type BuildabilityReport,
  type DimensionKey,
  type EvaluationEvidence,
  type EvaluationInput,
  type EvaluationResult,
} from "@maestro-template/app-idea-evaluator";

import type { IntakeAnswers, IntakeQuestionId } from "./intake-state";

export type StoredEvaluation = {
  readonly id: string;
  readonly createdAt: string;
  readonly answers: Required<IntakeAnswers>;
  readonly result: EvaluationResult;
  readonly report: BuildabilityReport;
};

export const fixtureCompleteAnswers: Required<IntakeAnswers> = {
  ideaSummary: "ChairFill helps dental practices fill cancelled appointments.",
  customer: "Independent dental practices with two to ten locations.",
  problem: "Last-minute cancellations leave expensive chair time unused.",
  currentAlternative: "Receptionists call waitlisted patients one by one.",
  solution: "Rank and message suitable waitlist patients automatically.",
  differentiation:
    "Matches treatment type, travel time, and patient preferences.",
  distributionEvidence: "I know three practice owners willing to pilot it.",
  founderContext: "I managed operations for a five-location dental group.",
};

const answerStrength = (value: string): number =>
  Math.min(0.95, 0.48 + value.trim().length / 180);

const evidenceMap: Readonly<Record<DimensionKey, IntakeQuestionId>> = {
  customerSpecificity: "customer",
  problemSeverity: "problem",
  problemFrequency: "problem",
  existingEffortOrSpend: "currentAlternative",
  solutionClarity: "solution",
  differentiation: "differentiation",
  feasibility: "solution",
  distribution: "distributionEvidence",
  monetization: "customer",
  founderAdvantage: "founderContext",
  operationalRisk: "solution",
  maestroFit: "ideaSummary",
};

const stableHash = (value: string): string => {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
};

const requireAnswers = (answers: IntakeAnswers): Required<IntakeAnswers> => {
  const complete = {} as Record<IntakeQuestionId, string>;
  for (const key of Object.keys(fixtureCompleteAnswers) as IntakeQuestionId[]) {
    const value = answers[key]?.trim();
    if (!value) throw new Error(`Missing answer: ${key}`);
    complete[key] = value;
  }
  return complete as Required<IntakeAnswers>;
};

export const makeEvaluation = (
  answersInput: IntakeAnswers,
  now = new Date().toISOString(),
): StoredEvaluation => {
  const answers = requireAnswers(answersInput);
  const evidence: EvaluationEvidence[] = Object.entries(evidenceMap).map(
    ([dimension, answerId]) => ({
      answerId,
      dimension: dimension as DimensionKey,
      strength: answerStrength(answers[answerId]),
    }),
  );
  const input: EvaluationInput = {
    ideaName: answers.ideaSummary.split(/\s+/).slice(0, 3).join(" "),
    ideaSummary: answers.ideaSummary,
    customer: answers.customer,
    problem: answers.problem,
    currentAlternative: answers.currentAlternative,
    solution: answers.solution,
    differentiation: answers.differentiation,
    revenueModel: `A focused paid product for ${answers.customer}`,
    founderAdvantage: answers.founderContext,
    constraints: [],
    distributionEvidence: [answers.distributionEvidence],
    evidence,
  };
  const result = scoreEvaluation(input);
  return {
    id: `idea_${stableHash(`${JSON.stringify(answers)}:${now}`)}`,
    createdAt: now,
    answers,
    result,
    report: buildFreeReport(result),
  };
};
