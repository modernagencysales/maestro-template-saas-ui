import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { authoritativeIntegrationResultBindsLane } from "./integration-authority.js";
import { record, type JsonRecord } from "./integration-check-support.js";

const SHA = /^[0-9a-f]{40}$/;
const admittedLaneStatuses = new Set(["lane_green", "integrated", "accepted"]);

export const resolveIntegratedPrerequisiteTaskIds = (input: {
  readonly controlHeadSha: string;
  readonly evidence: string;
  readonly isAncestor: (headSha: string, controlHeadSha: string) => boolean;
  readonly requiredTasks: readonly {
    readonly taskId: string;
    readonly tranche: string;
  }[];
}): readonly string[] => {
  const integrationRoot = resolve(input.evidence, "integration");
  if (!existsSync(integrationRoot)) return [];
  const results = readdirSync(integrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => resolve(integrationRoot, entry.name));
  const admitted: string[] = [];
  for (const required of input.requiredTasks) {
    const lanePath = resolve(
      input.evidence,
      "lane-results",
      required.taskId,
      "lane-result.json",
    );
    if (!existsSync(lanePath)) continue;
    let lane: JsonRecord;
    try {
      lane = record(JSON.parse(readFileSync(lanePath, "utf8")), "lane result");
    } catch {
      continue;
    }
    if (
      lane.schemaVersion !== "maestro-brain-lane-result/v1" ||
      lane.taskId !== required.taskId ||
      !admittedLaneStatuses.has(String(lane.status)) ||
      typeof lane.headSha !== "string" ||
      !SHA.test(lane.headSha) ||
      (typeof lane.tranche === "string" && lane.tranche !== required.tranche)
    )
      continue;
    const binds = results.some((resultDirectory) => {
      if (existsSync(resolve(resultDirectory, "supersession.json")))
        return false;
      const resultPath = resolve(resultDirectory, "integration-result.json");
      if (!existsSync(resultPath)) return false;
      let result: JsonRecord;
      try {
        result = record(
          JSON.parse(readFileSync(resultPath, "utf8")),
          `${basename(resultDirectory)}: integration result`,
        );
      } catch {
        return false;
      }
      if (
        typeof result.headSha !== "string" ||
        !SHA.test(result.headSha) ||
        !input.isAncestor(result.headSha, input.controlHeadSha)
      )
        return false;
      return authoritativeIntegrationResultBindsLane({
        integrationHeadSha: result.headSha,
        integrationId: basename(resultDirectory),
        laneHeadSha: lane.headSha as string,
        result,
        resultDirectory,
        taskId: required.taskId,
        taskTranche: required.tranche,
      });
    });
    if (binds) admitted.push(required.taskId);
  }
  return admitted.sort();
};
