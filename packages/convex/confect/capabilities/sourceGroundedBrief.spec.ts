import { GroupSpec } from "@confect/core";
import * as S from "effect/Schema";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
  internalMutationStep,
  publicMutation,
} from "./_kit/capability";

export const SourceGroundedBriefArgs = S.Struct({
  workspaceId: S.String,
  sourceIds: S.Array(S.String).pipe(S.check(S.isMinLength(1))),
  briefGoal: S.String.pipe(S.check(S.isMinLength(1))),
  idempotencyKey: S.String.pipe(S.check(S.isMinLength(1))),
});

export const SourceGroundedBriefReturn = S.Struct({
  briefMarkdown: S.String,
  sourceTitles: S.Array(S.String),
  policySnapshotId: S.String,
  modelReceiptId: S.String,
  trustClaim: S.String,
});

const run = defineContractFunction(
  publicMutation({
    name: "run",
    args: () => SourceGroundedBriefArgs,
    returns: () => SourceGroundedBriefReturn,
  }),
  {
    namespace: "capabilities.sourceGroundedBrief",
    name: "run",
    operationId: "capabilities.sourceGroundedBrief.run",
    kind: "mutation",
    surfaces: ["web", "workflow", "internal"],
    typedErrors: [
      "Unauthorized",
      "Forbidden",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "capabilities.sourceGroundedBrief.run.args",
    returnsSchemaName: "capabilities.sourceGroundedBrief.run.returns",
    argsSchema: SourceGroundedBriefArgs,
    returnsSchema: SourceGroundedBriefReturn,
  },
);

const runInternal = defineContractFunction(
  internalMutationStep({
    name: "runInternal",
    args: () => SourceGroundedBriefArgs,
    returns: () => SourceGroundedBriefReturn,
  }),
  {
    namespace: "capabilities.sourceGroundedBrief",
    name: "runInternal",
    operationId: "capabilities.sourceGroundedBrief.runInternal",
    kind: "mutation",
    surfaces: ["workflow", "internal"],
    typedErrors: [
      "Unauthorized",
      "Forbidden",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "capabilities.sourceGroundedBrief.runInternal.args",
    returnsSchemaName: "capabilities.sourceGroundedBrief.runInternal.returns",
    argsSchema: SourceGroundedBriefArgs,
    returnsSchema: SourceGroundedBriefReturn,
  },
);

const contractFunctions = [run, runInternal] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(run.spec)
  .addFunction(runInternal.spec);
