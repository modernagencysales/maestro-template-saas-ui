import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";
import { NoRecoverableError } from "../errors";

export const TemplateHealthEnvironment = S.Literals(["fake", "test", "live"]);

export const TemplateHealthCheck = S.Struct({
  id: S.String,
  status: S.Literals(["pass", "warn", "fail"]),
  detail: S.String,
});

export const TemplateHealthReport = S.Struct({
  ok: S.Boolean,
  service: S.Literal("maestro-template"),
  environment: TemplateHealthEnvironment,
  commitSha: S.String,
  checkedAt: S.Number,
  checks: S.Array(TemplateHealthCheck),
});

const liveness = FunctionSpec.publicQuery({
  name: "liveness",
  args: () =>
    S.Struct({
      environment: TemplateHealthEnvironment,
      commitSha: S.String,
      checkedAt: S.Number,
    }),
  returns: () => TemplateHealthReport,
  error: () => NoRecoverableError,
});

export default GroupSpec.make().addFunction(liveness);
