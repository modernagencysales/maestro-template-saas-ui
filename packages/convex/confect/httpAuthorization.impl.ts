import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter } from "./_generated/services";
import { ValidationFailed } from "./errors";
import {
  apiKeyByHash,
  authorize,
  issuerBoundTokenIdentifier,
  sessionPrincipal,
} from "./httpAuthorization";
import httpAuthorization from "./httpAuthorization.spec";

const backfill = FunctionImpl.make(
  databaseSchema,
  httpAuthorization,
  "backfillTokenIdentifiers",
  ({ identities }) =>
    Effect.gen(function* () {
      if (identities.length > 100)
        return yield* new ValidationFailed({
          field: "identities",
          message: "Backfill batch exceeds 100 users.",
        });

      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      for (const identity of identities) {
        const user = yield* reader
          .table("users")
          .get(identity.userId)
          .pipe(Effect.orDie);
        if (user === null || user.subject !== identity.subject)
          return yield* new ValidationFailed({
            field: "identities",
            message: `Trusted subject mismatch for ${identity.userId}.`,
          });
        const tokenIdentifier = yield* Effect.try({
          try: () =>
            issuerBoundTokenIdentifier(identity.issuer, identity.subject),
          catch: () =>
            new ValidationFailed({
              field: "identities",
              message: "Issuer and subject are required.",
            }),
        });
        if (
          user.tokenIdentifier !== undefined &&
          user.tokenIdentifier !== tokenIdentifier
        )
          return yield* new ValidationFailed({
            field: "identities",
            message: `Token identifier mismatch for ${identity.userId}.`,
          });
        yield* writer
          .table("users")
          .patch(identity.userId, { tokenIdentifier })
          .pipe(Effect.orDie);
      }
      return { updated: identities.length };
    }),
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
