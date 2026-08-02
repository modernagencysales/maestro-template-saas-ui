import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import {
  WorkflowArtifactKind,
  WorkflowArtifactSensitivity,
} from "./_kit/workflowArtifacts";

const NonNegativeInteger = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

export const WorkflowArtifactReference = Schema.Struct({
  artifactId: Id("workflowArtifacts"),
  contentHash: Schema.String,
  measuredBytes: NonNegativeInteger,
  sensitivity: WorkflowArtifactSensitivity,
});

export const WorkflowArtifactValue = Schema.Struct({
  ...WorkflowArtifactReference.fields,
  workflowRunId: Id("workflowRuns"),
  workflowId: Schema.NonEmptyString,
  workflowVersion: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
  lifecycleGeneration: NonNegativeInteger,
  referenceKey: Schema.NonEmptyString,
  kind: WorkflowArtifactKind,
  content: Schema.Unknown,
  retentionUntil: NonNegativeInteger,
});

const PutArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  workflowId: Schema.NonEmptyString,
  workflowVersion: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
  lifecycleGeneration: NonNegativeInteger,
  referenceKey: Schema.NonEmptyString,
  kind: WorkflowArtifactKind,
  sensitivity: WorkflowArtifactSensitivity,
  content: Schema.Unknown,
  referenceUntil: NonNegativeInteger,
  retentionUntil: NonNegativeInteger,
  createdAt: NonNegativeInteger,
});

const OwnedArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  artifactId: Id("workflowArtifacts"),
});

const DeleteArgs = Schema.Struct({
  ...OwnedArgs.fields,
  now: NonNegativeInteger,
});

const errors = Schema.Union([NotFound, ValidationFailed]);
const publicErrors = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
]);

const put = FunctionSpec.internalMutation({
  name: "put",
  args: () => PutArgs,
  returns: () => WorkflowArtifactReference,
  error: () => errors,
});

const getOwned = FunctionSpec.internalQuery({
  name: "getOwned",
  args: () => OwnedArgs,
  returns: () => WorkflowArtifactValue,
  error: () => errors,
});

const get = FunctionSpec.publicQuery({
  name: "get",
  args: () => Schema.Struct({ artifactId: Id("workflowArtifacts") }),
  returns: () => WorkflowArtifactValue,
  error: () => publicErrors,
});

const remove = FunctionSpec.internalMutation({
  name: "remove",
  args: () => DeleteArgs,
  returns: () => Schema.Null,
  error: () => errors,
});

export default GroupSpec.make()
  .addFunction(put)
  .addFunction(getOwned)
  .addFunction(get)
  .addFunction(remove);
