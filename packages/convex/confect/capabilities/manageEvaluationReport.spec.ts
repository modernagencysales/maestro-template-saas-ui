import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import {
  ConfigInvalid,
  Forbidden,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";

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

export const requestReportEmailVerificationArgs = Schema.Struct({
  reportId: Schema.String,
  accessToken: Schema.String,
  email: Schema.String,
});
export const requestReportEmailVerificationReturns = Schema.Struct({
  status: Schema.Literal("verification-sent"),
  challengeId: Schema.String,
  fakeVerificationUrl: Schema.optional(Schema.String),
});

export const consumeReportEmailVerificationArgs = Schema.Struct({
  verificationToken: Schema.String,
});
export const consumeReportEmailVerificationReturns = Schema.Struct({
  status: Schema.Literal("claimed"),
  reportId: Schema.String,
  ownerAccessToken: Schema.String,
});

export const listOwnedEvaluationReportsArgs = Schema.Struct({
  ownerAccessToken: Schema.String,
});
export const listOwnedEvaluationReportsReturns = Schema.Array(
  Schema.Struct({
    reportId: Schema.String,
    currentVersion: Schema.Number,
    verdict: Schema.String,
    overallScore: Schema.Number,
    updatedAt: Schema.Number,
  }),
);

const errors = Schema.Union(
  Unauthorized,
  ValidationFailed,
  Forbidden,
  NotFound,
  ConfigInvalid,
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

export const requestReportEmailVerification = FunctionSpec.publicMutation({
  name: "requestReportEmailVerification",
  args: () => requestReportEmailVerificationArgs,
  returns: () => requestReportEmailVerificationReturns,
  error: () => errors,
});

export const consumeReportEmailVerification = FunctionSpec.publicMutation({
  name: "consumeReportEmailVerification",
  args: () => consumeReportEmailVerificationArgs,
  returns: () => consumeReportEmailVerificationReturns,
  error: () => errors,
});

export const listOwnedEvaluationReports = FunctionSpec.publicQuery({
  name: "listOwnedEvaluationReports",
  args: () => listOwnedEvaluationReportsArgs,
  returns: () => listOwnedEvaluationReportsReturns,
  error: () => Schema.Union(Unauthorized, ValidationFailed),
});

export default GroupSpec.make()
  .addFunction(manageEvaluationReport)
  .addFunction(getSharedEvaluationReport)
  .addFunction(requestReportEmailVerification)
  .addFunction(consumeReportEmailVerification)
  .addFunction(listOwnedEvaluationReports);
