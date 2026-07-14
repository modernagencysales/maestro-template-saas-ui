import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Forbidden, Unauthorized } from "../errors";
import {
  ApiKeyExpiryInvalid,
  ApiKeyMetadataSchema,
  ApiKeyNotFound,
  ApiKeyRevoked,
  ApiKeyScopeInvalid,
} from "./auth";

const create = FunctionSpec.publicMutation({
  name: "create",
  args: () =>
    Schema.Struct({
      organizationId: Schema.String,
      workspaceId: Schema.String,
      brainKey: Schema.String,
      name: Schema.String,
      scopes: Schema.Array(Schema.String),
      expiresAt: Schema.Number,
    }),
  returns: () =>
    Schema.Struct({
      displayKey: Schema.String,
      key: ApiKeyMetadataSchema,
    }),
  error: () =>
    Schema.Union(
      Unauthorized,
      Forbidden,
      ApiKeyScopeInvalid,
      ApiKeyExpiryInvalid,
    ),
});

const list = FunctionSpec.publicQuery({
  name: "list",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.String,
      brainKey: Schema.String,
    }),
  returns: () => Schema.Array(ApiKeyMetadataSchema),
  error: () => Schema.Union(Unauthorized, Forbidden),
});

const revoke = FunctionSpec.publicMutation({
  name: "revoke",
  args: () =>
    Schema.Struct({
      keyId: Schema.String,
    }),
  returns: () => Schema.Null,
  error: () =>
    Schema.Union(Unauthorized, Forbidden, ApiKeyNotFound, ApiKeyRevoked),
});

export default GroupSpec.make()
  .addFunction(create)
  .addFunction(list)
  .addFunction(revoke);
