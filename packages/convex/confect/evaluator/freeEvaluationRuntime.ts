import {
  FREE_MODEL_POLICY,
  FreeAgentPolicyError,
  composeFreeAgentReport,
  runBoundedFreeAgent,
  type BuildabilityReport,
  type EvaluationInput,
  type ModelUsage,
} from "@maestro-template/app-idea-evaluator";
import {
  calculateLlmSpend,
  estimateConservativeTokenCount,
  type LlmGateway,
} from "@maestro-template/integrations";
import * as Effect from "effect/Effect";

export type FreeEvaluationReceiptProjection = {
  readonly receiptId: string;
  readonly provider: "openrouter";
  readonly mode: "fake" | "test" | "live";
  readonly model: string;
  readonly generatedAt: string;
  readonly repair: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCents: number;
};

export class FreeEvaluationRuntimeError extends Error {
  readonly _tag = "FreeEvaluationRuntimeError";

  constructor(
    readonly runtimeCause: unknown,
    readonly receipts: readonly FreeEvaluationReceiptProjection[],
  ) {
    super("The free evaluation model runtime did not complete.");
  }
}

const emptyUsage = (): ModelUsage => ({
  callsUsed: 0,
  inputTokensUsed: 0,
  outputTokensUsed: 0,
  repairAttemptsUsed: 0,
  spentCents: 0,
});

export const runFreeEvaluationWithGateway = async ({
  gateway,
  sessionId,
  input,
  deterministicReport,
  currentDailySpendCents,
}: {
  readonly gateway: LlmGateway;
  readonly sessionId: string;
  readonly input: EvaluationInput;
  readonly deterministicReport: BuildabilityReport;
  readonly currentDailySpendCents: number;
}): Promise<{
  readonly report: BuildabilityReport;
  readonly usage: ModelUsage;
  readonly receipts: readonly FreeEvaluationReceiptProjection[];
}> => {
  const receipts: FreeEvaluationReceiptProjection[] = [];
  let gatewayUsage = emptyUsage();

  let result: Awaited<ReturnType<typeof runBoundedFreeAgent>>;
  try {
    result = await runBoundedFreeAgent({
      input,
      complete: async ({ prompt, repair }) => {
        const remainingInputTokens =
          FREE_MODEL_POLICY.maxInputTokens - gatewayUsage.inputTokensUsed;
        const remainingOutputTokens =
          FREE_MODEL_POLICY.maxOutputTokens - gatewayUsage.outputTokensUsed;
        const conservativeSpend = calculateLlmSpend({
          promptTokens: estimateConservativeTokenCount(prompt),
          completionTokens: remainingOutputTokens,
          inputCentsPerMillionTokens: 20,
          outputCentsPerMillionTokens: 40,
          minimumCents: 1,
        }).estimatedCents;
        if (
          gatewayUsage.spentCents + conservativeSpend >
          FREE_MODEL_POLICY.maxSpendCents
        ) {
          throw new FreeAgentPolicyError("evaluation-spend-limit");
        }

        const receiptId = `free-${sessionId}-call-${String(gatewayUsage.callsUsed + 1)}`;
        const completion = await Effect.runPromise(
          gateway.complete({
            workspaceSlug: "public-idea-funnel",
            prompt,
            modelEnv: FREE_MODEL_POLICY.modelEnv,
            limits: {
              maxInputTokens: remainingInputTokens,
              maxOutputTokens: remainingOutputTokens,
            },
            idempotencyKey: receiptId,
            currentDailySpendCents:
              currentDailySpendCents + gatewayUsage.spentCents,
          }),
        );
        const projection: FreeEvaluationReceiptProjection = {
          receiptId,
          provider: completion.provider,
          mode: completion.mode,
          model: completion.model,
          generatedAt: completion.receipt.generatedAt,
          repair,
          inputTokens: completion.usage.promptTokens,
          outputTokens: completion.usage.completionTokens,
          estimatedCents: completion.usage.estimatedCents,
        };
        receipts.push(projection);
        gatewayUsage = {
          callsUsed: gatewayUsage.callsUsed + 1,
          inputTokensUsed:
            gatewayUsage.inputTokensUsed + completion.usage.promptTokens,
          outputTokensUsed:
            gatewayUsage.outputTokensUsed + completion.usage.completionTokens,
          repairAttemptsUsed:
            gatewayUsage.repairAttemptsUsed + (repair ? 1 : 0),
          spentCents: gatewayUsage.spentCents + completion.usage.estimatedCents,
        };
        return {
          text: completion.text,
          inputTokens: completion.usage.promptTokens,
          outputTokens: completion.usage.completionTokens,
          spentCents: completion.usage.estimatedCents,
          receiptId,
        };
      },
    });
  } catch (cause) {
    throw new FreeEvaluationRuntimeError(cause, receipts);
  }

  return {
    report: composeFreeAgentReport(deterministicReport, result.output),
    usage: result.usage,
    receipts,
  };
};
