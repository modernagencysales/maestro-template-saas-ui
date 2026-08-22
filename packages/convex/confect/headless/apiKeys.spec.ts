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

const ContractsNamespace = Schema.String.check(
  Schema.isPattern(/^contracts-[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/u),
);

const Sha256Base64Url = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]{43}$/u),
);

const SeededContractsActor = Schema.Struct({
  keyId: Schema.String,
  workspaceId: Id("workspaces"),
  userId: Id("users"),
});

const seedLocalContracts = FunctionSpec.internalMutation({
  name: "seedLocalContracts",
  args: () =>
    Schema.Struct({
      namespace: ContractsNamespace,
      primaryKeyHash: Sha256Base64Url,
      observerKeyHash: Sha256Base64Url,
    }),
  returns: () =>
    Schema.Struct({
      primary: SeededContractsActor,
      observer: SeededContractsActor,
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
