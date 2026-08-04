import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";
import { ValidationFailed } from "./errors";
import type {
  apiKeyByHash,
  authorize,
  sessionPrincipal,
} from "./httpAuthorization";

const backfillTokenIdentifiers = FunctionSpec.internalMutation({
  name: "backfillTokenIdentifiers",
  args: () =>
    Schema.Struct({
      identities: Schema.Array(
        Schema.Struct({
          userId: Id("users"),
          issuer: Schema.String,
          subject: Schema.String,
        }),
      ),
    }),
  returns: () => Schema.Struct({ updated: Schema.Number }),
  error: () => ValidationFailed,
});

export default GroupSpec.make()
  .addFunction(backfillTokenIdentifiers)
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof sessionPrincipal>()(
      "sessionPrincipal",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof apiKeyByHash>()("apiKeyByHash"),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof authorize>()("authorize"),
  );
