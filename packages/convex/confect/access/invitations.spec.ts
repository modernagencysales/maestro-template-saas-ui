import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  Forbidden,
  InvitationExpired,
  InvitationNotAccessible,
  InvitationNotPending,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { Role } from "./roles";

const create = FunctionSpec.publicMutation({
  name: "create",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      email: Schema.String,
      role: Role,
    }),
  returns: () => Id("invitations"),
  error: () =>
    Schema.Union([
      Unauthorized,
      Forbidden,
      ValidationFailed,
      WorkspaceNotFound,
    ]),
});

const accept = FunctionSpec.publicMutation({
  name: "accept",
  args: () =>
    Schema.Struct({
      invitationId: Id("invitations"),
    }),
  returns: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
    }),
  error: () =>
    Schema.Union([
      Unauthorized,
      InvitationNotAccessible,
      InvitationNotPending,
      InvitationExpired,
    ]),
});

const decline = FunctionSpec.publicMutation({
  name: "decline",
  args: () =>
    Schema.Struct({
      invitationId: Id("invitations"),
    }),
  returns: () => Schema.Null,
  error: () => Schema.Union([Unauthorized, InvitationNotAccessible]),
});

const cancel = FunctionSpec.publicMutation({
  name: "cancel",
  args: () =>
    Schema.Struct({
      invitationId: Id("invitations"),
      workspaceId: Id("workspaces"),
    }),
  returns: () => Schema.Null,
  error: () => Schema.Union([Unauthorized, Forbidden]),
});

export default GroupSpec.make()
  .addFunction(create)
  .addFunction(accept)
  .addFunction(decline)
  .addFunction(cancel);
