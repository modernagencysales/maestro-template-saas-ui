import { decodeFreeAgentOutput, type FreeAgentOutput } from "./agentOutput";
import { FREE_MODEL_POLICY, type ModelPolicy } from "./modelPolicy";
import type { EvaluationInput } from "./schemas";

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
