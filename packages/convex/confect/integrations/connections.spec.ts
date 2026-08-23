import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import providerConnections from "../_generated/tables/providerConnections";
import { Id } from "../_generated/id";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { providerKeys } from "./connectionLifecycle";

const ProviderKey = Schema.Literals(providerKeys);
const AccessError = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
]);
const MutationError = Schema.Union([AccessError, NotFound, ValidationFailed]);
const WorkspaceProviderArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  provider: ProviderKey,
});

const list = FunctionSpec.publicQuery({
  name: "list",
  args: () => Schema.Struct({ workspaceId: Id("workspaces") }),
  returns: () => Schema.Array(providerConnections.Doc),
  error: () => AccessError,
});

const begin = FunctionSpec.publicMutation({
  name: "begin",
  args: () => WorkspaceProviderArgs,
  returns: () => providerConnections.Doc,
  error: () => MutationError,
});

const complete = FunctionSpec.publicMutation({
  name: "complete",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      provider: ProviderKey,
      generation: Schema.Number,
      completion: Schema.Union([
        Schema.Struct({
          status: Schema.Literal("active"),
          connectionRef: Schema.NonEmptyString,
        }),
        Schema.Struct({
          status: Schema.Literal("error"),
          errorCode: Schema.NonEmptyString,
        }),
      ]),
    }),
  returns: () => providerConnections.Doc,
  error: () => MutationError,
});

const revoke = FunctionSpec.publicMutation({
  name: "revoke",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      provider: ProviderKey,
      generation: Schema.Number,
    }),
  returns: () => providerConnections.Doc,
  error: () => MutationError,
});

export default GroupSpec.make()
  .addFunction(list)
  .addFunction(begin)
  .addFunction(complete)
  .addFunction(revoke);
