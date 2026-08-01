import { sha256Hex } from "../shared/sha256";

export const requiredEvaluationQuestionIds = [
  "ideaSummary",
  "customer",
  "problem",
  "currentAlternative",
  "solution",
  "differentiation",
  "distributionEvidence",
  "founderContext",
] as const;

export type EvaluationAnswer = {
  readonly questionId: string;
  readonly value: string;
  readonly savedAt: number;
};

export type EvaluationSession = {
  readonly sessionId: string;
  readonly accessTokenHash: string;
  readonly status: "collecting" | "ready-to-evaluate" | "completed";
  readonly answers: readonly EvaluationAnswer[];
  readonly createdAt: number;
  readonly completedAt?: number;
};

export const createEvaluationSession = (input: {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly createdAt: number;
}): EvaluationSession => ({
  sessionId: input.sessionId,
  accessTokenHash: sha256Hex(input.accessToken),
  status: "collecting",
  answers: [],
  createdAt: input.createdAt,
});

export const verifyEvaluationAccess = (
  session: EvaluationSession,
  accessToken: string,
): boolean => session.accessTokenHash === sha256Hex(accessToken);

export const appendAnswer = (
  session: EvaluationSession,
  answer: EvaluationAnswer,
): EvaluationSession => {
  const answers = [
    ...session.answers.filter(
      ({ questionId }) => questionId !== answer.questionId,
    ),
    { ...answer, value: answer.value.trim() },
  ];
  const ready = requiredEvaluationQuestionIds.every((questionId) =>
    answers.some(
      (answerValue) =>
        answerValue.questionId === questionId && answerValue.value.length > 0,
    ),
  );
  return {
    ...session,
    answers,
    status: ready ? "ready-to-evaluate" : "collecting",
  };
};

export const completeEvaluationSession = (
  session: EvaluationSession,
  completedAt: number,
): EvaluationSession => {
  if (session.status !== "ready-to-evaluate") {
    throw new Error("Cannot complete evaluation: missing required answers.");
  }
  return { ...session, status: "completed", completedAt };
};

export type EvaluationReportState = {
  readonly reportId: string;
  readonly currentVersion: number;
  readonly versions: readonly {
    readonly version: number;
    readonly reportJson: string;
    readonly createdAt: number;
  }[];
};

export const reviseEvaluationReport = (
  report: EvaluationReportState,
  revision: { readonly reportJson: string; readonly createdAt: number },
): EvaluationReportState => {
  const version = report.currentVersion + 1;
  return {
    ...report,
    currentVersion: version,
    versions: [...report.versions, { version, ...revision }],
  };
};
