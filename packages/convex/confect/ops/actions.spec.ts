import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

const NonEmptyString = S.String.pipe(S.check(S.isMinLength(1)));
const NonNegativeNumber = S.Number.pipe(S.check(S.isGreaterThanOrEqualTo(0)));
const TargetKind = S.Literals(["email", "crm", "webhook", "notion", "api"]);
const JobStatus = S.Literals([
  "queued",
  "waiting_for_approval",
  "published",
  "failed",
]);
const ApprovalStatus = S.Literals([
  "pending",
  "approved",
  "rejected",
  "expired",
]);
const ReviewScope = S.Literals(["action:approve", "action:review"]);
const TriggerKind = S.Literals(["refresh", "publish", "sync"]);

export const EnqueueActionArgs = S.Struct({
  workspaceId: NonEmptyString,
  workflowRunId: NonEmptyString,
  capabilityId: NonEmptyString,
  targetKind: TargetKind,
  targetRef: NonEmptyString,
  payloadHash: NonEmptyString,
  approvalPolicyId: S.optional(NonEmptyString),
  safeModeExemptionReason: S.optional(NonEmptyString),
});

export const ApproveActionArgs = S.Struct({
  workspaceId: NonEmptyString,
  approvalId: NonEmptyString,
  reviewerId: NonEmptyString,
  rawToken: NonEmptyString,
  now: NonNegativeNumber,
});

export const ConfigureTriggerArgs = S.Struct({
  workspaceId: NonEmptyString,
  triggerId: NonEmptyString,
  actionKind: TriggerKind,
  schedule: NonEmptyString,
  capabilityId: NonEmptyString,
  configHash: NonEmptyString,
  enabled: S.Boolean,
});

export const SendDigestArgs = S.Struct({
  workspaceId: NonEmptyString,
  recipientId: NonEmptyString,
  periodStart: NonNegativeNumber,
  periodEnd: NonNegativeNumber,
  jobsQueued: NonNegativeNumber,
  approvalsWaiting: NonNegativeNumber,
  actionsPublished: NonNegativeNumber,
});

export const ActionJobReturn = S.Struct({
  jobId: S.String,
  workspaceId: S.String,
  workflowRunId: S.String,
  capabilityId: S.String,
  targetKind: TargetKind,
  targetRef: S.String,
  payloadHash: S.String,
  approvalPolicyId: S.optional(S.String),
  safeModeExemptionReason: S.optional(S.String),
  status: JobStatus,
  createdAt: S.Number,
});

export const ActionApprovalReturn = S.Struct({
  approvalId: S.String,
  workspaceId: S.String,
  jobId: S.String,
  reviewerId: S.String,
  tokenHash: S.String,
  scope: ReviewScope,
  status: ApprovalStatus,
  expiresAt: S.Number,
  createdAt: S.Number,
  reviewedAt: S.optional(S.Number),
});

export const ActionTriggerReturn = S.Struct({
  triggerId: S.String,
  workspaceId: S.String,
  actionKind: TriggerKind,
  schedule: S.String,
  capabilityId: S.String,
  configHash: S.String,
  enabled: S.Boolean,
  idempotencyKey: S.String,
  createdAt: S.Number,
});

export const ActionDigestMetadataReturn = S.Struct({
  providerMetadata: S.Literal("[redacted]"),
  customerMetadata: S.Literal("[redacted]"),
});

export const ActionDigestReturn = S.Struct({
  digestId: S.String,
  workspaceId: S.String,
  recipientId: S.String,
  subject: S.String,
  body: S.String,
  dedupeKey: S.String,
  metadata: ActionDigestMetadataReturn,
  createdAt: S.Number,
  sentAt: S.optional(S.Number),
});

export namespace ActionError {
  export class ApprovalRequired extends S.TaggedErrorClass<ApprovalRequired>()(
    "ApprovalRequired",
    {
      jobId: S.String,
    },
  ) {}

  export class TokenExpired extends S.TaggedErrorClass<TokenExpired>()(
    "TokenExpired",
    {
      approvalId: S.String,
    },
  ) {}

  export class Unauthorized extends S.TaggedErrorClass<Unauthorized>()(
    "Unauthorized",
    {
      reason: S.String,
    },
  ) {}

  export class ValidationFailed extends S.TaggedErrorClass<ValidationFailed>()(
    "ValidationFailed",
    {
      field: S.String,
      message: S.String,
    },
  ) {}

  export const Schema = S.Union([
    ApprovalRequired,
    TokenExpired,
    Unauthorized,
    ValidationFailed,
  ]);
}

const enqueueAction = FunctionSpec.publicMutation({
  name: "enqueueAction",
  args: () => EnqueueActionArgs,
  returns: () => ActionJobReturn,
  error: () => ActionError.Schema,
});

const approveAction = FunctionSpec.publicMutation({
  name: "approveAction",
  args: () => ApproveActionArgs,
  returns: () => ActionApprovalReturn,
  error: () => ActionError.Schema,
});

const configureTrigger = FunctionSpec.publicMutation({
  name: "configureTrigger",
  args: () => ConfigureTriggerArgs,
  returns: () => ActionTriggerReturn,
  error: () => ActionError.Schema,
});

const sendDigest = FunctionSpec.publicMutation({
  name: "sendDigest",
  args: () => SendDigestArgs,
  returns: () => ActionDigestReturn,
  error: () => ActionError.Schema,
});

export default GroupSpec.make()
  .addFunction(enqueueAction)
  .addFunction(approveAction)
  .addFunction(configureTrigger)
  .addFunction(sendDigest);
