import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { NotFound, Unauthorized, ValidationFailed } from "../errors";

export const resume = FunctionSpec.internalMutation({
  name: "resume",
  args: () =>
    Schema.Struct({
      incidentId: Schema.String,
      operatorReason: Schema.String,
    }),
  returns: () =>
    Schema.Struct({
      incidentId: Schema.String,
      packId: Schema.String,
      failedStage: Schema.String,
      attempt: Schema.Number,
      status: Schema.Literal("running"),
      operatorReason: Schema.String,
    }),
  error: () => Schema.Union([Unauthorized, NotFound, ValidationFailed]),
});

export default GroupSpec.make().addFunction(resume);
