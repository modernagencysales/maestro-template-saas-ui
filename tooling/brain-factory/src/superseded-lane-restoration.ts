import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import {
  record,
  string,
  type JsonRecord,
} from "./integration-check-support.js";
import {
  type SupersededWaveEvidence,
  type ValidatedSupersededWave,
  validateSupersededWaveEvidence,
} from "./superseded-wave-evidence.js";

export const SUPERSEDED_LANE_RESTORATION_SCHEMA =
  "maestro-brain-superseded-lane-restoration/v2" as const;

export interface SupersededLaneRestorationReceipt {
  readonly integrationHeadSha: string;
  readonly integrationId: string;
  readonly receiptSha256: string;
  readonly schemaVersion: typeof SUPERSEDED_LANE_RESTORATION_SCHEMA;
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
  readonly status: "restored";
  readonly supersessionReceiptSha256: string;
  readonly tasks: readonly {
    readonly integratedLaneResultSha256: string;
    readonly priorIntegrationId?: string;
    readonly restoredLaneResultSha256: string;
    readonly taskId: string;
  }[];
}

export interface SupersededLaneRestorationPlan {
  readonly lanes: readonly {
    readonly integratedContent: string;
    readonly restoredContent: string;
    readonly taskId: string;
  }[];
  readonly receipt: SupersededLaneRestorationReceipt;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const digest = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
  return parsed;
};

const exactJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

const removeIntegrationOverlay = (lane: JsonRecord): JsonRecord => {
  const restored: JsonRecord = { ...lane, status: "lane_green" };
  delete restored.integrationId;
  delete restored.integrationHeadSha;
  delete restored.preIntegrationLaneResultSha256;
  delete restored.laneResultSha256;
  delete restored.accepted;
  delete restored.acceptanceBlocker;
  delete restored.acceptedBecause;
  return restored;
};

const priorIntegrationOverlay = (input: {
  readonly lane: JsonRecord;
  readonly prior: ValidatedSupersededWave;
  readonly taskId: string;
}): JsonRecord => {
  const selected = input.prior.selection.selectedTasks.find(
    (task) => task.taskId === input.taskId,
  );
  const included = input.prior.resultTasks.get(input.taskId);
  if (!selected || !included) {
    throw new Error(`${input.taskId}: prior integration task binding mismatch`);
  }
  if (
    selected.headSha !== input.lane.headSha ||
    selected.proofSha256 !== input.lane.proofSha256 ||
    selected.gateSha256 !== input.lane.gateSha256 ||
    selected.taskBlockHash !== input.lane.taskBlockHash
  ) {
    throw new Error(
      `${input.taskId}: prior integration lane identity mismatch`,
    );
  }
  return {
    ...input.lane,
    status: "lane_green",
    laneResultSha256: selected.laneResultSha256,
    preIntegrationLaneResultSha256: selected.laneResultSha256,
    integrationId: input.prior.selection.integrationId,
    integrationHeadSha: input.prior.headSha,
    accepted: false,
    acceptanceBlocker: `Integrated in immutable wave ${input.prior.selection.integrationId}, but no acceptanceAfter evidence proves accepted:true for this lane result.`,
  };
};

