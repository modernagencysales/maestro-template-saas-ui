import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  auditExport,
  consume,
  provisionApproval,
  provisionCensus,
  provisionIssuer,
  provisionVerdict,
  readiness,
  revokeIssuer,
  runtimeSigningIssuer,
  rotateIssuer,
  status,
} from "./authority";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof provisionIssuer>()(
      "provisionIssuer",
    ),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof rotateIssuer>()("rotateIssuer"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof revokeIssuer>()("revokeIssuer"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof provisionApproval>()(
      "provisionApproval",
    ),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof provisionCensus>()(
      "provisionCensus",
    ),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof provisionVerdict>()(
      "provisionVerdict",
    ),
  )
  .addFunction(FunctionSpec.convexPublicQuery<typeof status>()("status"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof readiness>()("readiness"))
  .addFunction(
    FunctionSpec.convexPublicQuery<typeof auditExport>()("auditExport"),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof runtimeSigningIssuer>()(
      "runtimeSigningIssuer",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof consume>()("consume"),
  );
