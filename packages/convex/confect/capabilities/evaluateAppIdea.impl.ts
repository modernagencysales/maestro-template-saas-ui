import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  buildFreeReport,
  decodeBuildabilityReport,
  scoreEvaluation,
  type BuildabilityReport,
  type DimensionKey,
  type EvaluationEvidence,
  type EvaluationInput,
} from "@maestro-template/app-idea-evaluator";
import { createLlmGateway } from "@maestro-template/integrations";
import * as Clock from "effect/Clock";
import * as Either from "effect/Either";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "../_generated/services";
import { Forbidden, Unauthorized, ValidationFailed } from "../errors";
import { sha256Hex } from "../shared/sha256";
import {
  evaluationAnswerIds,
  normalizeEvaluateAppIdeaInput,
  validateEvaluateAppIdeaInput,
  type EvaluationAnswers,
} from "./evaluateAppIdea.domain";
import evaluateAppIdeaGroup from "./evaluateAppIdea.spec";
import { loadLlmGatewayEnvConfig, RuntimeModeConfig } from "../shared/config";
import {
  FreeEvaluationRuntimeError,
  runFreeEvaluationWithGateway,
} from "../evaluator/freeEvaluationRuntime";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const evidenceDimensions: Readonly<
  Record<(typeof evaluationAnswerIds)[number], readonly DimensionKey[]>
> = {
  ideaSummary: ["solutionClarity", "monetization"],
  customer: ["customerSpecificity"],
  problem: ["problemSeverity", "problemFrequency"],
  currentAlternative: ["existingEffortOrSpend"],
  solution: ["solutionClarity", "feasibility", "operationalRisk", "maestroFit"],
  differentiation: ["differentiation"],
  distributionEvidence: ["distribution"],
  founderContext: ["founderAdvantage"],
};

const evidenceStrength = (value: string): number =>
  Math.min(0.92, 0.42 + value.length / 240);

const buildEvaluationArtifacts = (
  answers: EvaluationAnswers,
): {
  readonly input: EvaluationInput;
  readonly report: BuildabilityReport;
} => {
  const evidence: EvaluationEvidence[] = evaluationAnswerIds.flatMap(
    (answerId) =>
      evidenceDimensions[answerId].map((dimension) => ({
        answerId,
        dimension,
        strength: evidenceStrength(answers[answerId]),
      })),
  );
  const input: EvaluationInput = {
    ideaName: answers.ideaSummary.slice(0, 80),
    ideaSummary: answers.ideaSummary,
    customer: answers.customer,
    problem: answers.problem,
    currentAlternative: answers.currentAlternative,
    solution: answers.solution,
    differentiation: answers.differentiation,
    revenueModel: "Not established yet",
    founderAdvantage: answers.founderContext,
    constraints: [],
    distributionEvidence: [answers.distributionEvidence],
    evidence,
  };
  return { input, report: buildFreeReport(scoreEvaluation(input)) };
};