export const planSupersededLaneRestoration = (input: {
  readonly currentControlHead: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly lanes: readonly {
    readonly content: string;
    readonly taskId: string;
  }[];
  readonly priorWave?: SupersededWaveEvidence;
  readonly wave: SupersededWaveEvidence;
}): SupersededLaneRestorationPlan => {
  const current = validateSupersededWaveEvidence(input);
  const prior = input.priorWave
    ? validateSupersededWaveEvidence({
        currentControlHead: input.currentControlHead,
        isAncestor: input.isAncestor,
        wave: input.priorWave,
      })
    : undefined;
  const laneByTask = new Map(input.lanes.map((lane) => [lane.taskId, lane]));
  if (
    laneByTask.size !== input.lanes.length ||
    JSON.stringify([...laneByTask.keys()].sort()) !==
      JSON.stringify(
        current.selection.selectedTasks.map((task) => task.taskId).sort(),
      )
  ) {
    throw new Error(`${input.wave.integrationId}: lane task binding mismatch`);
  }
  const lanes = current.selection.selectedTasks.map((selected) => {
    const source = laneByTask.get(selected.taskId);
    if (!source)
      throw new Error(`${selected.taskId}: lane task binding mismatch`);
    const lane = record(
      JSON.parse(source.content),
      `${selected.taskId}: lane result`,
    );
    const expectedPreIntegration = digest(
      lane.preIntegrationLaneResultSha256,
      `${selected.taskId}: pre-integration lane hash`,
    );
    if (expectedPreIntegration !== selected.laneResultSha256) {
      throw new Error(`${selected.taskId}: pre-integration lane hash mismatch`);
    }
    if (lane.integrationHeadSha !== current.headSha) {
      throw new Error(`${selected.taskId}: current integration head mismatch`);
    }
    if (
      lane.schemaVersion !== "maestro-brain-lane-result/v1" ||
      lane.taskId !== selected.taskId ||
      lane.status !== "integrated" ||
      lane.integrationId !== input.wave.integrationId ||
      lane.headSha !== selected.headSha ||
      lane.proofHeadSha !== selected.proofHeadSha ||
      lane.gateHeadSha !== selected.gateHeadSha ||
      lane.proofSha256 !== selected.proofSha256 ||
      lane.gateSha256 !== selected.gateSha256 ||
      lane.taskBlockHash !== selected.taskBlockHash ||
      lane.accepted !== false ||
      typeof lane.acceptanceBlocker !== "string" ||
      lane.acceptanceBlocker.trim() === "" ||
      Object.hasOwn(lane, "acceptedBecause")
    ) {
      throw new Error(
        `${selected.taskId}: current integrated lane fields mismatch`,
      );
    }
    const candidates = [removeIntegrationOverlay(lane)];
    if (prior) {
      candidates.push(
        priorIntegrationOverlay({ lane, prior, taskId: selected.taskId }),
      );
    }
    const matches = candidates
      .map(exactJson)
      .filter((content) => sha256(content) === expectedPreIntegration);
    if (matches.length !== 1 || !matches[0]) {
      throw new Error(
        `${selected.taskId}: reconstructed lane does not uniquely match pre-integration lane hash`,
      );
    }
    return {
      integratedContent: source.content,
      restoredContent: matches[0],
      taskId: selected.taskId,
    };
  });
  const tasks = lanes.map((lane) => ({
    integratedLaneResultSha256: sha256(lane.integratedContent),
    ...(prior ? { priorIntegrationId: prior.selection.integrationId } : {}),
    restoredLaneResultSha256: sha256(lane.restoredContent),
    taskId: lane.taskId,
  }));
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
  return {
    lanes,
    receipt: {
      ...payload,
      receiptSha256: sha256(JSON.stringify(payload)),
    },
  };
};

export const applySupersededLaneRestoration = (input: {
  readonly lanePaths: ReadonlyMap<string, string>;
  readonly plan: SupersededLaneRestorationPlan;
  readonly receiptPath: string;
}): "already-applied" | "applied" => {
  const receiptContent = exactJson(input.plan.receipt);
  if (existsSync(input.receiptPath)) {
    if (readFileSync(input.receiptPath, "utf8") !== receiptContent) {
      throw new Error(
        "immutable lane restoration receipt conflicts with existing receipt",
      );
    }
    for (const lane of input.plan.lanes) {
      const path = input.lanePaths.get(lane.taskId);
      if (!path || readFileSync(path, "utf8") !== lane.restoredContent) {
        throw new Error(`${lane.taskId}: restored lane drift after receipt`);
      }
    }
    return "already-applied";
  }
  for (const lane of input.plan.lanes) {
    const path = input.lanePaths.get(lane.taskId);
    if (!path) throw new Error(`${lane.taskId}: lane path is missing`);
    const current = readFileSync(path, "utf8");
    if (current === lane.restoredContent) continue;
    if (current !== lane.integratedContent) {
      throw new Error(
        `${lane.taskId}: lane changed after restoration planning`,
      );
    }
  }
  for (const lane of input.plan.lanes) {
    const path = input.lanePaths.get(lane.taskId);
    if (!path || readFileSync(path, "utf8") === lane.restoredContent) continue;
    const staged = `${path}.restore-next`;
    if (existsSync(staged)) {
      if (readFileSync(staged, "utf8") !== lane.restoredContent) {
        throw new Error(`${lane.taskId}: restoration staging file conflicts`);
      }
      rmSync(staged);
    }
    writeFileSync(staged, lane.restoredContent, { flag: "wx" });
    renameSync(staged, path);
  }
  writeFileSync(input.receiptPath, receiptContent, { flag: "wx" });
  return "applied";
};
