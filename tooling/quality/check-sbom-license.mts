import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";
import { runStaticCheck } from "./src/gate.mts";
import { assertSaasUiArtifactSafety } from "./check-saas-ui-artifact-safety.mts";

export const descriptor = descriptorFor("sbom-license");
if (isDirectRun(import.meta.url)) {
  await runStaticCheck(descriptor);
  const failures = assertSaasUiArtifactSafety(process.cwd());
  for (const failure of failures)
    console.error(`check:sbom-license: ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}
