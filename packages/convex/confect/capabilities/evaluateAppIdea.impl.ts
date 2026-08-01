import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  buildFreeReport,
  scoreEvaluation,
  type DimensionKey,
  type EvaluationEvidence,
} from "@maestro-template/app-idea-evaluator";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { Forbidden, Unauthorized, ValidationFailed } from "../errors";
import { sha256Hex } from "../shared/sha256";
import {
  evaluationAnswerIds,
  normalizeEvaluateAppIdeaInput,
  validateEvaluateAppIdeaInput,
} from "./evaluateAppIdea.domain";
import evaluateAppIdeaGroup from "./evaluateAppIdea.spec";

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

      const evidence: EvaluationEvidence[] = evaluationAnswerIds.flatMap(
        (answerId) =>
          evidenceDimensions[answerId].map((dimension) => ({
            answerId,
            dimension,
            strength: evidenceStrength(input.answers[answerId]),
          })),
      );
      const result = scoreEvaluation({
        ideaName: input.answers.ideaSummary.slice(0, 80),
        ideaSummary: input.answers.ideaSummary,
        customer: input.answers.customer,
        problem: input.answers.problem,
        currentAlternative: input.answers.currentAlternative,
        solution: input.answers.solution,
        differentiation: input.answers.differentiation,
        revenueModel: "Not established yet",
        founderAdvantage: input.answers.founderContext,
        constraints: [],
        distributionEvidence: [input.answers.distributionEvidence],
        evidence,
      });
      const report = buildFreeReport(result);
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

export default GroupImpl.make(databaseSchema, evaluateAppIdeaGroup).pipe(
  Layer.provide(evaluateAppIdeaImpl),
  GroupImpl.finalize,
);
