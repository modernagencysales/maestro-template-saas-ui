import { decodeFreeAgentOutput, type FreeAgentOutput } from "./agentOutput";
import {
  FREE_MODEL_POLICY,
  authorizeModelCall,
  type ModelPolicy,
  type ModelPolicyDenialReason,
  type ModelUsage,
} from "./modelPolicy";
import type { BuildabilityReport, EvaluationInput } from "./schemas";

export type FreeAgentRequest = {
  readonly policy: ModelPolicy;
  readonly maxCalls: 1;
  readonly prompt: string;
};

export const buildFreeAgentRequest = (
  input: EvaluationInput,
): FreeAgentRequest => ({
  policy: FREE_MODEL_POLICY,
  maxCalls: 1,
  prompt: [
    "Tell me if this app idea is good.",
    "Give a candid but constructive roast. Help a nontechnical founder know what it will take.",
    "Use only the founder's answers. Do not use external research, tools, or unsupported competitor claims.",
    "Return JSON with exactly: roast, improvedIdea, strongestSignal, biggestRisk, nextTest.",
    JSON.stringify({
      ideaName: input.ideaName,
      ideaSummary: input.ideaSummary,
      customer: input.customer,
      problem: input.problem,
      currentAlternative: input.currentAlternative,
      solution: input.solution,
      differentiation: input.differentiation,
      distributionEvidence: input.distributionEvidence,
      founderAdvantage: input.founderAdvantage,
    }),
  ].join("\n\n"),
});

export const decodeFreeAgentCompletion = (text: string): FreeAgentOutput =>
  decodeFreeAgentOutput(JSON.parse(text) as unknown);

export class FreeAgentPolicyError extends Error {
  readonly _tag = "FreeAgentPolicyError";

  constructor(readonly reason: ModelPolicyDenialReason) {
    super(`Free evaluation model policy denied the call: ${reason}.`);
  }
}

export class FreeAgentOutputError extends Error {
  readonly _tag = "FreeAgentOutputError";

  constructor() {
    super("The free evaluator returned invalid structured output twice.");
  }
}

export type FreeAgentTransportCompletion = {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly spentCents: number;
  readonly receiptId?: string;
};

export type FreeAgentTransport = (request: {
  readonly prompt: string;
  readonly maxOutputTokens: number;
  readonly repair: boolean;
}) => Promise<FreeAgentTransportCompletion>;

const emptyUsage = (): ModelUsage => ({
  callsUsed: 0,
  inputTokensUsed: 0,
  outputTokensUsed: 0,
  repairAttemptsUsed: 0,
  spentCents: 0,
});

const addCompletionUsage = (
  usage: ModelUsage,
  completion: FreeAgentTransportCompletion,
  repair: boolean,
): ModelUsage => ({
  callsUsed: usage.callsUsed + 1,
  inputTokensUsed: usage.inputTokensUsed + completion.inputTokens,
  outputTokensUsed: usage.outputTokensUsed + completion.outputTokens,
  repairAttemptsUsed: usage.repairAttemptsUsed + (repair ? 1 : 0),
  spentCents: usage.spentCents + completion.spentCents,
});

const authorizeOrThrow = (usage: ModelUsage): void => {
  const authorization = authorizeModelCall(FREE_MODEL_POLICY, usage);
  if (!authorization.allowed)
    throw new FreeAgentPolicyError(authorization.reason);
};

const assertUsageWithinPolicy = (usage: ModelUsage): void => {
  const limits: readonly [boolean, ModelPolicyDenialReason][] = [
    [usage.callsUsed > FREE_MODEL_POLICY.maxCalls, "call-limit"],
    [
      usage.inputTokensUsed > FREE_MODEL_POLICY.maxInputTokens,
      "input-token-limit",
    ],
    [
      usage.outputTokensUsed > FREE_MODEL_POLICY.maxOutputTokens,
      "output-token-limit",
    ],
    [
      usage.repairAttemptsUsed > FREE_MODEL_POLICY.maxRepairAttempts,
      "repair-limit",
    ],
    [
      usage.spentCents > FREE_MODEL_POLICY.maxSpendCents,
      "evaluation-spend-limit",
    ],
  ];
  const exceeded = limits.find(([denied]) => denied);
  if (exceeded) throw new FreeAgentPolicyError(exceeded[1]);
};

export const runBoundedFreeAgent = async (input: {
  readonly input: EvaluationInput;
  readonly complete: FreeAgentTransport;
  readonly usage?: ModelUsage;
}): Promise<{
  readonly output: FreeAgentOutput;
  readonly usage: ModelUsage;
  readonly receiptIds: readonly string[];
}> => {
  let usage = input.usage ?? emptyUsage();
  const receiptIds: string[] = [];
  const request = buildFreeAgentRequest(input.input);
  let prompt = request.prompt;

  for (
    let attempt = 0;
    attempt <= FREE_MODEL_POLICY.maxRepairAttempts;
    attempt += 1
  ) {
    const repair = attempt > 0;
    authorizeOrThrow(usage);
    const completion = await input.complete({
      prompt,
      maxOutputTokens: FREE_MODEL_POLICY.maxOutputTokens,
      repair,
    });
    usage = addCompletionUsage(usage, completion, repair);
    assertUsageWithinPolicy(usage);
    if (completion.receiptId) receiptIds.push(completion.receiptId);
    try {
      const output = decodeFreeAgentCompletion(completion.text);
      return { output, usage, receiptIds };
    } catch {
      if (repair || FREE_MODEL_POLICY.maxRepairAttempts === 0)
        throw new FreeAgentOutputError();
      prompt = [
        "Repair the response into valid JSON only.",
        "Use exactly these string fields: roast, improvedIdea, strongestSignal, biggestRisk, nextTest.",
        "Do not add markdown, commentary, research, or other fields.",
        completion.text.slice(0, 4_000),
      ].join("\n\n");
    }
  }

  throw new FreeAgentOutputError();
};

export const composeFreeAgentReport = (
  deterministicReport: BuildabilityReport,
  output: FreeAgentOutput,
): BuildabilityReport => ({
  ...deterministicReport,
  roast: output.roast,
  improvedIdea: output.improvedIdea,
  strongestElement: output.strongestSignal,
  biggestWeakness: output.biggestRisk,
  whatItWillTake: [
    output.nextTest,
    ...deterministicReport.whatItWillTake.slice(1),
  ],
});
