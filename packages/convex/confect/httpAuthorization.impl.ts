import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";

import databaseSchema from "./_generated/schema";
import {
  apiKeyByHash,
  authorize,
  backfillTokenIdentifiers,
  sessionPrincipal,
} from "./httpAuthorization";
import httpAuthorization from "./httpAuthorization.spec";

const backfill = FunctionImpl.make(
  databaseSchema,
  httpAuthorization,
  "backfillTokenIdentifiers",
  backfillTokenIdentifiers,
);
const session = FunctionImpl.make(
  databaseSchema,
  httpAuthorization,
  "sessionPrincipal",
  sessionPrincipal,
);
const apiKey = FunctionImpl.make(
  databaseSchema,
  httpAuthorization,
  "apiKeyByHash",
  apiKeyByHash,
);
const authorizeImpl = FunctionImpl.make(
  databaseSchema,
  httpAuthorization,
  "authorize",
  authorize,
);

export default GroupImpl.make(databaseSchema, httpAuthorization).pipe(
  Layer.provide(backfill),
  Layer.provide(session),
  Layer.provide(apiKey),
  Layer.provide(authorizeImpl),
  GroupImpl.finalize,
);
