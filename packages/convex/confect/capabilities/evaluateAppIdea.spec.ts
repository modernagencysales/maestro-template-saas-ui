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

export const evaluateAppIdea = FunctionSpec.publicMutation({
  name: "evaluateAppIdea",
  args: () => evaluateAppIdeaArgs,
  returns: () => evaluateAppIdeaReturns,
  error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden),
});

export default GroupSpec.make().addFunction(evaluateAppIdea);
