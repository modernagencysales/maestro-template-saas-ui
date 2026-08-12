import { checkSaasUiFoundation } from "./saas-ui-foundation.js";

const errors = checkSaasUiFoundation(process.cwd());
if (errors.length > 0) {
  console.error(
    errors.map((error) => `Saas UI foundation: ${error}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("Saas UI foundation verified.");
}
