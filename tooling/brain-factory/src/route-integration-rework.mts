import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runRtk } from "./process.js";
import { planIntegrationOwnerReworkRoute } from "./route-integration-rework.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const integrationId = valueAfter("--integration-id");
const expectedResultSha256 = valueAfter("--result-sha256");
const expectedSelectionFileSha256 = valueAfter("--selection-file-sha256");
const expectedSelectionPayloadSha256 = valueAfter("--selection-payload-sha256");
if (
  !integrationId ||
  !expectedResultSha256 ||
  !expectedSelectionFileSha256 ||
  !expectedSelectionPayloadSha256
) {
  throw new Error(
    "route-rework requires integration ID and exact result/selection hashes",
  );
}
const stateRoot = resolve(
  valueAfter("--state") ?? ".fabro/state/maestro-brain",
);
const selectionPath = resolve(
  stateRoot,
  "runs",
  `integration-${integrationId}-selection.json`,
);
const resultPath = resolve(
  stateRoot,
  "evidence",
  "integration",
  integrationId,
  "integration-result.json",
);
if (!existsSync(selectionPath) || !existsSync(resultPath)) {
  throw new Error(`${integrationId}: selection or result is missing`);
}
const integrationResultContent = readFileSync(resultPath, "utf8");
const parsed = JSON.parse(integrationResultContent) as {
  readonly generatedFiles?: unknown;
};
const integrationOwnedPaths = Array.isArray(parsed.generatedFiles)
  ? parsed.generatedFiles.filter(
      (path): path is string => typeof path === "string",
    )
  : [];
const route = planIntegrationOwnerReworkRoute({
  expectedIntegrationId: integrationId,
  expectedResultSha256,
  expectedSelectionFileSha256,
  expectedSelectionPayloadSha256,
  integrationOwnedPaths,
  integrationResultContent,
  selectionContent: readFileSync(selectionPath, "utf8"),
  stateRoot,
});
for (const command of route.commands) runRtk(command);
process.stdout.write(`${JSON.stringify(route, null, 2)}\n`);
