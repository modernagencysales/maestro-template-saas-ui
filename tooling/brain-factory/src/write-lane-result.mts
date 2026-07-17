import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { validateContractReproofRequest } from "./contract-reproof.js";
import { buildManifest } from "./manifest.js";
import { runRtk } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const taskId = valueAfter("--task");
const evidence = valueAfter("--evidence");
const reproofPath = valueAfter("--reproof-request");
if (!taskId || !evidence) {
  throw new Error(
    "usage: write-lane-result --task <id> --evidence <dir> [--reproof-request <path>]",
  );
}
const manifest = buildManifest();
const task = manifest.tasks.find((candidate) => candidate.taskId === taskId);
if (!task) throw new Error(`unknown task ${taskId}`);
const headSha = runRtk(["git", "rev-parse", "HEAD"], { quiet: true });
if (reproofPath && reproofPath !== "none" && !existsSync(reproofPath)) {
  throw new Error(`${taskId}: reproof request does not exist`);
}
const rawReproof =
  reproofPath && reproofPath !== "none"
    ? JSON.parse(readFileSync(reproofPath, "utf8"))
    : undefined;
const reproof = rawReproof
  ? validateContractReproofRequest(rawReproof, {
      controlHeadSha: String(rawReproof.controlHeadSha),
      planSha256: manifest.planSha256,
      taskBlockHash: task.taskBlockHash,
      taskId,
    })
  : undefined;
const result = {
  schemaVersion: "maestro-brain-lane-result/v1",
  taskId,
  headSha,
  tranche: task.tranche,
  status: "lane_green",
  ...(reproof
    ? {
        reproof: {
          requestPath: reproofPath,
          requestSha256: reproof.requestSha256,
          priorIntegrationHeadSha: reproof.priorIntegrationHeadSha,
          priorIntegrationId: reproof.priorIntegrationId,
        },
      }
    : {}),
};
writeFileSync(
  `${evidence}/lane-results/${taskId}/lane-result.json`,
  `${JSON.stringify(result, null, 2)}\n`,
);
