import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Forbidden, Unauthorized, ValidationFailed } from "../errors";

export const evaluationAnswersSchema = Schema.Struct({
  ideaSummary: Schema.String,
  customer: Schema.String,
  problem: Schema.String,
  currentAlternative: Schema.String,
  solution: Schema.String,
  differentiation: Schema.String,
  distributionEvidence: Schema.String,
  founderContext: Schema.String,
});

export const evaluateAppIdeaArgs = Schema.Struct({
  sessionId: Schema.String,
  accessToken: Schema.String,
  answers: evaluationAnswersSchema,
});

export const evaluateAppIdeaReturns = Schema.Struct({
  status: Schema.Literal("completed"),
  evaluationId: Schema.String,
  reportId: Schema.String,
  version: Schema.Number,
});

const nonNegativeNumber = Schema.Number.pipe(Schema.greaterThanOrEqualTo(0));

export const evaluateAppIdeaWithModelReturns = Schema.Union(
  Schema.Struct({
    ...evaluateAppIdeaReturns.fields,
    freshCompletion: Schema.Literal(false),
  }),
  Schema.Struct({
    ...evaluateAppIdeaReturns.fields,
    freshCompletion: Schema.Literal(true),
    durationMs: nonNegativeNumber,
    modelCalls: Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
    ),
    estimatedCostCents: nonNegativeNumber,
  }),
);

export const evaluateAppIdea = FunctionSpec.publicMutation({
  name: "evaluateAppIdea",
  args: () => evaluateAppIdeaArgs,
  returns: () => evaluateAppIdeaReturns,
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export const evaluateAppIdeaWithModel = FunctionSpec.publicAction({
  name: "evaluateAppIdeaWithModel",
  args: () => evaluateAppIdeaArgs,
  returns: () => evaluateAppIdeaWithModelReturns,
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export const getEvaluationModelContextArgs = Schema.Struct({
  sessionId: Schema.String,
  accessToken: Schema.String,
});

export const getEvaluationModelContextReturns = Schema.Struct({
  alreadyCompleted: Schema.Boolean,
  currentDailySpendCents: Schema.Number,
});

export const getEvaluationModelContext = FunctionSpec.internalQuery({
  name: "getEvaluationModelContext",
  args: () => getEvaluationModelContextArgs,
  returns: () => getEvaluationModelContextReturns,
  error: () => Schema.Union(Unauthorized, Forbidden),
});

export const modelReceiptProjectionSchema = Schema.Struct({
  receiptId: Schema.String,
  provider: Schema.Literal("openrouter"),
  mode: Schema.Literal("fake", "test", "live"),
  model: Schema.String,
  generatedAt: Schema.String,
  repair: Schema.Boolean,
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  estimatedCents: Schema.Number,
});

export const persistModelEvaluationArgs = Schema.Struct({
  sessionId: Schema.String,
  accessToken: Schema.String,
  reportId: Schema.String,
  reportJson: Schema.String,
  receipts: Schema.Array(modelReceiptProjectionSchema),
});

export const persistModelEvaluation = FunctionSpec.internalMutation({
  name: "persistModelEvaluation",
  args: () => persistModelEvaluationArgs,
  returns: () => evaluateAppIdeaReturns,
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export const recordModelReceiptsArgs = Schema.Struct({
  sessionId: Schema.String,
  accessToken: Schema.String,
  reportId: Schema.String,
  receipts: Schema.Array(modelReceiptProjectionSchema),
});

export const recordModelReceipts = FunctionSpec.internalMutation({
  name: "recordModelReceipts",
  args: () => recordModelReceiptsArgs,
  returns: () => Schema.Struct({ status: Schema.Literal("recorded") }),
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export const failModelEvaluation = FunctionSpec.internalMutation({
  name: "failModelEvaluation",
  args: () => getEvaluationModelContextArgs,
  returns: () =>
    Schema.Struct({ status: Schema.Literal("failed-recoverable") }),
  error: () => Schema.Union(Unauthorized, Forbidden),
});

export default GroupSpec.make()
  .addFunction(evaluateAppIdea)
  .addFunction(evaluateAppIdeaWithModel)
  .addFunction(getEvaluationModelContext)
  .addFunction(persistModelEvaluation)
  .addFunction(recordModelReceipts)
  .addFunction(failModelEvaluation);
