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
  NotFound,
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

const PageDetailArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  pageId: Id("brainPages"),
});

const UpdateMarkdownArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  pageId: Id("brainPages"),
  markdown: Schema.String,
  expectedUpdatedAt: Schema.Number,
});

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

const get = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: () => PageDetailArgs,
    returns: () => brainPages.Doc,
    error: () => BrainPageError,
  }),
  {
    namespace: "brain.pages",
    name: "get",
    operationId: "brain.pages.get",
    kind: "query",
    surfaces: ["web"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
    ],
    idempotent: true,
    argsSchemaName: "brain.pages.get.args",
    returnsSchemaName: "brain.pages.get.returns",
    argsSchema: PageDetailArgs,
    returnsSchema: brainPages.Doc,
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

const updateMarkdown = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "updateMarkdown",
    args: () => UpdateMarkdownArgs,
    returns: () => brainPages.Doc,
    error: () => BrainPageWriteError,
  }),
  {
    namespace: "brain.pages",
    name: "updateMarkdown",
    operationId: "brain.pages.updateMarkdown",
    kind: "mutation",
    surfaces: ["web"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "brain.pages.updateMarkdown.args",
    returnsSchemaName: "brain.pages.updateMarkdown.returns",
    argsSchema: UpdateMarkdownArgs,
    returnsSchema: brainPages.Doc,
  },
);

const recordSnapshotInternal = FunctionSpec.internalMutation({
  name: "recordSnapshotInternal",
  args: () => RecordSnapshotArgs,
  returns: () => RecordSnapshotReturns,
  error: () => Schema.Union([NotFound, ValidationFailed]),
});

const contractFunctions = [list, get, createMarkdown, updateMarkdown] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(list.spec)
  .addFunction(get.spec)
  .addFunction(createMarkdown.spec)
  .addFunction(updateMarkdown.spec)
  .addFunction(recordSnapshotInternal);
