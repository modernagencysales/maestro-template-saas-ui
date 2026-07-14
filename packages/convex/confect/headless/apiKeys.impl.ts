import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import databaseSchema from "../_generated/schema";
import { Unauthorized } from "../errors";
import apiKeys from "./apiKeys.spec";

const create = FunctionImpl.make(databaseSchema, apiKeys, "create", () =>
  Effect.fail(new Unauthorized()),
);

const list = FunctionImpl.make(databaseSchema, apiKeys, "list", () =>
  Effect.fail(new Unauthorized()),
);

const revoke = FunctionImpl.make(databaseSchema, apiKeys, "revoke", () =>
  Effect.fail(new Unauthorized()),
);

export default GroupImpl.make(databaseSchema, apiKeys).pipe(
  Layer.provide(create),
  Layer.provide(list),
  Layer.provide(revoke),
  GroupImpl.finalize,
);
