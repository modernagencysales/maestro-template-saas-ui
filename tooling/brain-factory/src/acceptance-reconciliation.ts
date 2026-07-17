import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import type { BroadGateReceipt } from "./integration-broad-gate.js";
import { validateBroadGateReceipt } from "./integration-broad-gate.js";
import { validateLaneAcceptance } from "./lane-acceptance.js";
import type { BrainTaskContract, BrainTaskManifest } from "./manifest.js";

type JsonRecord = Record<string, unknown>;

export const ACCEPTANCE_RECEIPT_SCHEMA =
  "maestro-brain-acceptance-reconciliation/v1" as const;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const record = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const exactSha = (value: unknown, label: string): string => {
  const result = string(value, label);
  if (!/^[0-9a-f]{40}$/.test(result)) throw new Error(`${label} is not a SHA`);
  return result;
};

const safeSegment = (value: string, label: string): string => {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`${label} is not a safe path segment`);
  }
  return value;
};

export const acceptancePrerequisiteIds = (
  task: BrainTaskContract,
  tasks: readonly BrainTaskContract[],
): readonly string[] => {
  const expression = task.acceptanceAfter.trim();
  if (expression === "none") return [];
  if (expression === "all prior tasks") {
    const index = tasks.findIndex(
      (candidate) => candidate.taskId === task.taskId,
    );
    if (index < 0) throw new Error(`${task.taskId}: absent from task manifest`);
    return tasks.slice(0, index).map((candidate) => candidate.taskId);
  }

  const tokens = expression
    .replace(/\bcomplete\b/g, "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const ids = new Set<string>();
  for (const token of tokens) {
    if (/^S\d{2}-T\d{2}$/.test(token)) {
      if (!tasks.some((candidate) => candidate.taskId === token)) {
        throw new Error(`${task.taskId}: unknown acceptance task ${token}`);
      }
      ids.add(token);
      continue;
    }
    if (/^S\d{2}$/.test(token)) {
      const stageIds = tasks
        .filter((candidate) => candidate.taskId.startsWith(`${token}-`))
        .map((candidate) => candidate.taskId);
      if (stageIds.length === 0) {
        throw new Error(`${task.taskId}: unknown acceptance stage ${token}`);
      }
      for (const taskId of stageIds) ids.add(taskId);
      continue;
    }
    throw new Error(
      `${task.taskId}: unsupported acceptance prerequisite ${JSON.stringify(token)}`,
    );
  }
  return [...ids].sort();
};

export interface AcceptanceEvidenceAnchor {
  readonly archiveContentSha256?: string;
  readonly archivedLaneResultSha256?: string;
  readonly evidenceContentSha256: string;
  readonly evidenceKind: "external-lane-result" | "integration-archive";
  readonly integrationHeadSha?: string;
  readonly integrationId?: string;
  readonly laneHeadSha: string;
  readonly taskId: string;
}

export interface AcceptanceReceiptTask extends AcceptanceEvidenceAnchor {
  readonly acceptanceAfter: string;
  readonly prerequisiteTaskIds: readonly string[];
}

export interface AcceptanceReceipt {
  readonly acceptedTasks: readonly AcceptanceReceiptTask[];
  readonly broadGate: {
    readonly command: string;
    readonly headSha: string;
    readonly receiptSha256: string;
  };
  readonly planSha256: string;
  readonly productReleaseCommit: string;
  readonly schemaVersion: typeof ACCEPTANCE_RECEIPT_SCHEMA;
}

export const planAcceptanceReceipt = (input: {
  readonly anchors: ReadonlyMap<string, AcceptanceEvidenceAnchor>;
  readonly broadGateReceiptSha256: string;
  readonly controlHead: string;
  readonly manifest: BrainTaskManifest;
}): AcceptanceReceipt => {
  const accepted = new Set<string>();
  const acceptedTasks: AcceptanceReceiptTask[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of input.manifest.tasks) {
      if (accepted.has(task.taskId)) continue;
      const anchor = input.anchors.get(task.taskId);
      if (!anchor) continue;
      const prerequisites = acceptancePrerequisiteIds(
        task,
        input.manifest.tasks,
      );
      if (!prerequisites.every((taskId) => accepted.has(taskId))) continue;
      accepted.add(task.taskId);
      acceptedTasks.push({
        ...anchor,
        acceptanceAfter: task.acceptanceAfter,
        prerequisiteTaskIds: prerequisites,
      });
      changed = true;
    }
  }
  acceptedTasks.sort((left, right) => left.taskId.localeCompare(right.taskId));
  if (acceptedTasks.length === 0) {
    throw new Error(
      "no task has complete acceptance prerequisites and evidence",
    );
  }
  return {
    acceptedTasks,
    broadGate: {
      command: "rtk host-test-slot --class full pnpm verify",
      headSha: input.controlHead,
      receiptSha256: input.broadGateReceiptSha256,
    },
    planSha256: input.manifest.planSha256,
    productReleaseCommit: input.controlHead,
    schemaVersion: ACCEPTANCE_RECEIPT_SCHEMA,
  };
};

