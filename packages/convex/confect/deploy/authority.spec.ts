import { FunctionSpec, GroupSpec } from "@confect/core";
import type { consume } from "./authority";

export default GroupSpec.make().addFunction(
  FunctionSpec.convexInternalMutation<typeof consume>()("consume"),
);
