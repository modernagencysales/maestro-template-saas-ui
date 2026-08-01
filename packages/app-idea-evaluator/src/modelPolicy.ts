export type ModelPolicy = {
  readonly tier: "free" | "premium";
  readonly modelEnv: "LLM_FREE_MODEL" | "LLM_PREMIUM_MODEL";
  readonly maxCalls: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxRepairAttempts: number;
  readonly maxSpendCents: number;
  readonly dailySpendEnv: "LLM_DAILY_SPEND_LIMIT_CENTS";
  readonly maxAnonymousEvaluationsPerSession: number;
  readonly maxEvaluationsPerVerifiedEmail: number;
  readonly allowResearch: boolean;
};

export type ModelUsage = {
  readonly callsUsed: number;
  readonly inputTokensUsed: number;
  readonly outputTokensUsed: number;
  readonly repairAttemptsUsed: number;
  readonly spentCents: number;
};

export type ModelPolicyDenialReason =
  | "call-limit"
  | "input-token-limit"
  | "output-token-limit"
  | "repair-limit"
  | "evaluation-spend-limit";

export type ModelAuthorization =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: ModelPolicyDenialReason };

export const FREE_MODEL_POLICY: ModelPolicy = {
  tier: "free",
  modelEnv: "LLM_FREE_MODEL",
  maxCalls: 5,
  maxInputTokens: 12_000,
  maxOutputTokens: 3_000,
  maxRepairAttempts: 1,
  maxSpendCents: 15,
  dailySpendEnv: "LLM_DAILY_SPEND_LIMIT_CENTS",
  maxAnonymousEvaluationsPerSession: 1,
  maxEvaluationsPerVerifiedEmail: 3,
  allowResearch: false,
};

export const PREMIUM_MODEL_POLICY: ModelPolicy = {
  tier: "premium",
  modelEnv: "LLM_PREMIUM_MODEL",
  maxCalls: 24,
  maxInputTokens: 120_000,
  maxOutputTokens: 40_000,
  maxRepairAttempts: 8,
  maxSpendCents: 1_000,
  dailySpendEnv: "LLM_DAILY_SPEND_LIMIT_CENTS",
  maxAnonymousEvaluationsPerSession: 0,
  maxEvaluationsPerVerifiedEmail: 24,
  allowResearch: true,
};

export type FreeEvaluationAllowance = {
  readonly sessionEvaluations: number;
  readonly verifiedEmailEvaluations?: number;
};

export const authorizeFreeEvaluationStart = (
  allowance: FreeEvaluationAllowance,
):
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: "session-limit" | "email-limit";
    } => {
  if (
    allowance.sessionEvaluations >=
    FREE_MODEL_POLICY.maxAnonymousEvaluationsPerSession
  )
    return { allowed: false, reason: "session-limit" };
  if (
    allowance.verifiedEmailEvaluations !== undefined &&
    allowance.verifiedEmailEvaluations >=
      FREE_MODEL_POLICY.maxEvaluationsPerVerifiedEmail
  )
    return { allowed: false, reason: "email-limit" };
  return { allowed: true };
};

export const authorizeModelCall = (
  policy: ModelPolicy,
  usage: ModelUsage,
): ModelAuthorization => {
  if (usage.callsUsed >= policy.maxCalls) {
    return { allowed: false, reason: "call-limit" };
  }
  if (usage.inputTokensUsed >= policy.maxInputTokens) {
    return { allowed: false, reason: "input-token-limit" };
  }
  if (usage.outputTokensUsed >= policy.maxOutputTokens) {
    return { allowed: false, reason: "output-token-limit" };
  }
  if (usage.repairAttemptsUsed >= policy.maxRepairAttempts) {
    return { allowed: false, reason: "repair-limit" };
  }
  if (usage.spentCents >= policy.maxSpendCents) {
    return { allowed: false, reason: "evaluation-spend-limit" };
  }
  return { allowed: true };
};
