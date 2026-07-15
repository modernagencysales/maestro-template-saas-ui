import { readJson } from "./integration-check-support.js";
import {
  type IntegrationWaveSelection,
  validateIntegrationWaveSelection,
} from "./integration-wave.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const selectionPath = valueAfter("--selection");
const integrationId = valueAfter("--integration-id");
const baseSha = valueAfter("--base");
const selectionSha256 = valueAfter("--selection-sha256");
if (!selectionPath || !integrationId || !baseSha || !selectionSha256) {
  throw new Error(
    "usage: integration-wave-selection-check --selection ... --integration-id ... --base ... --selection-sha256 ...",
  );
}
const selection = readJson(
  selectionPath,
) as unknown as IntegrationWaveSelection;
validateIntegrationWaveSelection(selection);
if (
  selection.integrationId !== integrationId ||
  selection.baseSha !== baseSha ||
  selection.selectionSha256 !== selectionSha256
) {
  throw new Error("integration wave selection launch identity mismatch");
}
console.log(`${integrationId}: immutable wave selection passed`);
