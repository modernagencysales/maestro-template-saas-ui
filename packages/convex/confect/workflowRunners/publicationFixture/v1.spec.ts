import { FunctionSpec, GroupSpec } from "@confect/core";
import type { onComplete, run } from "./v1";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexInternalMutation<typeof run>()("run"))
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof onComplete>()("onComplete"),
  );
