import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import records from "./_generated/tables/records";
import { Id } from "./_generated/id";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "./errors";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "./capabilities/_kit/capability";

const ReadError = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
]);
const WriteError = Schema.Union([ReadError, ValidationFailed]);
const WorkspaceArgs = Schema.Struct({ workspaceId: Id("workspaces") });
const ReadArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  recordId: Id("records"),
});
const CreateArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  title: Schema.String,
  detail: Schema.String,
});

const list = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => WorkspaceArgs,
    returns: () => Schema.Array(records.Doc),
    error: () =>
      Schema.Union([Unauthorized, MemberNotInWorkspace, WorkspaceNotFound]),
  }),
  {
    namespace: "records",
    name: "list",
    operationId: "records.list",
    kind: "query",
    surfaces: ["web", "api", "cli"],
    typedErrors: ["Unauthorized", "MemberNotInWorkspace", "WorkspaceNotFound"],
    idempotent: true,
    argsSchemaName: "records.list.args",
    returnsSchemaName: "records.list.returns",
    argsSchema: WorkspaceArgs,
    returnsSchema: Schema.Array(records.Doc),
  },
);

const read = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "read",
    args: () => ReadArgs,
    returns: () => records.Doc,
    error: () => ReadError,
  }),
  {
    namespace: "records",
    name: "read",
    operationId: "records.read",
    kind: "query",
    surfaces: ["web", "api", "cli"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
    ],
    idempotent: true,
    argsSchemaName: "records.read.args",
    returnsSchemaName: "records.read.returns",
    argsSchema: ReadArgs,
    returnsSchema: records.Doc,
  },
);

const create = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "create",
    args: () => CreateArgs,
    returns: () => records.Doc,
    error: () => WriteError,
  }),
  {
    namespace: "records",
    name: "create",
    operationId: "records.create",
    kind: "mutation",
    surfaces: ["web", "api", "cli"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "records.create.args",
    returnsSchemaName: "records.create.returns",
    argsSchema: CreateArgs,
    returnsSchema: records.Doc,
  },
);

const contractFunctions = [list, read, create] as const;
export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(list.spec)
  .addFunction(read.spec)
  .addFunction(create.spec);
