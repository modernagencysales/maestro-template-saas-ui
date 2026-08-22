import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "../capabilities/_kit/capability";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { Id } from "../_generated/id";
import { WorkflowStatusResult } from "../workflows/_kit/status";

const WorkflowErrors = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
]);

const StartArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  idempotencyKey: Schema.String,
});

const StartReturns = Schema.Struct({
  status: Schema.Literal("queued"),
  workflow: Schema.Literal("generateCompleteBuildPack"),
  componentWorkflowId: Schema.String,
});

const StatusArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  componentWorkflowId: Schema.String,
});

const ApproveArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  componentWorkflowId: Schema.String,
  nodeId: Schema.String,
});

const ApproveReturns = Schema.Struct({
  eventId: Schema.String,
});

export const start = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "start",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.generateCompleteBuildPack",
    name: "start",
    operationId: "workflows.generateCompleteBuildPack.start",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.generateCompleteBuildPack.start.args",
    returnsSchemaName: "workflows.generateCompleteBuildPack.start.returns",
    argsSchema: StartArgs,
    returnsSchema: StartReturns,
  },
);

export const status = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "status",
    args: () => StatusArgs,
    returns: () => WorkflowStatusResult,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.generateCompleteBuildPack",
    name: "status",
    operationId: "workflows.generateCompleteBuildPack.status",
    kind: "query",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: true,
    argsSchemaName: "workflows.generateCompleteBuildPack.status.args",
    returnsSchemaName: "workflows.generateCompleteBuildPack.status.returns",
    argsSchema: StatusArgs,
    returnsSchema: WorkflowStatusResult,
  },
);

export const approve = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "approve",
    args: () => ApproveArgs,
    returns: () => ApproveReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.generateCompleteBuildPack",
    name: "approve",
    operationId: "workflows.generateCompleteBuildPack.approve",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.generateCompleteBuildPack.approve.args",
    returnsSchemaName: "workflows.generateCompleteBuildPack.approve.returns",
    argsSchema: ApproveArgs,
    returnsSchema: ApproveReturns,
  },
);

const contractFunctions = [start, status, approve] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(start.spec)
  .addFunction(status.spec)
  .addFunction(approve.spec);
