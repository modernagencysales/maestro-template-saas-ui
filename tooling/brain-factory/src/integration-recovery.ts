import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

type JsonRecord = Record<string, unknown>;

const record = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

export const gitSha = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^[0-9a-f]{40}$/.test(parsed)) {
    throw new Error(`${label} must be a 40-character Git SHA`);
  }
  return parsed;
};

export const fabroRunId = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(parsed)) {
    throw new Error(`${label} must be a ULID`);
  }
  return parsed;
};

const safeTranche = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(parsed)) {
    throw new Error(`${label} is invalid`);
  }
  return parsed;
};

export const safeAbsolutePath = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!isAbsolute(parsed)) throw new Error(`${label} must be absolute`);
  if (!/^[A-Za-z0-9_./@+=:-]+$/.test(parsed)) {
    throw new Error(`${label} contains shell-unsafe characters`);
  }
  return resolve(parsed);
};

export const integrationLockPath = (
  gitCommonDirectory: string,
  tranche: string,
): string =>
  resolve(
    safeAbsolutePath(gitCommonDirectory, "Git common directory"),
    "maestro-brain-factory",
    `integration-${safeTranche(tranche, "tranche")}.lock`,
  );

export const acquireIntegrationOwnership = (input: {
  readonly lockPath: string;
  readonly owner: JsonRecord;
}): (() => void) => {
  const ownershipToken = randomUUID();
  mkdirSync(dirname(input.lockPath), { recursive: true });
  try {
    mkdirSync(input.lockPath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String(error.code) === "EEXIST"
    ) {
      throw new Error(
        `integration ownership already exists at ${input.lockPath}; inspect it explicitly`,
      );
    }
    throw error;
  }
  const ownerPath = resolve(input.lockPath, "owner.json");
  const ownerContent = `${JSON.stringify(
    { ...input.owner, ownershipToken },
    null,
    2,
  )}\n`;
  writeFileSync(ownerPath, ownerContent, { flag: "wx" });
  return () => {
    if (readFileSync(ownerPath, "utf8") !== ownerContent) {
      throw new Error(
        `integration ownership changed at ${input.lockPath}; refusing release`,
      );
    }
    const claimedPath = `${input.lockPath}.release-${ownershipToken}`;
    renameSync(input.lockPath, claimedPath);
    const claimedOwnerPath = resolve(claimedPath, "owner.json");
    if (readFileSync(claimedOwnerPath, "utf8") !== ownerContent) {
      throw new Error(
        `integration ownership changed at ${input.lockPath}; refusing release`,
      );
    }
    unlinkSync(claimedOwnerPath);
    rmdirSync(claimedPath);
  };
};

export interface LegacyIntegrationRecoveryPlan {
  readonly auditEvent: JsonRecord;
  readonly normalizedResult: JsonRecord;
  readonly repairBaseSha: string;
  readonly sourceReviewRun: string;
}

