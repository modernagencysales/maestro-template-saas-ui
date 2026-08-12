import { checkSaasUiFoundation } from "./saas-ui-foundation.js";
import { fileURLToPath } from "node:url";

const errors = checkSaasUiFoundation(
  fileURLToPath(new URL("../../", import.meta.url)),
);
if (errors.length > 0) {
  console.error(
    errors.map((error) => `Saas UI foundation: ${error}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("Saas UI foundation verified.");
}
