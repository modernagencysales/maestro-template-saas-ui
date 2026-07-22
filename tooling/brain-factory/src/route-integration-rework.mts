import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import { runRtk } from "./process.js";
import {
  executeIntegrationOwnerReworkRoute,
  planIntegrationOwnerReworkRoute,
  type OwnerReworkRoutingReceipt,
} from "./route-integration-rework.js";

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
const runRecordPath = resolve(
  stateRoot,
  "runs",
  `integration-${integrationId}.json`,
);
if (
  !existsSync(selectionPath) ||
  !existsSync(resultPath) ||
  !existsSync(runRecordPath)
) {
  throw new Error(`${integrationId}: selection or result is missing`);
}
const integrationResultContent = readFileSync(resultPath, "utf8");
const runRecord = JSON.parse(readFileSync(runRecordPath, "utf8")) as {
  readonly workdir?: unknown;
};
const expectedHeadSha = runRtk(
  ["proxy", "git", "-C", String(runRecord.workdir ?? ""), "rev-parse", "HEAD"],
  { quiet: true },
);
const parsed = JSON.parse(integrationResultContent) as {
  readonly generatedFiles?: unknown;
};
const integrationOwnedPaths = Array.isArray(parsed.generatedFiles)
  ? parsed.generatedFiles.filter(
      (path): path is string => typeof path === "string",
    )
  : [];
const route = planIntegrationOwnerReworkRoute({
  expectedHeadSha,
  expectedIntegrationId: integrationId,
  expectedResultSha256,
  expectedSelectionFileSha256,
  expectedSelectionPayloadSha256,
  integrationOwnedPaths,
  integrationResultContent,
  selectionContent: readFileSync(selectionPath, "utf8"),
  stateRoot,
});
const receiptPath = resolve(
  stateRoot,
  "evidence",
  "integration",
  integrationId,
  "owner-rework-routing.json",
);
const commandForOwner = new Map(
  route.ownerTaskIds.map((taskId, index) => [
    taskId,
    route.commands[index + 1],
  ]),
);
const receipt = executeIntegrationOwnerReworkRoute(route, {
  loadReceipt: () =>
    existsSync(receiptPath)
      ? (JSON.parse(
          readFileSync(receiptPath, "utf8"),
        ) as OwnerReworkRoutingReceipt)
      : undefined,
  reopen: (owner) => {
    const command = commandForOwner.get(owner.taskId);
    if (!command) throw new Error(`${owner.taskId}: reopen command is missing`);
    runRtk(command);
  },
  reservationFor: (taskId) => {
    const path = resolve(stateRoot, "runs", `${taskId}.json`);
    if (!existsSync(path)) return undefined;
    const record = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    return record.taskId === taskId &&
      record.mode === "contract-reproof" &&
      record.status === "launched" &&
      typeof record.ownerFindingsSha256 === "string" &&
      typeof record.requestSha256 === "string" &&
      typeof record.runId === "string"
      ? {
          findingsSha256: record.ownerFindingsSha256,
          requestSha256: record.requestSha256,
          runId: record.runId,
        }
      : undefined;
  },
  saveReceipt: (value) => {
    mkdirSync(resolve(receiptPath, ".."), { recursive: true });
    const temporary = `${receiptPath}.next`;
    const content = `${JSON.stringify(value, null, 2)}\n`;
    if (existsSync(temporary)) {
      if (readFileSync(temporary, "utf8") !== content) {
        throw new Error("pending owner routing receipt transition conflicts");
      }
    } else {
      writeFileSync(temporary, content, { flag: "wx" });
    }
    renameSync(temporary, receiptPath);
  },
  supersede: () => {
    const command = route.commands[0];
    if (!command) throw new Error("supersession command is missing");
    runRtk(command);
  },
});
process.stdout.write(`${JSON.stringify({ receipt, route }, null, 2)}\n`);
