import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { NoRecoverableError } from "../errors";

export const Capability = Schema.Struct({
  key: Schema.String,
  name: Schema.String,
  description: Schema.String,
  headlessExposure: Schema.Literals(["web", "api", "cli", "mcp"]),
  requiresApproval: Schema.Boolean,
});

const list = FunctionSpec.publicQuery({
  name: "list",
  args: () => Schema.Struct({}),
  returns: () => Schema.Array(Capability),
  error: () => NoRecoverableError,
});

export default GroupSpec.make().addFunction(list);
