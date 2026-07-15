import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  commandsForProfiles,
  formatCommandForFiles,
  focusedGateCommand,
  lintCommandForFiles,
} from "./gates.js";
import {
  git,
  gitIsAncestor,
  type JsonRecord,
  readJson,
  record,
  string,
} from "./integration-check-support.js";
import {
  deduplicateGateCommands,
  gateCommandSetHash,
} from "./lane-gate-cache.js";
import { validateLaneAcceptance } from "./lane-acceptance.js";
import { laneFileOwnershipIssues } from "./lane-ownership.js";
import { lifecycleAdoptionRecordIssues } from "./lifecycle-adoption.js";
import type { GateProfile } from "./manifest.js";
import { proofChangedFilesMatch, validateProofContract } from "./proof.js";
import {
  type IntegrationWaveSelection,
  validateIntegrationWaveSelection,
} from "./integration-wave.js";

export interface IntegratedLaneCheckInput {
  readonly baseSha: string;
  readonly controlRoot: string;
  readonly evidenceDirectory: string;
  readonly headSha: string;
  readonly includedTasks: readonly unknown[];
  readonly integrationId: string;
  readonly manifestTranche?: string;
  readonly waveSelection?: IntegrationWaveSelection;
  readonly workdir: string;
}

const manifestFor = (
  controlRoot: string,
): { readonly planSha256: string; readonly tasks: Map<string, JsonRecord> } => {
  const manifest = readJson(
    resolve(
      controlRoot,
      "docs/superpowers/execution/maestro-brain/task-manifest.json",
    ),
  );
  if (manifest.schemaVersion !== "maestro-brain-task-manifest/v1") {
    throw new Error("unexpected task manifest schema");
  }
  if (!Array.isArray(manifest.tasks))
    throw new Error("task manifest has no tasks");
  return {
    planSha256: string(manifest.planSha256, "manifest.planSha256"),
    tasks: new Map(
      manifest.tasks.map((value, index) => {
        const task = record(value, `manifest.tasks[${index}]`);
        return [string(task.taskId, `manifest.tasks[${index}].taskId`), task];
      }),
    ),
  };
};

