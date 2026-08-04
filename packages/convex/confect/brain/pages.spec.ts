import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { Id } from "../_generated/id";
import brainPages from "../_generated/tables/brainPages";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "../capabilities/_kit/capability";

const BrainPageError = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
]);

const BrainPageWriteError = Schema.Union([BrainPageError, ValidationFailed]);

const ListArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
});

const ListReturns = Schema.Array(brainPages.Doc);

const CreateMarkdownArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  slug: Schema.String,
  title: Schema.String,
  markdown: Schema.String,
});

const CreateMarkdownReturns = Id("brainPages");

export const RecordSnapshotArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  pageId: Id("brainPages"),
  snapshot: Schema.String,
  version: Schema.Number,
});

export const RecordSnapshotReturns = Schema.Struct({
  ok: Schema.Literal(true),
});

const list = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => ListArgs,
    returns: () => ListReturns,
    error: () => BrainPageError,
  }),
  {
    namespace: "brain.pages",
    name: "list",
    operationId: "brain.pages.list",
    kind: "query",
    surfaces: ["web"],
    typedErrors: ["Unauthorized", "MemberNotInWorkspace", "WorkspaceNotFound"],
    idempotent: true,
    argsSchemaName: "brain.pages.list.args",
    returnsSchemaName: "brain.pages.list.returns",
    argsSchema: ListArgs,
    returnsSchema: ListReturns,
  },
);

const createMarkdown = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "createMarkdown",
    args: () => CreateMarkdownArgs,
    returns: () => CreateMarkdownReturns,
    error: () => BrainPageWriteError,
  }),
  {
    namespace: "brain.pages",
    name: "createMarkdown",
    operationId: "brain.pages.createMarkdown",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    authorizationBindings: [
      {
        id: "brain_pages_create_web",
        surface: "web",
        coverageTag: "@covers_brain_pages_create_web",
        authPolicyId: "auth_session_membership_editor",
      },
      {
        id: "brain_pages_create_api",
        surface: "api",
        coverageTag: "@covers_brain_pages_create_api",
        authPolicyId: "auth_api_key_workspace_write",
      },
      {
        id: "brain_pages_create_cli",
        surface: "cli",
        coverageTag: "@covers_brain_pages_create_cli",
        authPolicyId: "auth_api_key_workspace_write",
      },
      {
        id: "brain_pages_create_mcp",
        surface: "mcp",
        coverageTag: "@covers_brain_pages_create_mcp",
        authPolicyId: "auth_api_key_workspace_write",
      },
    ],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "brain.pages.createMarkdown.args",
    returnsSchemaName: "brain.pages.createMarkdown.returns",
    argsSchema: CreateMarkdownArgs,
    returnsSchema: CreateMarkdownReturns,
  },
);

const recordSnapshotInternal = FunctionSpec.internalMutation({
  name: "recordSnapshotInternal",
  args: () => RecordSnapshotArgs,
  returns: () => RecordSnapshotReturns,
  error: () => Schema.Union([NotFound, ValidationFailed]),
});

const contractFunctions = [list, createMarkdown] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(list.spec)
  .addFunction(createMarkdown.spec)
  .addFunction(recordSnapshotInternal);
