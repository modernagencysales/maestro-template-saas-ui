import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import workspaces from "../_generated/tables/workspaces";
import { Id } from "../_generated/id";
import {
  MemberNotInWorkspace,
  NoRecoverableError,
  Unauthorized,
} from "../errors";

const frontendWorkspace = Schema.Struct({
  id: Id("workspaces"),
  slug: Schema.String,
  name: Schema.String,
});

const me = FunctionSpec.publicQuery({
  name: "me",
  args: () => Schema.Struct({}),
  returns: () =>
    Schema.Struct({
      id: Id("users"),
      email: Schema.String,
      name: Schema.String,
      image: Schema.Null,
      workspaces: Schema.Array(frontendWorkspace),
    }),
  error: () => Unauthorized,
});

const bySlug = FunctionSpec.publicQuery({
  name: "bySlug",
  args: () => Schema.Struct({ slug: Schema.String }),
  returns: () => Schema.NullOr(frontendWorkspace),
  error: () => Schema.Union([Unauthorized, MemberNotInWorkspace]),
});

const list = FunctionSpec.publicQuery({
  name: "list",
  args: () => Schema.Struct({}),
  returns: () => Schema.Array(workspaces.Doc),
  error: () => Schema.Union([Unauthorized, NoRecoverableError]),
});

export default GroupSpec.make()
  .addFunction(me)
  .addFunction(bySlug)
  .addFunction(list);
