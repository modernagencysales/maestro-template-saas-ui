import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  Forbidden,
  LastOwnerProtected,
  MemberNotInWorkspace,
  MembershipNotLive,
  Unauthorized,
} from "../errors";
import { Role } from "./roles";

const changeRole = FunctionSpec.publicMutation({
  name: "changeRole",
  args: () =>
    Schema.Struct({
      membershipId: Id("workspaceMembers"),
      newRole: Role,
    }),
  returns: () => Schema.Null,
  error: () =>
    Schema.Union([
      Unauthorized,
      Forbidden,
      MemberNotInWorkspace,
      MembershipNotLive,
      LastOwnerProtected,
    ]),
});

const remove = FunctionSpec.publicMutation({
  name: "remove",
  args: () =>
    Schema.Struct({
      membershipId: Id("workspaceMembers"),
    }),
  returns: () => Schema.Null,
  error: () =>
    Schema.Union([
      Unauthorized,
      Forbidden,
      MemberNotInWorkspace,
      MembershipNotLive,
      LastOwnerProtected,
    ]),
});

const transferOwnership = FunctionSpec.publicMutation({
  name: "transferOwnership",
  args: () =>
    Schema.Struct({
      membershipId: Id("workspaceMembers"),
    }),
  returns: () => Schema.Null,
  error: () =>
    Schema.Union([
      Unauthorized,
      Forbidden,
      MemberNotInWorkspace,
      MembershipNotLive,
      LastOwnerProtected,
    ]),
});

const list = FunctionSpec.publicQuery({
  name: "list",
  args: () => Schema.Struct({ workspaceId: Id("workspaces") }),
  returns: () =>
    Schema.Array(
      Schema.Struct({
        id: Id("workspaceMembers"),
        email: Schema.String,
        name: Schema.String,
        avatar: Schema.Null,
        roles: Schema.Array(Role),
        status: Schema.Literal("active"),
      }),
    ),
  error: () => Schema.Union([Unauthorized, MemberNotInWorkspace]),
});

export default GroupSpec.make()
  .addFunction(list)
  .addFunction(changeRole)
  .addFunction(remove)
  .addFunction(transferOwnership);
