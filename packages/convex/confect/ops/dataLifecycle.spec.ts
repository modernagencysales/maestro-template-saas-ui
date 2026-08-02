import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  MemberNotInWorkspace,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "../capabilities/_kit/capability";
import {
  DsarDeletePlanEntrySchema,
  DsarExportManifestEntrySchema,
  DsarRequestKindSchema,
  DsarRequestStatusSchema,
  LegalHoldSchema,
} from "./dataLifecycle";

const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));
const DataLifecycleError = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  ValidationFailed,
]);

export const CreateDsarRequestArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  requestId: NonEmptyString,
  kind: DsarRequestKindSchema,
  subjectId: Schema.optional(NonEmptyString),
  confirmationPhrase: Schema.optional(Schema.String),
  legalHold: Schema.optional(LegalHoldSchema),
});

export const ListDsarRequestsArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
});

export const DsarConfirmationReturn = Schema.Struct({
  required: Schema.Literal(true),
  phrase: Schema.String,
  reason: Schema.String,
});

export const DsarRequestReturn = Schema.Struct({
  workspaceId: Id("workspaces"),
  requestId: NonEmptyString,
  requestedByUserId: Id("users"),
  subjectId: Schema.optional(NonEmptyString),
  kind: DsarRequestKindSchema,
  status: DsarRequestStatusSchema,
  dryRunOnly: Schema.Literal(true),
  plannedAt: Schema.Number,
  confirmationPhrase: Schema.optional(Schema.String),
  legalHold: Schema.optional(LegalHoldSchema),
  confirmation: DsarConfirmationReturn,
  exportManifest: Schema.Array(DsarExportManifestEntrySchema),
  deletePlan: Schema.Array(DsarDeletePlanEntrySchema),
});

export const ListDsarRequestsReturn = Schema.Struct({
  requests: Schema.Array(DsarRequestReturn),
});

const createDsarRequest = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "createDsarRequest",
    args: () => CreateDsarRequestArgs,
    returns: () => DsarRequestReturn,
    error: () => DataLifecycleError,
  }),
  {
    namespace: "ops.dataLifecycle",
    name: "createDsarRequest",
    operationId: "ops.dataLifecycle.createDsarRequest",
    kind: "mutation",
    surfaces: ["web"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: true,
    argsSchemaName: "ops.dataLifecycle.createDsarRequest.args",
    returnsSchemaName: "ops.dataLifecycle.createDsarRequest.returns",
    argsSchema: CreateDsarRequestArgs,
    returnsSchema: DsarRequestReturn,
  },
);

const listDsarRequests = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "listDsarRequests",
    args: () => ListDsarRequestsArgs,
    returns: () => ListDsarRequestsReturn,
    error: () => DataLifecycleError,
  }),
  {
    namespace: "ops.dataLifecycle",
    name: "listDsarRequests",
    operationId: "ops.dataLifecycle.listDsarRequests",
    kind: "query",
    surfaces: ["web"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: true,
    argsSchemaName: "ops.dataLifecycle.listDsarRequests.args",
    returnsSchemaName: "ops.dataLifecycle.listDsarRequests.returns",
    argsSchema: ListDsarRequestsArgs,
    returnsSchema: ListDsarRequestsReturn,
  },
);

const contractFunctions = [createDsarRequest, listDsarRequests] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(createDsarRequest.spec)
  .addFunction(listDsarRequests.spec);
