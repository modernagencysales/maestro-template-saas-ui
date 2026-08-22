import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

const NonEmptyString = S.String.pipe(S.check(S.isMinLength(1)));
const Causation = S.Literals([
  "human-edit",
  "agent-edit",
  "import",
  "migration",
  "reconcile",
  "restore",
]);
const FreshnessStatus = S.Literals(["fresh", "review-due", "stale"]);

export const AppendVersionArgs = S.Struct({
  workspaceId: NonEmptyString,
  entityKey: NonEmptyString,
  versionKey: NonEmptyString,
  priorVersionKey: S.optional(S.String),
  causation: Causation,
  actorId: NonEmptyString,
  payloadHash: NonEmptyString,
  payloadJson: NonEmptyString,
  idempotencyKey: NonEmptyString,
});

export const RestoreVersionArgs = S.Struct({
  workspaceId: NonEmptyString,
  entityKey: NonEmptyString,
  restoredFromVersionKey: NonEmptyString,
  versionKey: NonEmptyString,
  actorId: NonEmptyString,
  payloadHash: NonEmptyString,
  payloadJson: NonEmptyString,
  idempotencyKey: NonEmptyString,
});

export const ReconcileVersionArgs = S.Struct({
  workspaceId: NonEmptyString,
  entityKey: NonEmptyString,
  externalVersion: NonEmptyString,
  actorId: NonEmptyString,
  payloadHash: NonEmptyString,
  payloadJson: NonEmptyString,
  idempotencyKey: NonEmptyString,
});

export const MarkFreshnessArgs = S.Struct({
  workspaceId: NonEmptyString,
  entityKey: NonEmptyString,
  status: FreshnessStatus,
  reason: NonEmptyString,
  nextReviewAt: S.optional(S.Number),
});

export const LatestVersionArgs = S.Struct({
  workspaceId: NonEmptyString,
  entityKey: NonEmptyString,
});

export const VersionedEntryReturn = S.Struct({
  workspaceId: S.String,
  entityKey: S.String,
  versionKey: S.String,
  priorVersionKey: S.optional(S.String),
  restoredFromVersionKey: S.optional(S.String),
  externalVersion: S.optional(S.String),
  reconciliationKey: S.optional(S.String),
  causation: Causation,
  actorId: S.String,
  payloadHash: S.String,
  payloadJson: S.String,
  idempotencyKey: S.String,
  appendOnly: S.Boolean,
  createdAt: S.Number,
});

export const VersionFreshnessReturn = S.Struct({
  workspaceId: S.String,
  entityKey: S.String,
  status: FreshnessStatus,
  reason: S.String,
  checkedAt: S.Number,
  nextReviewAt: S.optional(S.Number),
  mutableFreshness: S.Boolean,
});

export namespace VersioningError {
  export class InvalidCausation extends S.TaggedErrorClass<InvalidCausation>()(
    "InvalidCausation",
    {
      causation: S.String,
    },
  ) {}

  export class VersionNotFound extends S.TaggedErrorClass<VersionNotFound>()(
    "VersionNotFound",
    {
      entityKey: S.String,
      versionKey: S.String,
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
    InvalidCausation,
    VersionNotFound,
    ValidationFailed,
  ]);
}

const append = FunctionSpec.publicMutation({
  name: "append",
  args: () => AppendVersionArgs,
  returns: () => VersionedEntryReturn,
  error: () => VersioningError.Schema,
});

const restore = FunctionSpec.publicMutation({
  name: "restore",
  args: () => RestoreVersionArgs,
  returns: () => VersionedEntryReturn,
  error: () => VersioningError.Schema,
});

const reconcile = FunctionSpec.publicMutation({
  name: "reconcile",
  args: () => ReconcileVersionArgs,
  returns: () => VersionedEntryReturn,
  error: () => VersioningError.Schema,
});

const markFreshness = FunctionSpec.publicMutation({
  name: "markFreshness",
  args: () => MarkFreshnessArgs,
  returns: () => VersionFreshnessReturn,
  error: () => VersioningError.Schema,
});

const latest = FunctionSpec.publicQuery({
  name: "latest",
  args: () => LatestVersionArgs,
  returns: () => VersionedEntryReturn,
  error: () => VersioningError.Schema,
});

export default GroupSpec.make()
  .addFunction(append)
  .addFunction(restore)
  .addFunction(reconcile)
  .addFunction(markFreshness)
  .addFunction(latest);