export const planLegacyIntegrationRecovery = (input: {
  readonly branchHead: string;
  readonly controlHead: string;
  readonly failedRun: unknown;
  readonly integrationResult: unknown;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly manifestTaskIds: readonly string[];
  readonly now: string;
  readonly reason: string | undefined;
  readonly runRecord: unknown;
  readonly tranche: string;
  readonly worktreeClean: boolean;
  readonly worktreeHead: string;
  readonly worktreePath: string;
}): LegacyIntegrationRecoveryPlan => {
  const reason = string(input.reason, "recovery reason");
  const tranche = safeTranche(input.tranche, "tranche");
  const branchHead = gitSha(input.branchHead, "branch head");
  const controlHead = gitSha(input.controlHead, "control HEAD");
  const worktreeHead = gitSha(input.worktreeHead, "worktree HEAD");
  const worktreePath = safeAbsolutePath(input.worktreePath, "worktree path");
  const run = record(input.runRecord, "run record");
  const result = record(input.integrationResult, "integration result");
  const runId = fabroRunId(run.runId, "run record runId");
  const baseSha = gitSha(run.baseSha, "run record baseSha");
  const expectedBranch = `fabro/brain-${tranche.toLowerCase()}`;
  if (string(run.tranche, "run record tranche") !== tranche) {
    throw new Error(`${tranche}: run record tranche mismatch`);
  }
  if (
    run.integrationId !== undefined &&
    string(run.integrationId, "run record integrationId") !== tranche
  ) {
    throw new Error(`${tranche}: run record integration ID mismatch`);
  }
  if (
    run.manifestTranche !== undefined &&
    string(run.manifestTranche, "run record manifestTranche") !== tranche
  ) {
    throw new Error(`${tranche}: run record manifest tranche mismatch`);
  }
  if (string(run.branch, "run record branch") !== expectedBranch) {
    throw new Error(`${tranche}: run record branch mismatch`);
  }
  if (safeAbsolutePath(run.workdir, "run record workdir") !== worktreePath) {
    throw new Error(`${tranche}: run record worktree mismatch`);
  }

  const failedRun = record(input.failedRun, "Fabro run");
  const failedRunStatus = record(failedRun.status, "Fabro run status").kind;
  if (failedRunStatus !== "failed") {
    throw new Error(
      `${tranche}: source Fabro run is ${String(failedRunStatus ?? "unknown")}; only a verified failed run may be recovered`,
    );
  }
  if (fabroRunId(failedRun.run_id, "Fabro run ID") !== runId) {
    throw new Error(`${tranche}: Fabro run ID does not match run record`);
  }
  const failedRunSettings = record(
    record(failedRun.run_spec, "Fabro run spec").settings,
    "Fabro run settings",
  );
  const failedRunConfiguration = record(
    failedRunSettings.run,
    "Fabro run configuration",
  );
  const failedRunInputs = record(
    failedRunConfiguration.inputs,
    "Fabro run inputs",
  );
  if (gitSha(failedRunInputs.base_sha, "Fabro run base") !== baseSha) {
    throw new Error(`${tranche}: Fabro run base mismatch`);
  }
  if (string(failedRunInputs.tranche, "Fabro run tranche") !== tranche) {
    throw new Error(`${tranche}: Fabro run tranche mismatch`);
  }
  if (
    safeAbsolutePath(failedRunInputs.workdir, "Fabro run workdir") !==
    worktreePath
  ) {
    throw new Error(`${tranche}: Fabro run worktree mismatch`);
  }
  if (failedRunConfiguration.metadata !== undefined) {
    const metadata = record(
      failedRunConfiguration.metadata,
      "Fabro run metadata",
    );
    if (
      metadata.tranche !== undefined &&
      string(metadata.tranche, "Fabro run metadata tranche") !== tranche
    ) {
      throw new Error(`${tranche}: Fabro run metadata tranche mismatch`);
    }
  }
  if (!input.worktreeClean) {
    throw new Error(`${tranche}: integration worktree is not clean`);
  }
  if (branchHead !== worktreeHead) {
    throw new Error(`${tranche}: branch and worktree heads differ`);
  }
  if (!input.isAncestor(baseSha, worktreeHead)) {
    throw new Error(
      `${tranche}: integration base is not an ancestor of its head`,
    );
  }
  if (!input.isAncestor(worktreeHead, controlHead)) {
    throw new Error(
      `${tranche}: integration head is not an ancestor of control HEAD`,
    );
  }

  if (result.recovery !== undefined) {
    throw new Error(
      `${tranche}: integration evidence already has recovery history`,
    );
  }
  if (
    string(result.schemaVersion, "legacy evidence schemaVersion") !==
    "maestro-brain-integration-result/v1"
  ) {
    throw new Error(`${tranche}: unexpected legacy evidence schema`);
  }
  if (string(result.tranche, "legacy evidence tranche") !== tranche) {
    throw new Error(`${tranche}: legacy evidence tranche mismatch`);
  }
  if (gitSha(result.baseHeadSha, "legacy evidence baseHeadSha") !== baseSha) {
    throw new Error(`${tranche}: legacy evidence base mismatch`);
  }
  if (
    gitSha(result.integrationHeadSha, "legacy evidence integrationHeadSha") !==
    worktreeHead
  ) {
    throw new Error(`${tranche}: legacy evidence head mismatch`);
  }
  if (
    safeAbsolutePath(result.worktree, "legacy evidence worktree") !==
    worktreePath
  ) {
    throw new Error(`${tranche}: legacy evidence worktree mismatch`);
  }
  if (result.status !== "passed" || result.reviewVerdict !== "pass") {
    throw new Error(
      `${tranche}: legacy evidence is not contradictory pass evidence`,
    );
  }
  if (
    !Array.isArray(result.includedTasks) ||
    result.includedTasks.length === 0
  ) {
    throw new Error(`${tranche}: legacy evidence has no included tasks`);
  }

  const manifestTaskIds = new Set(
    input.manifestTaskIds.map((taskId, index) =>
      string(taskId, `manifestTaskIds[${index}]`),
    ),
  );
  if (manifestTaskIds.size !== input.manifestTaskIds.length) {
    throw new Error(`${tranche}: manifest tranche has duplicate task IDs`);
  }
  const seenTaskIds = new Set<string>();
  const includedTasks = result.includedTasks.map((value, index) => {
    const task = record(value, `includedTasks[${index}]`);
    const taskId = string(task.taskId, `includedTasks[${index}] taskId`);
    if (!manifestTaskIds.has(taskId)) {
      throw new Error(`${taskId}: task is outside manifest tranche ${tranche}`);
    }
    if (seenTaskIds.has(taskId)) {
      throw new Error(`${tranche}: duplicate included task ${taskId}`);
    }
    seenTaskIds.add(taskId);
    if (string(task.tranche, `${taskId} tranche`) !== tranche) {
      throw new Error(`${taskId}: task tranche mismatch`);
    }
    const laneHeadSha = gitSha(
      task.laneHeadSha ?? task.taskHeadSha,
      `includedTasks[${index}] lane head`,
    );
    const integrationCommitSha = gitSha(
      task.integrationCommitSha,
      `${taskId} integrationCommitSha`,
    );
    if (!input.isAncestor(integrationCommitSha, worktreeHead)) {
      throw new Error(
        `${taskId}: integration commit is not on the integration head`,
      );
    }
    return { ...task, integrationCommitSha, laneHeadSha, taskId };
  });
  const includedByTaskId = new Map(
    includedTasks.map((task) => [task.taskId as string, task]),
  );
  if (
    !Array.isArray(result.commits) ||
    result.commits.length !== includedTasks.length
  ) {
    throw new Error(
      `${tranche}: legacy commit list does not match included tasks`,
    );
  }
  const seenCommitTaskIds = new Set<string>();
  const commits = result.commits.map((value, index) => {
    const commit = record(value, `commits[${index}]`);
    const taskId = string(commit.taskId, `commits[${index}] taskId`);
    const included = includedByTaskId.get(taskId);
    if (!included || seenCommitTaskIds.has(taskId)) {
      throw new Error(`${tranche}: legacy commit task mismatch ${taskId}`);
    }
    seenCommitTaskIds.add(taskId);
    const sourceCommitSha = gitSha(
      commit.sourceCommitSha,
      `${taskId} commit sourceCommitSha`,
    );
    const integrationCommitSha = gitSha(
      commit.integrationCommitSha,
      `${taskId} commit integrationCommitSha`,
    );
    if (
      sourceCommitSha !== included.laneHeadSha ||
      integrationCommitSha !== included.integrationCommitSha
    ) {
      throw new Error(`${taskId}: legacy commit does not match included task`);
    }
    return { ...commit, integrationCommitSha, sourceCommitSha, taskId };
  });
  const previousStatus = result.status ?? null;
  const previousReviewVerdict = result.reviewVerdict ?? null;
  const legacyIncludedTaskIds = [...seenTaskIds].sort();
  const recoveryFinding = {
    id: "legacy-integration-run-failed",
    severity: "high",
    summary:
      "Legacy integration evidence claimed completion although its Fabro run failed; rerun independent review and the full tranche gate.",
  };
  const previousRemainingFindings = Array.isArray(result.remainingFindings)
    ? result.remainingFindings.map((value, index) =>
        record(value, `remainingFindings[${index}]`),
      )
    : [];
  const previousResolvedFindings = Array.isArray(result.resolvedFindings)
    ? result.resolvedFindings
        .map((value, index) => record(value, `resolvedFindings[${index}]`))
        .filter((finding) => finding.id !== recoveryFinding.id)
    : [];
  const legacy: JsonRecord = { ...result };
  for (const key of [
    "baseHeadSha",
    "baseSha",
    "broadGate",
    "headSha",
    "integrationHeadSha",
    "integrationId",
    "integrationWorkdir",
    "manifestTranche",
    "requiredFindingIds",
    "worktree",
  ]) {
    delete legacy[key];
  }
  const normalizedResult: JsonRecord = {
    ...legacy,
    baseSha,
    headSha: worktreeHead,
    commits,
    includedTasks,
    integrationId: tranche,
    integrationWorkdir: worktreePath,
    manifestTranche: tranche,
    recovery: {
      at: input.now,
      legacyBaseHeadSha: baseSha,
      legacyIncludedTaskIds,
      legacyIntegrationHeadSha: worktreeHead,
      legacyWorktree: worktreePath,
      previousReviewVerdict,
      previousStatus,
      reason,
      schemaVersion: "maestro-brain-integration-recovery/v1",
      sourceRunStatus: "failed",
      sourceReviewRun: runId,
    },
    remainingFindings: [...previousRemainingFindings, recoveryFinding],
    resolvedFindings: previousResolvedFindings,
    reviewVerdict: "rework",
    schemaVersion: "maestro-brain-integration-result/v1",
    sourceRunStatus: "failed",
    sourceReviewRun: runId,
    status: "rework",
    tranche,
  };
  return {
    auditEvent: {
      action: "recover-legacy-integration",
      at: input.now,
      baseSha,
      headSha: worktreeHead,
      legacyIncludedTaskIds,
      previousReviewVerdict,
      previousStatus,
      reason,
      schemaVersion: "maestro-brain-integration-recovery-audit/v1",
      sourceRunStatus: "failed",
      sourceReviewRun: runId,
      tranche,
    },
    normalizedResult,
    repairBaseSha: worktreeHead,
    sourceReviewRun: runId,
  };
};

