import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";
import { runStaticCheck } from "./src/gate.mts";

export const descriptor = descriptorFor("generated-files");
if (
  !descriptor.requirements.some(
    ({ file }) => file === "tooling/quality/check-saas-ui-artifact-safety.mts",
  )
)
  throw new Error(
    "check:generated-files must retain the Saas UI paid-artifact safety requirement",
  );
if (isDirectRun(import.meta.url)) await runStaticCheck(descriptor);
