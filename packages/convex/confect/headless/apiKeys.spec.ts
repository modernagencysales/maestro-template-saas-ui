import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import { ApiKeyScope } from "./auth";

const Actor = Schema.Struct({
  ok: Schema.Literal(true),
  keyId: Schema.String,
  workspaceId: Id("workspaces"),
  userId: Id("users"),
});

const AuthFailure = Schema.Struct({
  ok: Schema.Literal(false),
  code: Schema.Literals([
    "API_KEY_MISSING",
    "API_KEY_NOT_FOUND",
    "API_KEY_REVOKED",
    "API_KEY_EXPIRED",
    "API_KEY_FORBIDDEN",
    "API_KEY_WORKSPACE_MISMATCH",
  ]),
  message: Schema.String,
});

const seedLocalContracts = FunctionSpec.internalMutation({
  name: "seedLocalContracts",
  args: () => Schema.Struct({ keyHash: Schema.String }),
  returns: () =>
    Schema.Struct({
      keyId: Schema.String,
      workspaceId: Id("workspaces"),
      userId: Id("users"),
    }),
});

const resolve = FunctionSpec.internalQuery({
  name: "resolve",
  args: () =>
    Schema.Struct({
      keyHash: Schema.String,
      workspaceSlug: Schema.String,
      requiredScope: ApiKeyScope,
      nowMs: Schema.Number,
    }),
  returns: () => Schema.Union([Actor, AuthFailure]),
});

export default GroupSpec.make()
  .addFunction(seedLocalContracts)
  .addFunction(resolve);
