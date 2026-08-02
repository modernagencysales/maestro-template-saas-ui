import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { NotFound, Unauthorized, ValidationFailed } from "../errors";

export const getOffer = FunctionSpec.publicQuery({
  name: "getOffer",
  args: () =>
    Schema.Struct({
      packId: Schema.String,
      ownerAccessToken: Schema.String,
    }),
  returns: () =>
    Schema.Struct({
      packId: Schema.String,
      reportId: Schema.String,
      creditCents: Schema.Number,
      creditStatus: Schema.Literals(["available", "applied"]),
      fit: Schema.Literals(["strong", "partial", "low"]),
      blueprintId: Schema.String,
      blueprintStatus: Schema.Literals(["implemented", "planned"]),
      mappingJson: Schema.String,
    }),
  error: () => Schema.Union([Unauthorized, NotFound, ValidationFailed]),
});

export default GroupSpec.make().addFunction(getOffer);