export const validateIntegratedLanes = (
  input: IntegratedLaneCheckInput,
): void => {
  if (input.includedTasks.length === 0) throw new Error("no included tasks");
  if (input.waveSelection)
    validateIntegrationWaveSelection(input.waveSelection);
  if (!input.waveSelection && !input.manifestTranche) {
    throw new Error("legacy integration has no manifest tranche");
  }
  const manifest = manifestFor(input.controlRoot);
  const manifestTasks = manifest.tasks;
  const includedTaskIds = input.includedTasks.map((value, index) =>
    string(
      record(value, `includedTasks[${index}]`).taskId,
      `includedTasks[${index}].taskId`,
    ),
  );
  if (new Set(includedTaskIds).size !== includedTaskIds.length) {
    throw new Error("duplicate included task");
  }
  const includedTaskSet = new Set(includedTaskIds);
  const waveTasks = new Map(
    input.waveSelection?.selectedTasks.map((task) => [task.taskId, task]) ?? [],
  );
  if (
    input.waveSelection &&
    JSON.stringify(includedTaskIds) !==
      JSON.stringify(
        input.waveSelection.selectedTasks.map((task) => task.taskId),
      )
  ) {
    throw new Error(
      "included task set does not match immutable wave selection",
    );
  }
  const seen = new Set<string>();
  const lockOwners = new Map<string, string>();

  for (const [index, value] of input.includedTasks.entries()) {
    const taskId = string(
      record(value, `includedTasks[${index}]`).taskId,
      `includedTasks[${index}].taskId`,
    );
    seen.add(taskId);
    const manifestTask = manifestTasks.get(taskId);
    if (!manifestTask) throw new Error(`${taskId}: absent from task manifest`);
    const expectedTranche = string(
      manifestTask.tranche,
      `${taskId}: manifest tranche`,
    );
    if (!input.waveSelection && expectedTranche !== input.manifestTranche) {
      throw new Error(`${taskId}: task manifest tranche mismatch`);
    }
    const includedTask = record(value, `includedTasks[${index}]`);
    if (
      input.waveSelection &&
      string(includedTask.tranche, `${taskId}: included task tranche`) !==
        expectedTranche
    ) {
      throw new Error(`${taskId}: included task tranche mismatch`);
    }
    if (manifestTask.fileInventoryStatus !== "ready") {
      throw new Error(`${taskId}: file inventory is not dispatch-ready`);
    }
    if (!Array.isArray(manifestTask.fileLocks)) {
      throw new Error(`${taskId}: manifest fileLocks missing`);
    }
    for (const lock of manifestTask.fileLocks) {
      const exactLock = string(lock, `${taskId}: manifest file lock`);
      const owner = lockOwners.get(exactLock);
      if (owner) {
        throw new Error(
          `${taskId}: file lock ${exactLock} conflicts with ${owner}`,
        );
      }
      lockOwners.set(exactLock, taskId);
    }
    if (!Array.isArray(manifestTask.codeStartAfter)) {
      throw new Error(`${taskId}: manifest codeStartAfter missing`);
    }
    for (const dependency of manifestTask.codeStartAfter) {
      const dependencyId = string(
        dependency,
        `${taskId}: codeStartAfter dependency`,
      );
      if (includedTaskSet.has(dependencyId)) {
        if (input.waveSelection) {
          throw new Error(
            `${taskId}: same-wave dependency ${dependencyId} is forbidden`,
          );
        }
        continue;
      }
      const dependencyLanePath = resolve(
        input.evidenceDirectory,
        "lane-results",
        dependencyId,
        "lane-result.json",
      );
      if (!existsSync(dependencyLanePath)) {
        throw new Error(
          `${taskId}: dependency ${dependencyId} has no lane result`,
        );
      }
      const dependencyLane = readJson(dependencyLanePath);
      const dependencyIntegrationHead = string(
        dependencyLane.integrationHeadSha,
        `${dependencyId}: integrationHeadSha`,
      );
      if (
        !new Set(["integrated", "accepted"]).has(
          String(dependencyLane.status),
        ) ||
        !gitIsAncestor(input.workdir, dependencyIntegrationHead, input.baseSha)
      ) {
        throw new Error(
          `${taskId}: dependency ${dependencyId} is not present on integration base`,
        );
      }
      validateLaneAcceptance(dependencyLane, dependencyId);
      const dependencyIntegrationId = string(
        dependencyLane.integrationId,
        `${dependencyId}: integrationId`,
      );
      const dependencyResultPath = resolve(
        input.evidenceDirectory,
        "integration",
        dependencyIntegrationId,
        "integration-result.json",
      );
      if (!existsSync(dependencyResultPath))
        throw new Error(
          `${taskId}: dependency ${dependencyId} has no authoritative integration result`,
        );
      const dependencyResult = readJson(dependencyResultPath);
      const boundTask = Array.isArray(dependencyResult.includedTasks)
        ? dependencyResult.includedTasks
            .map((item, index) =>
              record(item, `${dependencyId}: prior includedTasks[${index}]`),
            )
            .find((item) => item.taskId === dependencyId)
        : undefined;
      if (
        dependencyResult.schemaVersion !==
          "maestro-brain-integration-result/v1" ||
        dependencyResult.status !== "passed" ||
        dependencyResult.reviewVerdict !== "pass" ||
        dependencyResult.headSha !== dependencyIntegrationHead ||
        dependencyResult.integrationId !== dependencyIntegrationId ||
        !boundTask ||
        boundTask.laneHeadSha !== dependencyLane.headSha
      ) {
        throw new Error(
          `${taskId}: dependency ${dependencyId} is not bound by its authoritative integration result`,
        );
      }
    }

    const laneDirectory = resolve(
      input.evidenceDirectory,
      "lane-results",
      taskId,
    );
    const lanePath = resolve(laneDirectory, "lane-result.json");
    if (!existsSync(lanePath))
      throw new Error(`${taskId}: missing lane result`);
    const lane = readJson(lanePath);
    validateLaneAcceptance(lane, taskId);
    const lifecycleIssues = lifecycleAdoptionRecordIssues({
      root: input.workdir,
      state: String(lane.status),
      task: {
        fileLocks: manifestTask.fileLocks as string[],
        taskId,
      },
    });
    if (lifecycleIssues.length > 0) {
      throw new Error(lifecycleIssues.join("; "));
    }
    if (lane.integrationHeadSha !== input.headSha) {
      throw new Error(`${taskId}: integration head mismatch`);
    }
    if (lane.tranche !== expectedTranche) {
      throw new Error(`${taskId}: manifest tranche mismatch`);
    }
    if (lane.integrationId !== input.integrationId) {
      throw new Error(`${taskId}: integrationId mismatch`);
    }
    const laneHeadSha = string(lane.headSha, `${taskId}: lane headSha`);
    const proof = readJson(resolve(laneDirectory, "ci-proof-packet.json"));
    validateProofContract(proof, {
      planSha256: manifest.planSha256,
      taskBlockHash: string(
        manifestTask.taskBlockHash,
        `${taskId}: manifest taskBlockHash`,
      ),
      taskId,
    });
    const proofBaseSha = string(proof.baseSha, `${taskId}: proof baseSha`);
    if (
      proof.taskId !== taskId ||
      proof.headSha !== laneHeadSha ||
      proof.reviewVerdict !== "pass" ||
      !Array.isArray(proof.focusedCommands) ||
      proof.focusedCommands.length === 0 ||
      proof.focusedCommands.some((command) => typeof command !== "string") ||
      !Array.isArray(proof.changedFiles) ||
      proof.changedFiles.length === 0 ||
      proof.changedFiles.some((file) => typeof file !== "string")
    ) {
      throw new Error(
        `${taskId}: proof does not bind a reviewed passing lane head`,
      );
    }
    const waveTask = waveTasks.get(taskId);
    if (input.waveSelection) {
      if (!waveTask) throw new Error(`${taskId}: absent from wave selection`);
      const fileHash = (name: string): string =>
        createHash("sha256")
          .update(readFileSync(resolve(laneDirectory, name), "utf8"))
          .digest("hex");
      if (
        waveTask.tranche !== expectedTranche ||
        waveTask.headSha !== laneHeadSha ||
        waveTask.planSha256 !== manifest.planSha256 ||
        waveTask.taskBlockHash !== manifestTask.taskBlockHash ||
        waveTask.proofSha256 !== fileHash("ci-proof-packet.json") ||
        waveTask.gateSha256 !== fileHash("lane-gate-report.json") ||
        lane.preIntegrationLaneResultSha256 !== waveTask.laneResultSha256 ||
        JSON.stringify(waveTask.changedFiles) !==
          JSON.stringify([...(proof.changedFiles as string[])].sort()) ||
        JSON.stringify(waveTask.fileLocks) !==
          JSON.stringify([...(manifestTask.fileLocks as string[])].sort()) ||
        JSON.stringify(waveTask.codeStartAfter) !==
          JSON.stringify([...(manifestTask.codeStartAfter as string[])].sort())
      ) {
        throw new Error(`${taskId}: immutable wave selection drift`);
      }
    }
    if (!gitIsAncestor(input.workdir, proofBaseSha, laneHeadSha)) {
      throw new Error(
        `${taskId}: proof base is not an ancestor of the lane head`,
      );
    }
    if (!gitIsAncestor(input.workdir, laneHeadSha, input.headSha)) {
      const cherry = git(input.workdir, [
        "cherry",
        input.headSha,
        laneHeadSha,
        proofBaseSha,
      ]);
      const lines = cherry.split("\n").filter(Boolean);
      if (lines.length === 0 || lines.some((line) => !line.startsWith("- "))) {
        throw new Error(
          `${taskId}: lane commits are absent from integration head`,
        );
      }
    }

    const actualChangedFiles = git(input.workdir, [
      "diff",
      "--name-only",
      `${proofBaseSha}..${laneHeadSha}`,
    ])
      .split("\n")
      .filter(Boolean);
    if (
      !proofChangedFilesMatch(
        proof.changedFiles as string[],
        actualChangedFiles,
      )
    ) {
      throw new Error(
        `${taskId}: proof changedFiles do not match the task diff`,
      );
    }
    const ownershipIssues = laneFileOwnershipIssues(
      actualChangedFiles,
      manifestTask.fileLocks as string[],
    );
    if (ownershipIssues.length > 0) {
      throw new Error(`${taskId}: ${ownershipIssues.join("; ")}`);
    }

    const focusedCommands = (proof.focusedCommands as string[]).map((command) =>
      focusedGateCommand(command),
    );
    const changedFiles = (proof.changedFiles as string[]).filter((file) =>
      existsSync(resolve(input.workdir, file)),
    );
    const formatCommand = formatCommandForFiles(changedFiles);
    const lintCommand = lintCommandForFiles(changedFiles);
    const gateCommands = deduplicateGateCommands([
      ...(formatCommand ? [formatCommand] : []),
      ...(lintCommand ? [lintCommand] : []),
      ...focusedCommands,
      ...commandsForProfiles(
        manifestTask.gateProfiles as GateProfile[],
        focusedCommands,
      ),
    ]);
    const gate = readJson(resolve(laneDirectory, "lane-gate-report.json"));
    const commands = gateCommands.map(
      (command) => `rtk ${command.program} ${command.args.join(" ")}`,
    );
    if (
      gate.schemaVersion !== "maestro-brain-lane-gate/v1" ||
      gate.taskId !== taskId ||
      gate.stage !== "final" ||
      gate.status !== "passed" ||
      gate.headSha !== laneHeadSha ||
      gate.currentHeadSha !== laneHeadSha ||
      gate.planSha256 !== manifest.planSha256 ||
      gate.taskBlockHash !== manifestTask.taskBlockHash ||
      gate.commandSetHash !== gateCommandSetHash(gateCommands) ||
      JSON.stringify(gate.commands) !== JSON.stringify(commands)
    ) {
      throw new Error(`${taskId}: final lane gate does not bind the lane head`);
    }
  }

  const laneRoot = resolve(input.evidenceDirectory, "lane-results");
  const recordedForAttempt = readdirSync(laneRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((taskId) => {
      const lanePath = resolve(laneRoot, taskId, "lane-result.json");
      return (
        existsSync(lanePath) &&
        readJson(lanePath).integrationId === input.integrationId
      );
    })
    .sort();
  if (JSON.stringify(recordedForAttempt) !== JSON.stringify([...seen].sort())) {
    throw new Error(
      "included task set does not match lane integration records",
    );
  }
};