export const persistLegacyIntegrationRecovery = (input: {
  readonly auditPath: string;
  readonly plan: LegacyIntegrationRecoveryPlan;
  readonly resultPath: string;
}): void => {
  const temporary = `${input.resultPath}.next`;
  if (existsSync(temporary)) {
    throw new Error(`recovery staging file already exists at ${temporary}`);
  }
  writeFileSync(
    temporary,
    `${JSON.stringify(input.plan.normalizedResult, null, 2)}\n`,
    { flag: "wx" },
  );
  try {
    mkdirSync(dirname(input.auditPath), { recursive: true });
    appendFileSync(
      input.auditPath,
      `${JSON.stringify(input.plan.auditEvent)}\n`,
      "utf8",
    );
  } catch (error) {
    rmSync(temporary);
    throw error;
  }
  renameSync(temporary, input.resultPath);
};

export const reserveRepairLaunch = (
  path: string,
  reservation: JsonRecord,
): string => {
  const reservationToken = randomUUID();
  mkdirSync(dirname(path), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(path, "wx");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String(error.code) === "EEXIST"
    ) {
      throw new Error(
        `repair launch reservation already exists at ${path}; inspect it explicitly`,
      );
    }
    throw error;
  }
  try {
    writeFileSync(
      descriptor,
      `${JSON.stringify({ ...reservation, reservationToken }, null, 2)}\n`,
    );
  } finally {
    closeSync(descriptor);
  }
  return reservationToken;
};

