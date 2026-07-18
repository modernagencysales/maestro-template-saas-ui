import { createHash } from "node:crypto";

import { record, string } from "./integration-check-support.js";
import {
  SUPERSEDED_LANE_RESTORATION_SCHEMA,
  type SupersededLaneRestorationReceipt,
} from "./superseded-lane-restoration.js";
import {
  type SupersededWaveEvidence,
  validateSupersededWaveEvidence,
} from "./superseded-wave-evidence.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const digest = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
  return parsed;
};

export const validateAppliedSupersededLaneRestoration = (input: {
  readonly currentControlHead: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly lanes: readonly {
    readonly content: string;
    readonly taskId: string;
  }[];
  readonly receipt: unknown;
  readonly wave: SupersededWaveEvidence;
}): SupersededLaneRestorationReceipt => {
  const current = validateSupersededWaveEvidence(input);
  const receipt = record(input.receipt, "lane restoration receipt");
  if (!Array.isArray(receipt.tasks)) {
    throw new Error("lane restoration receipt tasks must be an array");
  }
  const tasks = receipt.tasks.map((value, index) => {
    const task = record(value, `restoration tasks[${index}]`);
    return {
      integratedLaneResultSha256: digest(
        task.integratedLaneResultSha256,
        `restoration tasks[${index}].integratedLaneResultSha256`,
      ),
      ...(typeof task.priorIntegrationId === "string"
        ? { priorIntegrationId: task.priorIntegrationId }
        : {}),
      restoredLaneResultSha256: digest(
        task.restoredLaneResultSha256,
        `restoration tasks[${index}].restoredLaneResultSha256`,
      ),
      taskId: string(task.taskId, `restoration tasks[${index}].taskId`),
    };
  });
  const payload = {
    integrationHeadSha: current.headSha,
    integrationId: input.wave.integrationId,
    schemaVersion: SUPERSEDED_LANE_RESTORATION_SCHEMA,
    selectionFileSha256: current.selectionFileSha256,
    selectionPayloadSha256: current.selectionPayloadSha256,
    status: "restored" as const,
    supersessionReceiptSha256: current.supersession.receiptSha256,
    tasks,
  };
  const expected = {
    ...payload,
    receiptSha256: sha256(JSON.stringify(payload)),
  } satisfies SupersededLaneRestorationReceipt;
  if (JSON.stringify(receipt) !== JSON.stringify(expected)) {
    throw new Error("lane restoration receipt identity or digest mismatch");
  }
  const lanes = new Map(input.lanes.map((lane) => [lane.taskId, lane.content]));
  if (
    lanes.size !== input.lanes.length ||
    JSON.stringify([...lanes.keys()].sort()) !==
      JSON.stringify(tasks.map((task) => task.taskId).sort())
  ) {
    throw new Error("restored lane task binding mismatch");
  }
  for (const task of tasks) {
    const content = lanes.get(task.taskId);
    if (!content || sha256(content) !== task.restoredLaneResultSha256) {
      throw new Error(`${task.taskId}: restored lane drift after receipt`);
    }
  }
  return expected;
};
