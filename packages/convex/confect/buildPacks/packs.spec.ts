import { FunctionSpec, GroupSpec } from "@confect/core";
import { buildPackStageNames } from "@maestro-template/app-idea-evaluator";
import * as Schema from "effect/Schema";

import {
  ConfigInvalid,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";

const PackStatus = Schema.Literal(
  "running",
  "failed-recoverable",
  "needs-support",
  "completed",
  "revoked",
);
const StageStatus = Schema.Literal(
  "queued",
  "running",
  "completed",
  "failed-recoverable",
  "needs-support",
);
const Stage = Schema.Struct({
  name: Schema.Literal(...buildPackStageNames),
  status: StageStatus,
  attempts: Schema.Number,
  output: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});
const PackSummary = Schema.Struct({
  packId: Schema.String,
  reportId: Schema.String,
  reportVersion: Schema.Number,
  status: PackStatus,
  supportId: Schema.optional(Schema.String),
  stages: Schema.Array(Stage),
});
const OwnerArgs = Schema.Struct({
  packId: Schema.String,
  ownerAccessToken: Schema.String,
});
const PackErrors = Schema.Union(
  Unauthorized,
  ValidationFailed,
  NotFound,
  ConfigInvalid,
);

export const startPack = FunctionSpec.publicMutation({
  name: "startPack",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
    }),
  returns: () => PackSummary,
  error: () => PackErrors,
});

export const status = FunctionSpec.publicQuery({
  name: "status",
  args: () => OwnerArgs,
  returns: () => PackSummary,
  error: () => PackErrors,
});

export const retryFailedStage = FunctionSpec.publicMutation({
  name: "retryFailedStage",
  args: () => OwnerArgs,
  returns: () => PackSummary,
  error: () => PackErrors,
});

export const getPack = FunctionSpec.publicQuery({
  name: "getPack",
  args: () => OwnerArgs,
  returns: () =>
    Schema.Struct({
      packId: Schema.String,
      reportId: Schema.String,
      reportVersion: Schema.Number,
      canonicalPackJson: Schema.String,
    }),
  error: () => PackErrors,
});

export const runPack = FunctionSpec.internalAction({
  name: "runPack",
  args: () => Schema.Struct({ packId: Schema.String }),
  returns: () => PackSummary,
  error: () => Schema.Union(ValidationFailed, NotFound, ConfigInvalid),
});

export const loadPackRun = FunctionSpec.internalQuery({
  name: "loadPackRun",
  args: () => Schema.Struct({ packId: Schema.String }),
  returns: () =>
    Schema.Struct({
      runJson: Schema.String,
      reportJson: Schema.String,
      currentDailySpendCents: Schema.Number,
    }),
  error: () => Schema.Union(ValidationFailed, NotFound),
});

export const claimStage = FunctionSpec.internalMutation({
  name: "claimStage",
  args: () => Schema.Struct({ packId: Schema.String, leaseId: Schema.String }),
  returns: () =>
    Schema.Struct({
      claimed: Schema.Boolean,
      stage: Schema.optional(Schema.Literal(...buildPackStageNames)),
      attempt: Schema.optional(Schema.Number),
    }),
  error: () => Schema.Union(ValidationFailed, NotFound),
});

const Receipt = Schema.Struct({
  receiptId: Schema.String,
  stage: Schema.String,
  provider: Schema.String,
  mode: Schema.Literal("fake", "test", "live"),
  model: Schema.String,
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  estimatedCents: Schema.Number,
  generatedAt: Schema.Number,
});

export const persistCheckpoint = FunctionSpec.internalMutation({
  name: "persistCheckpoint",
  args: () =>
    Schema.Struct({
      packId: Schema.String,
      runJson: Schema.String,
      stage: Schema.optional(Schema.Literal(...buildPackStageNames)),
      leaseId: Schema.optional(Schema.String),
      receipt: Schema.optional(Receipt),
    }),
  returns: () => PackSummary,
  error: () => Schema.Union(ValidationFailed, NotFound),
});

export const finishPack = FunctionSpec.internalMutation({
  name: "finishPack",
  args: () =>
    Schema.Struct({
      packId: Schema.String,
      canonicalPackJson: Schema.String,
    }),
  returns: () => PackSummary,
  error: () => Schema.Union(ValidationFailed, NotFound),
});

export default GroupSpec.make()
  .addFunction(startPack)
  .addFunction(status)
  .addFunction(retryFailedStage)
  .addFunction(getPack)
  .addFunction(runPack)
  .addFunction(loadPackRun)
  .addFunction(claimStage)
  .addFunction(persistCheckpoint)
  .addFunction(finishPack);