export const promoteRepairLaunch = (
  path: string,
  reservationToken: string,
  recordValue: JsonRecord,
): void => {
  const temporary = `${path}.next`;
  if (existsSync(temporary)) {
    throw new Error(
      `repair launch staging file already exists at ${temporary}`,
    );
  }
  const reservationContent = readFileSync(path, "utf8");
  const reservation = record(JSON.parse(reservationContent), "reservation");
  if (
    reservation.reservationToken !== reservationToken ||
    reservation.status !== "preparing"
  ) {
    throw new Error(`repair launch reservation changed at ${path}`);
  }
  writeFileSync(temporary, `${JSON.stringify(recordValue, null, 2)}\n`, {
    flag: "wx",
  });
  if (readFileSync(path, "utf8") !== reservationContent) {
    rmSync(temporary);
    throw new Error(`repair launch reservation changed at ${path}`);
  }
  renameSync(temporary, path);
};

export const repairWorkflowArgs = (input: {
  readonly controlRoot: string;
  readonly evidenceDirectory: string;
  readonly recoveryAuditPath: string;
  readonly repairBaseSha: string;
  readonly sourceReviewRun: string;
  readonly tranche: string;
  readonly workdir: string;
  readonly workflow: string;
}): readonly string[] => {
  const controlRoot = safeAbsolutePath(input.controlRoot, "controlRoot");
  const evidenceDirectory = safeAbsolutePath(
    input.evidenceDirectory,
    "evidenceDirectory",
  );
  const recoveryAuditPath = safeAbsolutePath(
    input.recoveryAuditPath,
    "recoveryAuditPath",
  );
  const repairBaseSha = gitSha(input.repairBaseSha, "repairBaseSha");
  const sourceReviewRun = fabroRunId(input.sourceReviewRun, "sourceReviewRun");
  const tranche = safeTranche(input.tranche, "tranche");
  const workdir = safeAbsolutePath(input.workdir, "workdir");
  const workflow = safeAbsolutePath(input.workflow, "workflow");
  return [
    "fabro",
    "run",
    workflow,
    "--detach",
    "--json",
    "--no-upgrade-check",
    "--environment",
    "local",
    "--label",
    `tranche=${tranche}`,
    "-I",
    `workdir=${workdir}`,
    "-I",
    `evidence_dir=${evidenceDirectory}`,
    "-I",
    `recovery_audit=${recoveryAuditPath}`,
    "-I",
    `tranche=${tranche}`,
    "-I",
    `base_sha=${repairBaseSha}`,
    "-I",
    `source_review_run=${sourceReviewRun}`,
    "-I",
    `control_root=${controlRoot}`,
  ];
};

export const readJsonRecord = (path: string): JsonRecord =>
  record(JSON.parse(readFileSync(path, "utf8")), path);