const evaluateAppIdeaImpl = FunctionImpl.make(
  databaseSchema,
  evaluateAppIdeaGroup,
  "evaluateAppIdea",
  (rawInput) =>
    Effect.gen(function* () {
      const input = normalizeEvaluateAppIdeaInput(rawInput);
      const errors = validateEvaluateAppIdeaInput(input);
      if (errors.length > 0) {
        return yield* new ValidationFailed({
          field: "answers",
          message: errors.join(" "),
        });
      }

      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const accessTokenHash = sha256Hex(input.accessToken);
      const existingSession = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", input.sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);

      if (
        existingSession !== null &&
        existingSession.accessTokenHash !== accessTokenHash
      ) {
        return yield* new Unauthorized();
      }

      const existingReport = yield* reader
        .table("evaluationReports")
        .index("by_session", (q) => q.eq("sessionId", input.sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existingReport !== null) {
        return {
          status: "completed" as const,
          evaluationId: `evaluation_${sha256Hex(input.sessionId).slice(0, 20)}`,
          reportId: existingReport.reportId,
          version: existingReport.currentVersion,
        };
      }

      if (existingSession === null) {
        yield* writer
          .table("evaluationSessions")
          .insert({
            sessionId: input.sessionId,
            accessTokenHash,
            status: "evaluating",
            createdAt: now,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      } else {
        yield* writer
          .table("evaluationSessions")
          .patch(existingSession._id, {
            status: "evaluating",
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }

      for (const questionId of evaluationAnswerIds) {
        const saved = yield* reader
          .table("evaluationAnswers")
          .index("by_session_question", (q) =>
            q.eq("sessionId", input.sessionId).eq("questionId", questionId),
          )
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        const row = {
          sessionId: input.sessionId,
          questionId,
          value: input.answers[questionId],
          savedAt: now,
        };
        if (saved === null)
          yield* writer
            .table("evaluationAnswers")
            .insert(row)
            .pipe(Effect.orDie);
        else
          yield* writer
            .table("evaluationAnswers")
            .patch(saved._id, row)
            .pipe(Effect.orDie);
      }

      const { report } = buildEvaluationArtifacts(input.answers);
      const reportId = `report_${sha256Hex(input.sessionId).slice(0, 20)}`;
      const reportJson = JSON.stringify(report);
      yield* writer
        .table("evaluationReports")
        .insert({
          reportId,
          sessionId: input.sessionId,
          currentVersion: 1,
          verdict: report.verdict,
          overallScore: report.overallScore,
          createdAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("evaluationReportVersions")
        .insert({ reportId, version: 1, reportJson, createdAt: now })
        .pipe(Effect.orDie);

      const session =
        existingSession ??
        (yield* reader
          .table("evaluationSessions")
          .index("by_session", (q) => q.eq("sessionId", input.sessionId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie));
      if (session === null)
        return yield* new Forbidden({
          reason: "Evaluation session was not persisted.",
        });
      yield* writer
        .table("evaluationSessions")
        .patch(session._id, { status: "completed", updatedAt: now })
        .pipe(Effect.orDie);

      return {
        status: "completed" as const,
        evaluationId: `evaluation_${sha256Hex(input.sessionId).slice(0, 20)}`,
        reportId,
        version: 1,
      };
    }),
);

const getEvaluationModelContextImpl = FunctionImpl.make(
  databaseSchema,
  evaluateAppIdeaGroup,
  "getEvaluationModelContext",
  ({ sessionId, accessToken }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const session = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (session === null)
        return yield* new Forbidden({ reason: "Evaluation session missing." });
      if (session.accessTokenHash !== sha256Hex(accessToken))
        return yield* new Unauthorized();

      const receipts = yield* reader
        .table("modelReceipts")
        .index("by_session", (q) => q.eq("sessionId", sessionId))
        .collect()
        .pipe(Effect.orDie);
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const utcDayStart = now - (now % 86_400_000);
      const dailyReceipts = yield* reader
        .table("modelReceipts")
        .index("by_generated_at")
        .collect()
        .pipe(Effect.orDie);
      return {
        alreadyCompleted: receipts.some(
          (receipt) =>
            receipt.tier === "free" && receipt.stage === "free-report",
        ),
        currentDailySpendCents: dailyReceipts
          .filter((receipt) => receipt.generatedAt >= utcDayStart)
          .reduce((total, receipt) => total + receipt.estimatedCents, 0),
      };
    }),
);

const persistModelEvaluationImpl = FunctionImpl.make(
  databaseSchema,
  evaluateAppIdeaGroup,
  "persistModelEvaluation",
  ({ sessionId, accessToken, reportId, reportJson, receipts }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const session = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (session === null)
        return yield* new Forbidden({ reason: "Evaluation session missing." });
      if (session.accessTokenHash !== sha256Hex(accessToken))
        return yield* new Unauthorized();
      const storedReport = yield* reader
        .table("evaluationReports")
        .index("by_report", (q) => q.eq("reportId", reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (storedReport === null || storedReport.sessionId !== sessionId)
        return yield* new Forbidden({ reason: "Evaluation report mismatch." });

      let report: BuildabilityReport;
      try {
        report = decodeBuildabilityReport(JSON.parse(reportJson));
      } catch {
        return yield* new ValidationFailed({
          field: "reportJson",
          message: "Model-composed report is invalid.",
        });
      }
      const version = yield* reader
        .table("evaluationReportVersions")
        .index("by_report_version", (q) =>
          q.eq("reportId", reportId).eq("version", 1),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (version === null)
        return yield* new Forbidden({ reason: "Report version missing." });
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("evaluationReportVersions")
        .patch(version._id, { reportJson: JSON.stringify(report) })
        .pipe(Effect.orDie);
      yield* writer
        .table("evaluationReports")
        .patch(storedReport._id, {
          verdict: report.verdict,
          overallScore: report.overallScore,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      for (const receipt of receipts) {
        const existing = yield* reader
          .table("modelReceipts")
          .index("by_receipt", (q) => q.eq("receiptId", receipt.receiptId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (existing !== null) continue;
        const generatedAt = Date.parse(receipt.generatedAt);
        if (!Number.isFinite(generatedAt))
          return yield* new ValidationFailed({
            field: "receipts.generatedAt",
            message: "Model receipt time is invalid.",
          });
        yield* writer
          .table("modelReceipts")
          .insert({
            receiptId: receipt.receiptId,
            sessionId,
            reportId,
            tier: "free",
            stage: "free-report",
            provider: receipt.provider,
            mode: receipt.mode,
            model: receipt.model,
            repair: receipt.repair,
            inputTokens: receipt.inputTokens,
            outputTokens: receipt.outputTokens,
            estimatedCents: receipt.estimatedCents,
            generatedAt,
          })
          .pipe(Effect.orDie);
      }
      yield* writer
        .table("evaluationSessions")
        .patch(session._id, { status: "completed", updatedAt: now })
        .pipe(Effect.orDie);
      return {
        status: "completed" as const,
        evaluationId: `evaluation_${sha256Hex(sessionId).slice(0, 20)}`,
        reportId,
        version: 1,
      };
    }),
);

const failModelEvaluationImpl = FunctionImpl.make(
  databaseSchema,
  evaluateAppIdeaGroup,
  "failModelEvaluation",
  ({ sessionId, accessToken }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const session = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (session === null)
        return yield* new Forbidden({ reason: "Evaluation session missing." });
      if (session.accessTokenHash !== sha256Hex(accessToken))
        return yield* new Unauthorized();
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("evaluationSessions")
        .patch(session._id, { status: "failed-recoverable", updatedAt: now })
        .pipe(Effect.orDie);
      return { status: "failed-recoverable" as const };
    }),
);

const recordModelReceiptsImpl = FunctionImpl.make(
  databaseSchema,
  evaluateAppIdeaGroup,
  "recordModelReceipts",
  ({ sessionId, accessToken, reportId, receipts }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const session = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (session === null)
        return yield* new Forbidden({ reason: "Evaluation session missing." });
      if (session.accessTokenHash !== sha256Hex(accessToken))
        return yield* new Unauthorized();
      const storedReport = yield* reader
        .table("evaluationReports")
        .index("by_report", (q) => q.eq("reportId", reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (storedReport === null || storedReport.sessionId !== sessionId)
        return yield* new Forbidden({ reason: "Evaluation report mismatch." });
      for (const receipt of receipts) {
        const existing = yield* reader
          .table("modelReceipts")
          .index("by_receipt", (q) => q.eq("receiptId", receipt.receiptId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (existing !== null) continue;
        const generatedAt = Date.parse(receipt.generatedAt);
        if (!Number.isFinite(generatedAt))
          return yield* new ValidationFailed({
            field: "receipts.generatedAt",
            message: "Model receipt time is invalid.",
          });
        yield* writer
          .table("modelReceipts")
          .insert({
            receiptId: receipt.receiptId,
            sessionId,
            reportId,
            tier: "free",
            stage: "free-report",
            provider: receipt.provider,
            mode: receipt.mode,
            model: receipt.model,
            repair: receipt.repair,
            inputTokens: receipt.inputTokens,
            outputTokens: receipt.outputTokens,
            estimatedCents: receipt.estimatedCents,
            generatedAt,
          })
          .pipe(Effect.orDie);
      }
      return { status: "recorded" as const };
    }),
);

const evaluateAppIdeaWithModelImpl = FunctionImpl.make(
  databaseSchema,
  evaluateAppIdeaGroup,
  "evaluateAppIdeaWithModel",
  (rawInput) =>
    Effect.gen(function* () {
      const mutation = yield* MutationRunner;
      const query = yield* QueryRunner;
      const persisted = yield* mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        rawInput,
      ).pipe(
        Effect.catchTag(
          "ParseError",
          () => new Forbidden({ reason: "Evaluation request was invalid." }),
        ),
      );
      const context = yield* query(
        refs.internal.capabilities.evaluateAppIdea.getEvaluationModelContext,
        {
          sessionId: rawInput.sessionId,
          accessToken: rawInput.accessToken,
        },
      ).pipe(
        Effect.catchTag(
          "ParseError",
          () => new Forbidden({ reason: "Evaluation context was invalid." }),
        ),
      );
      if (context.alreadyCompleted) return persisted;

      const input = normalizeEvaluateAppIdeaInput(rawInput);
      const artifacts = buildEvaluationArtifacts(input.answers);
      const runtimeMode = yield* RuntimeModeConfig.pipe(Effect.orDie);
      const gatewayEnv = yield* loadLlmGatewayEnvConfig.pipe(Effect.orDie);
      const gateway = createLlmGateway({
        mode: runtimeMode,
        env: gatewayEnv,
        fakeCompletionText: () =>
          JSON.stringify({
            roast:
              "There is a useful idea here, but the riskiest assumption still needs customer evidence.",
            improvedIdea: `${input.answers.ideaSummary} for ${input.answers.customer}, starting with one measurable outcome.`,
            strongestSignal: input.answers.distributionEvidence,
            biggestRisk: input.answers.differentiation,
            nextTest:
              "Run five customer conversations and test the smallest manual version before writing code.",
          }),
      });
      const generated = yield* Effect.tryPromise({
        try: () =>
          runFreeEvaluationWithGateway({
            gateway,
            sessionId: input.sessionId,
            input: artifacts.input,
            deterministicReport: artifacts.report,
            currentDailySpendCents: context.currentDailySpendCents,
          }),
        catch: (error) => error,
      }).pipe(Effect.either);
      if (Either.isLeft(generated)) {
        if (
          generated.left instanceof FreeEvaluationRuntimeError &&
          generated.left.receipts.length > 0
        ) {
          yield* mutation(
            refs.internal.capabilities.evaluateAppIdea.recordModelReceipts,
            {
              sessionId: input.sessionId,
              accessToken: input.accessToken,
              reportId: persisted.reportId,
              receipts: generated.left.receipts,
            },
          ).pipe(Effect.orDie);
        }
        yield* mutation(
          refs.internal.capabilities.evaluateAppIdea.failModelEvaluation,
          { sessionId: input.sessionId, accessToken: input.accessToken },
        ).pipe(Effect.orDie);
        return yield* new Forbidden({
          reason:
            "The evaluator could not finish. Your answers are safe, so you can try again.",
        });
      }
      return yield* mutation(
        refs.internal.capabilities.evaluateAppIdea.persistModelEvaluation,
        {
          sessionId: input.sessionId,
          accessToken: input.accessToken,
          reportId: persisted.reportId,
          reportJson: JSON.stringify(generated.right.report),
          receipts: generated.right.receipts,
        },
      ).pipe(
        Effect.catchTag(
          "ParseError",
          () => new Forbidden({ reason: "Evaluation result was invalid." }),
        ),
      );
    }),
);

export default GroupImpl.make(databaseSchema, evaluateAppIdeaGroup).pipe(
  Layer.provide(evaluateAppIdeaImpl),
  Layer.provide(evaluateAppIdeaWithModelImpl),
  Layer.provide(getEvaluationModelContextImpl),
  Layer.provide(persistModelEvaluationImpl),
  Layer.provide(recordModelReceiptsImpl),
  Layer.provide(failModelEvaluationImpl),
  GroupImpl.finalize,
);
