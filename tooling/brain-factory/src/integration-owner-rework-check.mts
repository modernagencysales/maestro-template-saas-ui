import { readFileSync } from "node:fs";

import { runRtk } from "./process.js";
import { planIntegrationOwnerReworkRoute } from "./route-integration-rework.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const required = (flag: string): string => {
  const value = valueAfter(flag);
  if (!value) throw new Error(`${flag} is required`);
  return value;
};

const workdir = required("--workdir");
const resultPath = required("--result");
const resultContent = readFileSync(resultPath, "utf8");
const result = JSON.parse(resultContent) as {
  readonly generatedFiles?: unknown;
};
const route = planIntegrationOwnerReworkRoute({
  expectedHeadSha: runRtk(["proxy", "git", "rev-parse", "HEAD"], {
    cwd: workdir,
    quiet: true,
  }),
  expectedIntegrationId: required("--integration-id"),
  expectedResultSha256: required("--result-sha256"),
  expectedSelectionFileSha256: required("--selection-file-sha256"),
  expectedSelectionPayloadSha256: required("--selection-payload-sha256"),
  integrationOwnedPaths: Array.isArray(result.generatedFiles)
    ? result.generatedFiles.filter(
        (path): path is string => typeof path === "string",
      )
    : [],
  integrationResultContent: resultContent,
  selectionContent: readFileSync(required("--selection"), "utf8"),
  stateRoot: ".",
});
if (route.ownerTaskIds.length === 0) {
  throw new Error("owner rework gate found no task owners");
}
process.stdout.write(
  `${JSON.stringify(
    {
      findingSha256: route.findingSha256,
      integrationId: required("--integration-id"),
      ownerTaskIds: route.ownerTaskIds,
      resultSha256: route.resultSha256,
      selectionFileSha256: route.selectionFileSha256,
      selectionPayloadSha256: route.selectionPayloadSha256,
    },
    null,
    2,
  )}\n`,
);