const archiveAnchor = (input: {
  readonly evidenceDirectory: string;
  readonly integrationId: string;
  readonly laneResult: JsonRecord;
  readonly planSha256: string;
  readonly task: BrainTaskContract;
}): AcceptanceEvidenceAnchor => {
  const taskId = input.task.taskId;
  const integrationId = safeSegment(input.integrationId, "integrationId");
  const archiveDirectory = resolve(
    input.evidenceDirectory,
    "archive",
    integrationId,
  );
  const manifestPath = resolve(archiveDirectory, "archive-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`${taskId}: immutable integration archive is missing`);
  }
  const archiveManifest = record(
    JSON.parse(readFileSync(manifestPath, "utf8")),
    `${integrationId} archive manifest`,
  );
  const contentSha256 = string(
    archiveManifest.contentSha256,
    `${integrationId} archive content hash`,
  );
  if (!/^[0-9a-f]{64}$/.test(contentSha256)) {
    throw new Error(`${integrationId}: archive content hash is invalid`);
  }
  const artifactFile = string(
    archiveManifest.artifactFile,
    `${integrationId} archive artifact`,
  );
  if (
    archiveManifest.schemaVersion !==
      "maestro-brain-evidence-archive-manifest/v1" ||
    archiveManifest.integrationId !== integrationId ||
    artifactFile !== `${contentSha256}.json`
  ) {
    throw new Error(`${integrationId}: archive manifest identity mismatch`);
  }
  const artifactPath = resolve(archiveDirectory, artifactFile);
  const artifactContent = readFileSync(artifactPath, "utf8");
  if (sha256(artifactContent) !== contentSha256) {
    throw new Error(`${integrationId}: archive artifact hash mismatch`);
  }
  const archive = record(
    JSON.parse(artifactContent),
    `${integrationId} archive`,
  );
  const integrationResult = record(
    archive.integrationResult,
    `${integrationId} integration result`,
  );
  const integrationHeadSha = exactSha(
    input.laneResult.integrationHeadSha,
    `${taskId} integration head`,
  );
  if (
    archive.schemaVersion !== "maestro-brain-evidence-archive/v1" ||
    archive.integrationId !== integrationId ||
    integrationResult.integrationId !== integrationId ||
    integrationResult.planSha256 !== input.planSha256 ||
    integrationResult.headSha !== integrationHeadSha ||
    integrationResult.status !== "passed" ||
    integrationResult.reviewVerdict !== "pass" ||
    !Array.isArray(integrationResult.remainingFindings) ||
    integrationResult.remainingFindings.length !== 0
  ) {
    throw new Error(`${taskId}: archived integration verdict is invalid`);
  }
  const broadGate = record(
    integrationResult.broadGate,
    `${integrationId} archived broad gate`,
  );
  if (
    broadGate.status !== "passed" ||
    broadGate.headSha !== integrationHeadSha ||
    broadGate.command !== "rtk host-test-slot --class full pnpm verify"
  ) {
    throw new Error(`${taskId}: archived integration broad gate is invalid`);
  }
  if (!Array.isArray(integrationResult.selectedTasks)) {
    throw new Error(`${taskId}: archived selection provenance is missing`);
  }
  const selectedTask = integrationResult.selectedTasks
    .map((value, index) => record(value, `selectedTasks[${index}]`))
    .find((value) => value.taskId === taskId);
  if (selectedTask?.taskBlockHash !== input.task.taskBlockHash) {
    throw new Error(`${taskId}: archived task contract is stale`);
  }
  if (!Array.isArray(archive.laneEvidence)) {
    throw new Error(`${integrationId}: archived lane evidence is missing`);
  }
  const laneEntry = archive.laneEvidence
    .map((value, index) => record(value, `laneEvidence[${index}]`))
    .find((value) => value.taskId === taskId);
  if (!laneEntry) {
    throw new Error(`${taskId}: absent from immutable integration archive`);
  }
  const archivedResult = record(
    laneEntry.result,
    `${taskId} archived lane result`,
  );
  const laneHeadSha = exactSha(input.laneResult.headSha, `${taskId} lane head`);
  validateLaneAcceptance(archivedResult, taskId);
  if (
    archivedResult.taskId !== taskId ||
    archivedResult.integrationId !== integrationId ||
    archivedResult.integrationHeadSha !== integrationHeadSha ||
    archivedResult.headSha !== laneHeadSha ||
    input.laneResult.integrationId !== integrationId
  ) {
    throw new Error(`${taskId}: lane and archive identity mismatch`);
  }
  return {
    archiveContentSha256: contentSha256,
    archivedLaneResultSha256: sha256(
      `${JSON.stringify(archivedResult, null, 2)}\n`,
    ),
    evidenceContentSha256: contentSha256,
    evidenceKind: "integration-archive",
    integrationHeadSha,
    integrationId,
    laneHeadSha,
    taskId,
  };
};

