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
  accessToken: Schema.optional(Schema.String),
  ownerAccessToken: Schema.optional(Schema.String),
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

export const getEvaluationReportArgs = Schema.Struct({
  reportId: Schema.String,
  accessToken: Schema.optional(Schema.String),
  ownerAccessToken: Schema.optional(Schema.String),
});
export const getEvaluationReportReturns = Schema.Struct({
  reportId: Schema.String,
  currentVersion: Schema.Number,
  reportJson: Schema.String,
  verdict: Schema.String,
  overallScore: Schema.Number,
  updatedAt: Schema.Number,
});

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

export const issueReportEmailVerificationReturns = Schema.Struct({
  status: Schema.Literal("verification-issued"),
  challengeId: Schema.String,
  reportId: Schema.String,
  email: Schema.String,
  verificationUrlPath: Schema.String,
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

const revisionReceipt = Schema.Struct({
  receiptId: Schema.String,
  provider: Schema.String,
  mode: Schema.Literal("fake", "test", "live"),
  model: Schema.String,
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  estimatedCents: Schema.Number,
  generatedAt: Schema.Number,
});

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

export const getEvaluationReport = FunctionSpec.publicQuery({
  name: "getEvaluationReport",
  args: () => getEvaluationReportArgs,
  returns: () => getEvaluationReportReturns,
  error: () => errors,
});

export const requestReportEmailVerification = FunctionSpec.publicAction({
  name: "requestReportEmailVerification",
  args: () => requestReportEmailVerificationArgs,
  returns: () => requestReportEmailVerificationReturns,
  error: () => errors,
});

export const issueReportEmailVerification = FunctionSpec.internalMutation({
  name: "issueReportEmailVerification",
  args: () => requestReportEmailVerificationArgs,
  returns: () => issueReportEmailVerificationReturns,
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

export const reviseEvaluationReportWithModel = FunctionSpec.publicAction({
  name: "reviseEvaluationReportWithModel",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
      feedback: Schema.String,
    }),
  returns: () => manageEvaluationReportReturns,
  error: () => errors,
});

export const getReportRevisionContext = FunctionSpec.internalQuery({
  name: "getReportRevisionContext",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
    }),
  returns: () =>
    Schema.Struct({
      reportId: Schema.String,
      sessionId: Schema.String,
      currentVersion: Schema.Number,
      currentReportJson: Schema.String,
      currentDailySpendCents: Schema.Number,
    }),
  error: () => errors,
});

export const persistGeneratedReportRevision = FunctionSpec.internalMutation({
  name: "persistGeneratedReportRevision",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
      expectedCurrentVersion: Schema.Number,
      reportJson: Schema.String,
      receipt: revisionReceipt,
    }),
  returns: () => manageEvaluationReportReturns,
  error: () => errors,
});

export const listEvaluationReportVersions = FunctionSpec.publicQuery({
  name: "listEvaluationReportVersions",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
    }),
  returns: () =>
    Schema.Array(
      Schema.Struct({
        version: Schema.Number,
        reportJson: Schema.String,
        createdAt: Schema.Number,
      }),
    ),
  error: () => errors,
});

export default GroupSpec.make()
  .addFunction(manageEvaluationReport)
  .addFunction(getSharedEvaluationReport)
  .addFunction(getEvaluationReport)
  .addFunction(requestReportEmailVerification)
  .addFunction(issueReportEmailVerification)
  .addFunction(consumeReportEmailVerification)
  .addFunction(listOwnedEvaluationReports)
  .addFunction(reviseEvaluationReportWithModel)
  .addFunction(getReportRevisionContext)
  .addFunction(persistGeneratedReportRevision)
  .addFunction(listEvaluationReportVersions);
