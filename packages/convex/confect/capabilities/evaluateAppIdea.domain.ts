export const evaluationAnswerIds = [
  "ideaSummary",
  "customer",
  "problem",
  "currentAlternative",
  "solution",
  "differentiation",
  "distributionEvidence",
  "founderContext",
] as const;

export type EvaluationAnswers = Record<
  (typeof evaluationAnswerIds)[number],
  string
>;

export type EvaluateAppIdeaInput = {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly answers: EvaluationAnswers;
};

export const normalizeEvaluateAppIdeaInput = (
  input: EvaluateAppIdeaInput,
): EvaluateAppIdeaInput => ({
  sessionId: input.sessionId.trim(),
  accessToken: input.accessToken.trim(),
  answers: Object.fromEntries(
    evaluationAnswerIds.map((id) => [id, input.answers[id].trim()]),
  ) as EvaluationAnswers,
});

export const validateEvaluateAppIdeaInput = (
  input: EvaluateAppIdeaInput,
): readonly string[] => {
  const errors: string[] = [];
  if (!input.sessionId.trim()) errors.push("sessionId must not be blank.");
  if (!input.accessToken.trim()) errors.push("accessToken must not be blank.");
  for (const id of evaluationAnswerIds) {
    if (!input.answers[id].trim()) errors.push(`${id} must not be blank.`);
  }
  return errors;
};
