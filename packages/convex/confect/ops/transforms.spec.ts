import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

const NonEmptyString = S.String.pipe(S.check(S.isMinLength(1)));
const PolicyKind = S.Literals(["none", "approval-required", "review-required"]);
const BlockKind = S.Literals([
  "input",
  "retrieval",
  "model-output",
  "postprocess",
  "external-write",
]);
const RunStatus = S.Literals(["queued", "running", "completed", "failed"]);

export const RegisterTransformDefinitionArgs = S.Struct({
  workspaceId: NonEmptyString,
  transformId: NonEmptyString,
  name: NonEmptyString,
  inputSchemaRef: NonEmptyString,
  outputSchemaRef: NonEmptyString,
  policyKind: PolicyKind,
  requiredEvidence: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
});

export const RunTransformArgs = S.Struct({
  workspaceId: NonEmptyString,
  runId: NonEmptyString,
  transformId: NonEmptyString,
  inputHash: NonEmptyString,
  outputHash: NonEmptyString,
  sourceIds: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
  citationIds: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
  policySnapshotId: NonEmptyString,
  modelReceiptId: NonEmptyString,
  idempotencyKey: NonEmptyString,
});

export const GetTransformRunArgs = S.Struct({
  workspaceId: NonEmptyString,
  runId: NonEmptyString,
});

export const ProjectTrustReceiptArgs = S.Struct({
  workspaceId: NonEmptyString,
  runId: NonEmptyString,
});

export const TransformDefinitionReturn = S.Struct({
  workspaceId: S.String,
  transformId: S.String,
  name: S.String,
  inputSchemaRef: S.String,
  outputSchemaRef: S.String,
  policyKind: PolicyKind,
  requiredEvidence: S.Array(S.String),
  createdAt: S.Number,
});

export const TransformRunReturn = S.Struct({
  workspaceId: S.String,
  runId: S.String,
  transformId: S.String,
  status: RunStatus,
  inputHash: S.String,
  outputHash: S.String,
  sourceIds: S.Array(S.String),
  citationIds: S.Array(S.String),
  policySnapshotId: S.String,
  modelReceiptId: S.String,
  idempotencyKey: S.String,
  createdAt: S.Number,
  completedAt: S.optional(S.Number),
});

export const TransformBlockReturn = S.Struct({
  workspaceId: S.String,
  runId: S.String,
  blockId: S.String,
  transformId: S.String,
  kind: BlockKind,
  inputHash: S.String,
  outputHash: S.String,
  sourceIds: S.Array(S.String),
  citationIds: S.Array(S.String),
  policySnapshotId: S.String,
  modelReceiptId: S.String,
  createdAt: S.Number,
});

export const TransformTrustReceiptReturn = S.Struct({
  receiptId: S.String,
  workspaceId: S.String,
  runId: S.String,
  transformId: S.String,
  sourceIds: S.Array(S.String),
  citationIds: S.Array(S.String),
  inputHashes: S.Array(S.String),
  outputHashes: S.Array(S.String),
  policySnapshotIds: S.Array(S.String),
  modelReceiptIds: S.Array(S.String),
  trustClaim: S.Literal("source-backed-transform"),
  createdAt: S.Number,
});

export namespace TransformError {
  export class DefinitionNotFound extends S.TaggedErrorClass<DefinitionNotFound>()(
    "DefinitionNotFound",
    {
      transformId: S.String,
    },
  ) {}

  export class RunNotFound extends S.TaggedErrorClass<RunNotFound>()(
    "RunNotFound",
    {
      runId: S.String,
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
    DefinitionNotFound,
    RunNotFound,
    ValidationFailed,
  ]);
}

const registerDefinition = FunctionSpec.publicMutation({
  name: "registerDefinition",
  args: () => RegisterTransformDefinitionArgs,
  returns: () => TransformDefinitionReturn,
  error: () => TransformError.Schema,
});

const runTransform = FunctionSpec.publicMutation({
  name: "runTransform",
  args: () => RunTransformArgs,
  returns: () => TransformRunReturn,
  error: () => TransformError.Schema,
});

const getRun = FunctionSpec.publicQuery({
  name: "getRun",
  args: () => GetTransformRunArgs,
  returns: () => TransformRunReturn,
  error: () => TransformError.Schema,
});

const projectTrustReceipt = FunctionSpec.publicQuery({
  name: "projectTrustReceipt",
  args: () => ProjectTrustReceiptArgs,
  returns: () => TransformTrustReceiptReturn,
  error: () => TransformError.Schema,
});

export default GroupSpec.make()
  .addFunction(registerDefinition)
  .addFunction(runTransform)
  .addFunction(getRun)
  .addFunction(projectTrustReceipt);
