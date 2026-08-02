import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  ProvisioningConflict,
  Unauthorized,
  ValidationFailed,
} from "../errors";

const ensureProvisioned = FunctionSpec.publicMutation({
  name: "ensureProvisioned",
  args: () => Schema.Struct({}),
  returns: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
    }),
  error: () =>
    Schema.Union([Unauthorized, ValidationFailed, ProvisioningConflict]),
});

export default GroupSpec.make().addFunction(ensureProvisioned);
