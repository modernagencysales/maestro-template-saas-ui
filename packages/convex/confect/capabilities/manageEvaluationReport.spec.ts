import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Forbidden, NotFound, Unauthorized, ValidationFailed } from "../errors";

export const manageEvaluationReportArgs = Schema.Struct({
  reportId: Schema.String,
  accessToken: Schema.String,
  action: Schema.Literal("revise", "share", "revoke-share", "claim", "delete"),
  revisionJson: Schema.optional(Schema.String),
});

export const manageEvaluationReportReturns = Schema.Struct({
  status: Schema.Literal("revised", "shared", "revoked", "claimed", "deleted"),
  reportId: Schema.String,
  version: Schema.Number,
  shareToken: Schema.optional(Schema.String),
});

export const getSharedEvaluationReportArgs = Schema.Struct({
  shareToken: Schema.String,
});

export const getSharedEvaluationReportReturns = Schema.NullOr(
  Schema.Struct({
    reportId: Schema.String,
    reportVersion: Schema.Number,
    publicSnapshotJson: Schema.String,
  }),
);

const errors = Schema.Union(
  Unauthorized,
  ValidationFailed,
  Forbidden,
  NotFound,
);

export const manageEvaluationReport = FunctionSpec.publicMutation({
  name: "manageEvaluationReport",
  args: () => manageEvaluationReportArgs,
  returns: () => manageEvaluationReportReturns,
  error: () => errors,
});

export const getSharedEvaluationReport = FunctionSpec.publicQuery({
  name: "getSharedEvaluationReport",
  args: () => getSharedEvaluationReportArgs,
  returns: () => getSharedEvaluationReportReturns,
  error: () => Schema.Union(ValidationFailed, NotFound),
});

export default GroupSpec.make()
  .addFunction(manageEvaluationReport)
  .addFunction(getSharedEvaluationReport);
