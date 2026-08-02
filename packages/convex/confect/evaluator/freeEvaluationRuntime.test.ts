import {
  buildFreeReport,
  scoreEvaluation,
  type EvaluationInput,
} from "@maestro-template/app-idea-evaluator";
import {
  makeLlmCompletion,
  LlmDisabledError,
  type LlmCompletion,
  type LlmGateway,
  type LlmGatewayRequest,
} from "@maestro-template/integrations";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import {
  FreeEvaluationRuntimeError,
  runFreeEvaluationWithGateway,
} from "./freeEvaluationRuntime";

const evaluationInput: EvaluationInput = {
  ideaName: "ChairFill",
  ideaSummary: "Fill cancelled dental appointments from a waitlist.",
  customer: "Independent dental practices",
  problem: "Last-minute cancellations waste chair time.",
  currentAlternative: "Receptionists call patients manually.",
  solution: "Rank and message waitlisted patients automatically.",
  differentiation: "Matches treatment and travel preferences.",
  revenueModel: "Not established yet",
  founderAdvantage: "Managed a five-location dental group.",
  constraints: [],
  distributionEvidence: ["Three practice owners agreed to pilot."],
  evidence: [
    { answerId: "customer", dimension: "customerSpecificity", strength: 0.9 },
    { answerId: "problem", dimension: "problemSeverity", strength: 0.85 },
    { answerId: "problem", dimension: "problemFrequency", strength: 0.8 },
    {
      answerId: "currentAlternative",
      dimension: "existingEffortOrSpend",
      strength: 0.8,
    },
    { answerId: "solution", dimension: "solutionClarity", strength: 0.85 },
    {
      answerId: "differentiation",
      dimension: "differentiation",
      strength: 0.7,
    },
    { answerId: "solution", dimension: "feasibility", strength: 0.75 },
    {
      answerId: "distributionEvidence",
      dimension: "distribution",
      strength: 0.75,
    },
    { answerId: "ideaSummary", dimension: "monetization", strength: 0.55 },
    {
      answerId: "founderContext",
      dimension: "founderAdvantage",
      strength: 0.9,
    },
    { answerId: "solution", dimension: "operationalRisk", strength: 0.7 },
    { answerId: "solution", dimension: "maestroFit", strength: 0.8 },
  ],
};

const completion = (
  request: LlmGatewayRequest,
  text: string,
): LlmCompletion => {
  const result = makeLlmCompletion({
    mode: "fake",
    model: "cheap/free-model",
    workspaceSlug: request.workspaceSlug,
    text,
    usage: { promptTokens: 320, completionTokens: 140, estimatedCents: 2 },
    generatedAt: "2026-07-31T00:00:00.000Z",
    ...(request.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: request.idempotencyKey }),
  });
  if ("_tag" in result) throw result;
  return result;
};

describe("free evaluation model runtime", () => {
  it("composes bounded model prose and returns receipt projections", async () => {
    const requests: LlmGatewayRequest[] = [];
    const gateway: LlmGateway = {
      complete: (request) =>
        Effect.sync(() => {
          requests.push(request);
          return completion(
            request,
            JSON.stringify({
              roast: "Clear pain, but acquisition still needs proof.",
              improvedIdea:
                "Start with cancellation recovery for dental groups.",
              strongestSignal: "Three owners are ready to pilot.",
              biggestRisk: "The integration could dominate version one.",
              nextTest: "Run a manual recovery concierge with five practices.",
            }),
          );
        }),
    };
    const deterministicReport = buildFreeReport(
      scoreEvaluation(evaluationInput),
    );

    const result = await runFreeEvaluationWithGateway({
      gateway,
      sessionId: "session_1",
      input: evaluationInput,
      deterministicReport,
      currentDailySpendCents: 7,
    });

    expect(result.report.verdict).toBe(deterministicReport.verdict);
    expect(result.report.overallScore).toBe(deterministicReport.overallScore);
    expect(result.report.roast).toContain("acquisition");
    expect(result.usage).toEqual({
      callsUsed: 1,
      inputTokensUsed: 320,
      outputTokensUsed: 140,
      repairAttemptsUsed: 0,
      spentCents: 2,
    });
    expect(result.receipts).toEqual([
      expect.objectContaining({
        receiptId: "free-session_1-call-1",
        model: "cheap/free-model",
        repair: false,
        inputTokens: 320,
        outputTokens: 140,
        estimatedCents: 2,
      }),
    ]);
    expect(requests).toEqual([
      expect.objectContaining({
        modelEnv: "LLM_FREE_MODEL",
        currentDailySpendCents: 7,
        idempotencyKey: "free-session_1-call-1",
        limits: expect.objectContaining({ maxOutputTokens: 3_000 }),
      }),
    ]);
    expect(JSON.stringify(result.receipts)).not.toContain("ChairFill");
  });

  it("repairs malformed output once with cumulative remaining limits", async () => {
    const requests: LlmGatewayRequest[] = [];
    const gateway: LlmGateway = {
      complete: (request) =>
        Effect.sync(() => {
          requests.push(request);
          return completion(
            request,
            requests.length === 1
              ? "not valid json"
              : JSON.stringify({
                  roast: "Specific pain, still vague distribution.",
                  improvedIdea:
                    "Recover one kind of dental cancellation first.",
                  strongestSignal: "Practice owners agreed to test it.",
                  biggestRisk: "Integration scope.",
                  nextTest: "Run the workflow manually for one week.",
                }),
          );
        }),
    };
    const deterministicReport = buildFreeReport(
      scoreEvaluation(evaluationInput),
    );

    const result = await runFreeEvaluationWithGateway({
      gateway,
      sessionId: "session_repair",
      input: evaluationInput,
      deterministicReport,
      currentDailySpendCents: 0,
    });

    expect(requests).toHaveLength(2);
    expect(requests[1]?.limits).toEqual({
      maxInputTokens: 11_680,
      maxOutputTokens: 2_860,
    });
    expect(result.usage.repairAttemptsUsed).toBe(1);
    expect(result.receipts.map(({ repair }) => repair)).toEqual([false, true]);
  });

  it("retains completed-call receipts when a repair transport fails", async () => {
    let calls = 0;
    const gateway: LlmGateway = {
      complete: (request) => {
        calls += 1;
        return calls === 1
          ? Effect.succeed(completion(request, "not valid json"))
          : Effect.fail(new LlmDisabledError({ provider: "openrouter" }));
      },
    };
    const deterministicReport = buildFreeReport(
      scoreEvaluation(evaluationInput),
    );

    const error = await runFreeEvaluationWithGateway({
      gateway,
      sessionId: "session_failure",
      input: evaluationInput,
      deterministicReport,
      currentDailySpendCents: 0,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(FreeEvaluationRuntimeError);
    expect((error as FreeEvaluationRuntimeError).receipts).toEqual([
      expect.objectContaining({ receiptId: "free-session_failure-call-1" }),
    ]);
  });
});
