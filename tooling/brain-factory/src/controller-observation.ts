import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  completedTaskIdsForControlHead,
  normalizeControllerSnapshot,
  type ControllerSnapshot,
  type ControllerSnapshotInput,
  type ControllerTaskObservation,
  type ControllerWaveObservation,
} from "./factory-state.js";
import { readIntegrationWaveSelection } from "./integration-wave.js";
import { validateIntegrationWaveSupersessionReceipt } from "./integration-wave-supersession.js";
import { validateLaneAcceptance } from "./lane-acceptance.js";
import { validateFinalLaneResult } from "./lane-result.js";
import type { BrainTaskManifest } from "./manifest.js";
import { gitIsAncestor, runRtk } from "./process.js";
import { planIntegrationOwnerReworkRoute } from "./route-integration-rework.js";

type JsonRecord = Record<string, unknown>;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
};

const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

const jsonFile = (path: string): JsonRecord | undefined =>
  existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as JsonRecord)
    : undefined;

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() === value && value.length > 0
    ? value
    : undefined;

const exactSha = (value: unknown, length: 40 | 64): value is string =>
  typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);

const terminalStatuses = new Set([
  "canceled",
  "cancelled",
  "failed",
  "succeeded",
]);

const gateQueueObservation = (lockDirectory: string) => {
  const configured = Number(process.env.HOST_TEST_FOCUSED_SLOTS ?? "2");
  const capacity =
    Number.isSafeInteger(configured) && configured > 0 ? configured : 2;
  if (!existsSync(lockDirectory)) return { capacity, inUse: 0, waiting: 0 };
  const lockIsActive = (name: string): boolean => {
    const content = readFileSync(join(lockDirectory, name), "utf8");
    const pid = Number(/\bpid=(\d+)/.exec(content)?.[1]);
    if (!Number.isSafeInteger(pid) || pid < 1) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const names = readdirSync(lockDirectory);
  const full = names.some(
    (name) =>
      name === "global-test-gate.lock" &&
      lockIsActive(name) &&
      /class=full/.test(readFileSync(join(lockDirectory, name), "utf8")),
  );
  const focused = names.filter(
    (name) => /^focused-\d+\.lock$/.test(name) && lockIsActive(name),
  ).length;
  return {
    capacity,
    inUse: full ? capacity : Math.min(capacity, focused),
    waiting: 0,
  };
};

const laneAdmission = (input: {
  readonly controlHeadSha: string;
  readonly controlRoot: string;
  readonly directory: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly manifest: BrainTaskManifest;
  readonly task: BrainTaskManifest["tasks"][number];
}): {
  readonly admission: "admissible" | "rejected";
  readonly headSha?: string;
} => {
  const lane = jsonFile(join(input.directory, "lane-result.json"));
  const proof = jsonFile(join(input.directory, "ci-proof-packet.json"));
  const gate = jsonFile(join(input.directory, "lane-gate-report.json"));
  const headSha = stringValue(lane?.headSha);
  const treeSha = stringValue(lane?.treeSha);
  if (!lane || !proof || !gate || !headSha || !treeSha) {
    return { admission: "rejected", ...(headSha ? { headSha } : {}) };
  }
  try {
    validateFinalLaneResult(lane, {
      currentHeadSha: headSha,
      currentTreeSha: treeSha,
      finalGateReport: gate,
      proof,
      taskId: input.task.taskId,
    });
    if (
      proof.planSha256 !== input.manifest.planSha256 ||
      proof.taskBlockHash !== input.task.taskBlockHash
    ) {
      throw new Error("lane authority drift");
    }
    const baseSha = stringValue(proof.baseSha);
    if (
      !baseSha ||
      !input.isAncestor(baseSha, headSha) ||
      !input.isAncestor(baseSha, input.controlHeadSha)
    ) {
      throw new Error("lane ancestry drift");
    }
    const changed = runRtk(
      [
        "proxy",
        "git",
        "diff",
        "--no-renames",
        "--name-only",
        `${baseSha}..${headSha}`,
      ],
      { cwd: input.controlRoot, quiet: true },
    )
      .split("\n")
      .filter(Boolean);
    const locks = new Set(input.task.fileLocks);
    if (changed.some((path) => !locks.has(path))) {
      throw new Error("lane changed paths outside locks");
    }
    return { admission: "admissible", headSha };
  } catch {
    return { admission: "rejected", headSha };
  }
};

export interface ControllerObservationInput {
  readonly controlHeadSha?: string;
  readonly controlRoot: string;
  readonly gateLockDirectory?: string;
  readonly inspect: (runId: string) => string | undefined;
  readonly isAncestor?: (ancestor: string, descendant: string) => boolean;
  readonly manifest: BrainTaskManifest;
  readonly stateRoot: string;
}

export const observeControllerSnapshot = (
  input: ControllerObservationInput,
): ControllerSnapshot => {
  const controlHeadSha =
    input.controlHeadSha ??
    runRtk(["proxy", "git", "rev-parse", "HEAD"], {
      cwd: input.controlRoot,
      quiet: true,
    });
  const isAncestor =
    input.isAncestor ??
    ((ancestor: string, descendant: string) =>
      gitIsAncestor(ancestor, descendant, input.controlRoot));
  const evidenceRoot = join(input.stateRoot, "evidence");
  const runsRoot = join(input.stateRoot, "runs");
  const providerErrors: Array<
    ControllerSnapshotInput["providerErrors"][number]
  > = [];
  const inspect = (runId: string): string | undefined => {
    try {
      const status = input.inspect(runId);
      if (!status) throw new Error("missing status");
      return status;
    } catch {
      if (!providerErrors.some(({ provider }) => provider === "fabro")) {
        providerErrors.push({ category: "unavailable", provider: "fabro" });
      }
      return undefined;
    }
  };

  const tasks: ControllerTaskObservation[] = input.manifest.tasks.map(
    (task) => {
      const taskId = task.taskId;
      const directory = join(evidenceRoot, "lane-results", taskId);
      const lane = jsonFile(join(directory, "lane-result.json"));
      if (lane?.status === "integrated" || lane?.status === "accepted") {
        try {
          validateLaneAcceptance(lane, taskId);
          const completed = completedTaskIdsForControlHead({
            controlHead: controlHeadSha,
            isAncestor,
            resultFor: () => lane,
            taskIds: [taskId],
          });
          if (completed.has(taskId)) {
            return { status: lane.status, taskId } as ControllerTaskObservation;
          }
        } catch {
          return { status: "unknown", taskId };
        }
      }

      const reservation = jsonFile(join(runsRoot, `${taskId}.json`));
      const runId = stringValue(reservation?.runId);
      if (
        reservation &&
        (reservation.taskId !== taskId ||
          !exactSha(reservation.baseSha, 40) ||
          !stringValue(reservation.branch) ||
          !stringValue(reservation.workdir))
      ) {
        return { ...(runId ? { runId } : {}), status: "unknown", taskId };
      }
      if (reservation?.status === "preparing") {
        return { ...(runId ? { runId } : {}), status: "preparing", taskId };
      }
      if (reservation?.status === "launched") {
        if (!runId) return { status: "unknown", taskId };
        const status = inspect(runId);
        if (!status) return { runId, status: "unknown", taskId };
        if (terminalStatuses.has(status)) {
          return { runId, status: "terminal", taskId };
        }
        return { runId, status: "running", taskId };
      }
      if (reservation) return { status: "unknown", taskId };

      if (lane?.status === "lane_green") {
        const admission = laneAdmission({
          controlHeadSha,
          controlRoot: input.controlRoot,
          directory,
          isAncestor,
          manifest: input.manifest,
          task,
        });
        return {
          admission: admission.admission,
          ...(admission.headSha ? { headSha: admission.headSha } : {}),
          status: "lane_green",
          taskId,
        };
      }

      const proof = jsonFile(join(directory, "ci-proof-packet.json"));
      const baseSha = stringValue(proof?.baseSha);
      const headSha = stringValue(proof?.headSha);
      if (
        proof?.taskId === taskId &&
        proof.taskBlockHash === task.taskBlockHash &&
        proof.planSha256 === input.manifest.planSha256 &&
        proof.reviewVerdict === "rework" &&
        proof.reviewHeadSha === headSha &&
        exactSha(baseSha, 40) &&
        exactSha(headSha, 40) &&
        Array.isArray(proof.reviewFindings) &&
        proof.reviewFindings.length > 0
      ) {
        return {
          baseSha,
          findingSha256: sha256(canonicalJson(proof.reviewFindings)),
          headSha,
          status: "failed",
          taskId,
        };
      }
      if (lane || proof) return { status: "unknown", taskId };
      return { status: "pending", taskId };
    },
  );

  const waves: ControllerWaveObservation[] = [];
  if (existsSync(runsRoot)) {
    for (const name of readdirSync(runsRoot).sort()) {
      const integrationId = /^integration-(wave-\d{6})\.json$/.exec(name)?.[1];
      if (!integrationId) continue;
      const recordPath = join(runsRoot, name);
      const recordContent = readFileSync(recordPath, "utf8");
      const record = JSON.parse(recordContent) as JsonRecord;
      const runId = stringValue(record?.runId);
      const baseSha = stringValue(record?.baseSha);
      const ownershipId = stringValue(record?.reservationToken);
      const selectionPath = resolve(
        runsRoot,
        `integration-${integrationId}-selection.json`,
      );
      const evidence = join(evidenceRoot, "integration", integrationId);
      const promotion = jsonFile(join(evidence, "promotion.json"));
      const supersession = jsonFile(join(evidence, "supersession.json"));
      try {
        if (
          record?.integrationId !== integrationId ||
          record.status !== "launched" ||
          !runId ||
          !exactSha(baseSha, 40) ||
          !ownershipId ||
          !existsSync(selectionPath)
        ) {
          throw new Error("wave record drift");
        }
        const selectionContent = readFileSync(selectionPath, "utf8");
        const selection = readIntegrationWaveSelection(selectionContent);
        if (
          selection.selection.integrationId !== integrationId ||
          selection.selection.baseSha !== baseSha
        ) {
          throw new Error("wave selection drift");
        }
        if (promotion || supersession) {
          if (promotion && supersession) {
            throw new Error("ambiguous wave resolution");
          }
          if (promotion) {
            if (
              !new Set([
                "maestro-brain-integration-wave-promotion/v2",
                "maestro-brain-integration-wave-promotion/v3",
              ]).has(String(promotion.schemaVersion)) ||
              promotion.integrationId !== integrationId ||
              promotion.status !== "promoted" ||
              promotion.baseSha !== baseSha ||
              !exactSha(promotion.headSha, 40) ||
              !isAncestor(promotion.headSha, controlHeadSha)
            ) {
              throw new Error("promotion receipt drift");
            }
            continue;
          }
          validateIntegrationWaveSupersessionReceipt({
            currentControlHead: controlHeadSha,
            expectedIntegrationId: integrationId,
            isAncestor,
            receipt: supersession,
            runRecordContent: recordContent,
            selectionContent,
            selectionPath,
          });
          continue;
        }
        const status = inspect(runId);
        const inspection =
          status === "succeeded"
            ? "succeeded"
            : status && terminalStatuses.has(status)
              ? "failed"
              : status
                ? "running"
                : "unknown";
        const resultPath = join(evidence, "integration-result.json");
        const resultContent = existsSync(resultPath)
          ? readFileSync(resultPath, "utf8")
          : undefined;
        const result = resultContent
          ? (JSON.parse(resultContent) as JsonRecord)
          : undefined;
        if (
          resultContent &&
          (inspection === "succeeded" || inspection === "failed") &&
          result?.status === "ready_for_review" &&
          result.reviewVerdict === "rework"
        ) {
          const generatedFiles = Array.isArray(result.generatedFiles)
            ? result.generatedFiles.filter(
                (path): path is string => typeof path === "string",
              )
            : [];
          const route = planIntegrationOwnerReworkRoute({
            expectedIntegrationId: integrationId,
            expectedResultSha256: sha256(resultContent),
            expectedSelectionFileSha256: selection.selectionFileSha256,
            expectedSelectionPayloadSha256: selection.selectionPayloadSha256,
            integrationOwnedPaths: generatedFiles,
            integrationResultContent: resultContent,
            selectionContent,
            stateRoot: input.stateRoot,
          });
          const resultHead = stringValue(result.headSha);
          if (!resultHead)
            throw new Error("owner rework result head is missing");
          waves.push({
            findingSha256: route.findingSha256,
            headSha: resultHead,
            identity: "exact",
            inspection,
            integrationId,
            ownerTaskIds: route.ownerTaskIds,
            ownershipId,
            resultSha256: route.resultSha256,
            runId,
            selectionFileSha256: route.selectionFileSha256,
            selectionPayloadSha256: route.selectionPayloadSha256,
          });
          continue;
        }
        const resultHead = stringValue(result?.headSha);
        const exact =
          inspection !== "succeeded" ||
          (result?.integrationId === integrationId &&
            result.status === "passed" &&
            exactSha(resultHead, 40));
        const headSha =
          inspection === "succeeded" && exact ? resultHead : baseSha;
        waves.push({
          ...(headSha ? { headSha } : {}),
          identity: exact ? "exact" : "unknown",
          inspection,
          integrationId,
          ownershipId,
          runId,
        });
      } catch {
        waves.push({
          identity: "unknown",
          inspection: "unknown",
          integrationId,
        });
      }
    }
  }

  return normalizeControllerSnapshot({
    controlHeadSha,
    gateQueue: gateQueueObservation(
      input.gateLockDirectory ??
        process.env.HOST_TEST_LOCK_DIR ??
        "/tmp/headless-heavy-test-slots",
    ),
    manifestSha256: sha256(canonicalJson(input.manifest)),
    planSha256: input.manifest.planSha256,
    providerErrors,
    tasks,
    waves,
  });
};

export const inspectFabroRun = (runId: string): string | undefined => {
  const parsed = JSON.parse(
    runRtk(["fabro", "inspect", runId, "--json", "--quiet"], {
      quiet: true,
    }),
  ) as
    | { status?: { kind?: string } | string }
    | readonly { status?: { kind?: string } | string }[];
  const item = Array.isArray(parsed) ? parsed[0] : parsed;
  return typeof item?.status === "string" ? item.status : item?.status?.kind;
};