export const collectAcceptanceAnchors = (input: {
  readonly controlHead: string;
  readonly evidenceDirectory: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly manifest: BrainTaskManifest;
}): ReadonlyMap<string, AcceptanceEvidenceAnchor> => {
  const anchors = new Map<string, AcceptanceEvidenceAnchor>();
  for (const task of input.manifest.tasks) {
    if (task.kind === "release") continue;
    const lanePath = resolve(
      input.evidenceDirectory,
      "lane-results",
      safeSegment(task.taskId, "taskId"),
      "lane-result.json",
    );
    if (!existsSync(lanePath)) continue;
    const laneContent = readFileSync(lanePath, "utf8");
    const lane = record(JSON.parse(laneContent), lanePath);
    if (task.kind === "external") {
      if (lane.status !== "accepted") continue;
      validateLaneAcceptance(lane, task.taskId);
      const laneHeadSha = exactSha(lane.headSha, `${task.taskId} lane head`);
      if (!input.isAncestor(laneHeadSha, input.controlHead)) {
        throw new Error(
          `${task.taskId}: external acceptance head is not an ancestor of the acceptance head`,
        );
      }
      anchors.set(task.taskId, {
        evidenceContentSha256: sha256(laneContent),
        evidenceKind: "external-lane-result",
        laneHeadSha,
        taskId: task.taskId,
      });
      continue;
    }
    if (lane.status !== "integrated" && lane.status !== "accepted") continue;
    validateLaneAcceptance(lane, task.taskId);
    const integrationHeadSha = exactSha(
      lane.integrationHeadSha,
      `${task.taskId} integration head`,
    );
    if (!input.isAncestor(integrationHeadSha, input.controlHead)) {
      throw new Error(
        `${task.taskId}: integration head is not an ancestor of the acceptance head`,
      );
    }
    anchors.set(
      task.taskId,
      archiveAnchor({
        evidenceDirectory: input.evidenceDirectory,
        integrationId: string(
          lane.integrationId,
          `${task.taskId} integration ID`,
        ),
        laneResult: lane,
        planSha256: input.manifest.planSha256,
        task,
      }),
    );
  }
  return anchors;
};

export const writeAcceptanceReceipt = (input: {
  readonly evidenceDirectory: string;
  readonly receipt: AcceptanceReceipt;
}): { readonly contentSha256: string; readonly path: string } => {
  const content = `${JSON.stringify(input.receipt, null, 2)}\n`;
  const contentSha256 = sha256(content);
  const directory = resolve(input.evidenceDirectory, "acceptance", "receipts");
  const path = resolve(directory, `${contentSha256}.json`);
  mkdirSync(directory, { recursive: true });
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== content) {
      throw new Error("content-addressed acceptance receipt drift");
    }
  } else {
    writeFileSync(path, content, { flag: "wx" });
  }
  return { contentSha256, path };
};

export const reconcileAcceptanceEvidence = (input: {
  readonly broadGatePath: string;
  readonly controlHead: string;
  readonly evidenceDirectory: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly manifest: BrainTaskManifest;
}): { readonly contentSha256: string; readonly path: string } => {
  const broadGateContent = readFileSync(input.broadGatePath, "utf8");
  const broadGate = JSON.parse(broadGateContent) as BroadGateReceipt;
  validateBroadGateReceipt(broadGate, input.controlHead);
  const receipt = planAcceptanceReceipt({
    anchors: collectAcceptanceAnchors(input),
    broadGateReceiptSha256: sha256(broadGateContent),
    controlHead: input.controlHead,
    manifest: input.manifest,
  });
  return writeAcceptanceReceipt({
    evidenceDirectory: input.evidenceDirectory,
    receipt,
  });
};

export const acceptanceReceiptFiles = (evidenceDirectory: string): string[] => {
  const directory = resolve(evidenceDirectory, "acceptance", "receipts");
  return existsSync(directory)
    ? readdirSync(directory)
        .filter((file) => /^[0-9a-f]{64}\.json$/.test(file))
        .sort()
    : [];
};
