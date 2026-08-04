import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  apiKeyByHash,
  authorize,
  backfillTokenIdentifiers,
  sessionPrincipal,
} from "./httpAuthorization";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof backfillTokenIdentifiers>()(
      "backfillTokenIdentifiers",
    ),
  )
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
