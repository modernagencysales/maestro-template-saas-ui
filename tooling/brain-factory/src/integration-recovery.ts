import { createHash, randomUUID } from "node:crypto";
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

const hashText = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const hashJson = (value: unknown): string => hashText(JSON.stringify(value));

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
    const recovery = record(result.recovery, "recovery history");
    if (
      result.schemaVersion !== "maestro-brain-integration-result/v1" ||
      result.status !== "rework" ||
      result.reviewVerdict !== "rework" ||
      result.tranche !== tranche ||
      result.integrationId !== tranche ||
      result.manifestTranche !== tranche ||
      gitSha(result.baseSha, "normalized evidence baseSha") !== baseSha ||
      gitSha(result.headSha, "normalized evidence headSha") !== worktreeHead ||
      safeAbsolutePath(
        result.integrationWorkdir,
        "normalized evidence integrationWorkdir",
      ) !== worktreePath ||
      result.sourceRunStatus !== "failed" ||
      fabroRunId(
        result.sourceReviewRun,
        "normalized evidence sourceReviewRun",
      ) !== runId
    ) {
      throw new Error(`${tranche}: normalized recovery evidence drifted`);
    }
    if (
      recovery.schemaVersion !== "maestro-brain-integration-recovery/v1" ||
      recovery.sourceRunStatus !== "failed" ||
      fabroRunId(recovery.sourceReviewRun, "recovery sourceReviewRun") !==
        runId ||
      gitSha(recovery.legacyBaseHeadSha, "recovery legacyBaseHeadSha") !==
        baseSha ||
      gitSha(
        recovery.legacyIntegrationHeadSha,
        "recovery legacyIntegrationHeadSha",
      ) !== worktreeHead ||
      safeAbsolutePath(recovery.legacyWorktree, "recovery legacyWorktree") !==
        worktreePath ||
      recovery.previousStatus !== "passed" ||
      recovery.previousReviewVerdict !== "pass" ||
      string(recovery.reason, "recovery reason") !== reason
    ) {
      throw new Error(`${tranche}: normalized recovery history drifted`);
    }
    if (!Array.isArray(result.includedTasks)) {
      throw new Error(`${tranche}: normalized recovery has no included tasks`);
    }
    const manifestTaskIds = new Set(input.manifestTaskIds);
    const includedTaskIds = result.includedTasks
      .map((value, index) => {
        const task = record(value, `includedTasks[${index}]`);
        const taskId = string(task.taskId, `includedTasks[${index}] taskId`);
        if (!manifestTaskIds.has(taskId) || task.tranche !== tranche) {
          throw new Error(`${taskId}: normalized task identity mismatch`);
        }
        gitSha(task.laneHeadSha, `${taskId} laneHeadSha`);
        const integrationCommitSha = gitSha(
          task.integrationCommitSha,
          `${taskId} integrationCommitSha`,
        );
        if (!input.isAncestor(integrationCommitSha, worktreeHead)) {
          throw new Error(`${taskId}: normalized integration commit drifted`);
        }
        return taskId;
      })
      .sort();
    if (
      new Set(includedTaskIds).size !== includedTaskIds.length ||
      !Array.isArray(recovery.legacyIncludedTaskIds) ||
      JSON.stringify(includedTaskIds) !==
        JSON.stringify([...recovery.legacyIncludedTaskIds].sort())
    ) {
      throw new Error(`${tranche}: normalized included-task history drifted`);
    }
    const recoveryAt = string(recovery.at, "recovery at");
    return {
      auditEvent: {
        action: "recover-legacy-integration",
        at: recoveryAt,
        baseSha,
        headSha: worktreeHead,
        legacyIncludedTaskIds: includedTaskIds,
        previousReviewVerdict: "pass",
        previousStatus: "passed",
        reason,
        schemaVersion: "maestro-brain-integration-recovery-audit/v1",
        sourceRunStatus: "failed",
        sourceReviewRun: runId,
        tranche,
      },
      normalizedResult: result,
      repairBaseSha: worktreeHead,
      sourceReviewRun: runId,
    };
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
  readonly fault?: (point: RecoveryFaultPoint) => void;
  readonly plan: LegacyIntegrationRecoveryPlan;
  readonly resultPath: string;
}): void => {
  const temporary = `${input.resultPath}.next`;
  const normalizedContent = `${JSON.stringify(
    input.plan.normalizedResult,
    null,
    2,
  )}\n`;
  const auditEvents = existsSync(input.auditPath)
    ? readFileSync(input.auditPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => record(JSON.parse(line), "recovery audit event"))
    : [];
  const auditExists = auditEvents.some(
    (event) => JSON.stringify(event) === JSON.stringify(input.plan.auditEvent),
  );
  if (
    existsSync(input.resultPath) &&
    readFileSync(input.resultPath, "utf8") === normalizedContent &&
    auditExists
  ) {
    if (existsSync(temporary)) {
      if (readFileSync(temporary, "utf8") !== normalizedContent) {
        throw new Error(`recovery staging file conflicts at ${temporary}`);
      }
      rmSync(temporary);
    }
    return;
  }
  if (existsSync(temporary)) {
    if (readFileSync(temporary, "utf8") !== normalizedContent) {
      throw new Error(`recovery staging file conflicts at ${temporary}`);
    }
  } else {
    writeFileSync(temporary, normalizedContent, { flag: "wx" });
    input.fault?.("after-recovery-stage");
  }
  if (!auditExists) {
    mkdirSync(dirname(input.auditPath), { recursive: true });
    appendFileSync(
      input.auditPath,
      `${JSON.stringify(input.plan.auditEvent)}\n`,
      "utf8",
    );
    input.fault?.("after-audit-append");
  }
  renameSync(temporary, input.resultPath);
  input.fault?.("after-normalization");
};

export type RecoveryFaultPoint =
  | "after-audit-append"
  | "after-create-output"
  | "after-create-record"
  | "after-launch"
  | "after-normalization"
  | "after-promotion-stage"
  | "after-recovery-stage"
  | "after-reservation"
  | "after-start-reservation";

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
  fault?: (point: RecoveryFaultPoint) => void,
): void => {
  const temporary = `${path}.next`;
  const reservationContent = readFileSync(path, "utf8");
  const reservation = record(JSON.parse(reservationContent), "reservation");
  if (
    reservation.reservationToken !== reservationToken ||
    !new Set([
      "created",
      "launch_failed",
      "launch_unknown",
      "preparing",
      "starting",
    ]).has(String(reservation.status))
  ) {
    throw new Error(`repair launch reservation changed at ${path}`);
  }
  const promotedContent = `${JSON.stringify(
    {
      ...recordValue,
      priorLaunchAttempt: reservation.launchAttempt,
      priorStartAttempt: reservation.startAttempt,
      priorStatus: reservation.status,
      reservationToken,
    },
    null,
    2,
  )}\n`;
  if (existsSync(temporary)) {
    if (readFileSync(temporary, "utf8") !== promotedContent) {
      throw new Error(`repair launch staging file conflicts at ${temporary}`);
    }
  } else {
    writeFileSync(temporary, promotedContent, { flag: "wx" });
  }
  fault?.("after-promotion-stage");
  if (readFileSync(path, "utf8") !== reservationContent) {
    rmSync(temporary);
    throw new Error(`repair launch reservation changed at ${path}`);
  }
  renameSync(temporary, path);
};

export interface RepairRecoveryIdentity {
  readonly baseSha: string;
  readonly sourceReviewRun: string;
  readonly tranche: string;
  readonly workdir: string;
}

interface RepairReservation extends JsonRecord {
  readonly baseSha: string;
  readonly createReceipt?: unknown;
  readonly createdRunId?: string;
  readonly integrationBaseSha: string;
  readonly launchAttempt: number;
  readonly recoveryAt: string;
  readonly recoveryReason: string;
  readonly reservationToken: string;
  readonly schemaVersion: "maestro-brain-repair-reservation/v1";
  readonly sourceReviewRun: string;
  readonly startAttempt: number;
  readonly status:
    | "created"
    | "launch_failed"
    | "launch_unknown"
    | "launched"
    | "preparing"
    | "starting";
  readonly taskIds: readonly string[];
  readonly tranche: string;
  readonly transitionHash: string;
  readonly workdir: string;
}

const repairReservation = (
  value: unknown,
  identity: RepairRecoveryIdentity,
): RepairReservation => {
  const reservation = record(value, "repair reservation");
  if (reservation.schemaVersion !== "maestro-brain-repair-reservation/v1")
    throw new Error("repair reservation schema mismatch");
  if (
    gitSha(reservation.baseSha, "repair reservation baseSha") !==
    identity.baseSha
  )
    throw new Error("repair reservation base mismatch");
  gitSha(
    reservation.integrationBaseSha,
    "repair reservation integrationBaseSha",
  );
  if (
    fabroRunId(
      reservation.sourceReviewRun,
      "repair reservation sourceReviewRun",
    ) !== identity.sourceReviewRun
  )
    throw new Error("repair reservation source run mismatch");
  if (reservation.tranche !== identity.tranche)
    throw new Error("repair reservation tranche mismatch");
  if (
    safeAbsolutePath(reservation.workdir, "repair reservation workdir") !==
    identity.workdir
  )
    throw new Error("repair reservation workdir mismatch");
  if (
    typeof reservation.reservationToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      reservation.reservationToken,
    )
  ) {
    throw new Error("repair reservation token is invalid");
  }
  if (
    !Number.isInteger(reservation.launchAttempt) ||
    Number(reservation.launchAttempt) < 1 ||
    !Number.isInteger(reservation.startAttempt) ||
    Number(reservation.startAttempt) < 0
  ) {
    throw new Error("repair reservation launch attempt is invalid");
  }
  if (
    typeof reservation.recoveryAt !== "string" ||
    Number.isNaN(Date.parse(reservation.recoveryAt)) ||
    typeof reservation.recoveryReason !== "string" ||
    reservation.recoveryReason.length === 0 ||
    typeof reservation.transitionHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(reservation.transitionHash) ||
    !Array.isArray(reservation.taskIds) ||
    reservation.taskIds.length === 0 ||
    reservation.taskIds.some(
      (taskId) => typeof taskId !== "string" || !/^S\d{2}-T\d{2}$/.test(taskId),
    ) ||
    new Set(reservation.taskIds).size !== reservation.taskIds.length
  ) {
    throw new Error("repair reservation transition identity is invalid");
  }
  if (
    !new Set([
      "created",
      "launch_failed",
      "launch_unknown",
      "launched",
      "preparing",
      "starting",
    ]).has(String(reservation.status))
  ) {
    throw new Error("repair reservation status is invalid");
  }
  const hasCreatedRun = new Set(["created", "starting", "launched"]).has(
    String(reservation.status),
  );
  if (hasCreatedRun) {
    fabroRunId(reservation.createdRunId, "repair reservation createdRunId");
    record(reservation.createReceipt, "repair reservation createReceipt");
  } else if (
    reservation.createdRunId !== undefined ||
    reservation.createReceipt !== undefined ||
    reservation.startAttempt !== 0
  ) {
    throw new Error("uncreated repair reservation has created-run state");
  }
  return reservation as unknown as RepairReservation;
};

const repairIdentityFromRecord = (value: unknown): RepairRecoveryIdentity => {
  const reservation = record(value, "repair reservation");
  return {
    baseSha: gitSha(reservation.baseSha, "repair reservation baseSha"),
    sourceReviewRun: fabroRunId(
      reservation.sourceReviewRun,
      "repair reservation sourceReviewRun",
    ),
    tranche: safeTranche(reservation.tranche, "repair reservation tranche"),
    workdir: safeAbsolutePath(
      reservation.workdir,
      "repair reservation workdir",
    ),
  };
};

const reservationTransitionFields = (reservation: RepairReservation) => ({
  ...(reservation.createReceipt !== undefined
    ? { createReceipt: reservation.createReceipt }
    : {}),
  ...(reservation.createdRunId !== undefined
    ? { createdRunId: reservation.createdRunId }
    : {}),
  integrationBaseSha: reservation.integrationBaseSha,
  recoveryAt: reservation.recoveryAt,
  recoveryReason: reservation.recoveryReason,
  startAttempt: reservation.startAttempt,
  taskIds: reservation.taskIds,
  transitionHash: reservation.transitionHash,
});

export interface RepairLaunchReceiptInput {
  readonly attempt: number;
  readonly baseSha: string;
  readonly integrationBaseSha: string;
  readonly reservationToken: string;
  readonly runId: string;
  readonly sourceReviewRun: string;
  readonly taskIds: readonly string[];
  readonly tranche: string;
  readonly workdir: string;
}

export type RepairLaunchAttempt = RepairLaunchReceiptInput;

const buildRepairRunReceipt = (
  input: RepairLaunchReceiptInput,
  phase: "create" | "launch",
): JsonRecord => {
  const payload = {
    attempt: input.attempt,
    baseSha: gitSha(input.baseSha, `${phase} receipt baseSha`),
    integrationBaseSha: gitSha(
      input.integrationBaseSha,
      `${phase} receipt integrationBaseSha`,
    ),
    reservationToken: input.reservationToken,
    runId: fabroRunId(input.runId, `${phase} receipt runId`),
    schemaVersion: `maestro-brain-repair-${phase}-receipt/v1`,
    sourceReviewRun: fabroRunId(
      input.sourceReviewRun,
      `${phase} receipt sourceReviewRun`,
    ),
    taskIds: [...input.taskIds].sort(),
    tranche: safeTranche(input.tranche, `${phase} receipt tranche`),
    workdir: safeAbsolutePath(input.workdir, `${phase} receipt workdir`),
    workflow: "BrainRepairTranche",
  };
  if (
    !Number.isInteger(payload.attempt) ||
    payload.attempt < 1 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      payload.reservationToken,
    ) ||
    payload.taskIds.length === 0 ||
    payload.taskIds.some((taskId) => !/^S\d{2}-T\d{2}$/.test(taskId)) ||
    new Set(payload.taskIds).size !== payload.taskIds.length
  ) {
    throw new Error(`${phase} receipt identity is invalid`);
  }
  return { ...payload, receiptSha256: hashJson(payload) };
};

export const buildRepairCreateReceipt = (
  input: RepairLaunchReceiptInput,
): JsonRecord => buildRepairRunReceipt(input, "create");

export const buildRepairLaunchReceipt = (
  input: RepairLaunchReceiptInput,
): JsonRecord => buildRepairRunReceipt(input, "launch");

const validateRepairRunReceipt = (
  value: unknown,
  reservation: RepairReservation,
  phase: "create" | "launch",
): string => {
  const receipt = record(value, `repair ${phase} receipt`);
  const expected = buildRepairRunReceipt(
    {
      attempt: reservation.launchAttempt,
      baseSha: reservation.baseSha,
      integrationBaseSha: reservation.integrationBaseSha,
      reservationToken: reservation.reservationToken,
      runId: receipt.runId as string,
      sourceReviewRun: reservation.sourceReviewRun,
      taskIds: reservation.taskIds,
      tranche: reservation.tranche,
      workdir: reservation.workdir,
    },
    phase,
  );
  if (JSON.stringify(receipt) !== JSON.stringify(expected)) {
    throw new Error(`repair ${phase} receipt identity or digest mismatch`);
  }
  return fabroRunId(receipt.runId, `repair ${phase} receipt runId`);
};

const validateRepairLaunchReceipt = (
  value: unknown,
  reservation: RepairReservation,
): string => validateRepairRunReceipt(value, reservation, "launch");

const validateRepairCreateReceipt = (
  value: unknown,
  reservation: RepairReservation,
): string => validateRepairRunReceipt(value, reservation, "create");

export type RepairCreateDiscovery =
  | { readonly kind: "absent" }
  | { readonly kind: "ambiguous"; readonly reason: string }
  | { readonly kind: "found"; readonly receipt: unknown };

export const dispatchIntegrationRecovery = (input: {
  readonly integrationResult: unknown;
  readonly reconcileDurable: () => string | undefined;
  readonly reconcileFromEvidence: () => string;
  readonly repairRecordExists: boolean;
}): string => {
  const result = record(input.integrationResult, "integration result");
  const recovery =
    typeof result.recovery === "object" &&
    result.recovery !== null &&
    !Array.isArray(result.recovery)
      ? (result.recovery as JsonRecord)
      : undefined;
  const normalizedRecoveryExists =
    result.schemaVersion === "maestro-brain-integration-result/v1" &&
    result.sourceRunStatus === "failed" &&
    recovery?.schemaVersion === "maestro-brain-integration-recovery/v1" &&
    recovery.sourceRunStatus === "failed";
  if (input.repairRecordExists && normalizedRecoveryExists) {
    const durable = input.reconcileDurable();
    if (durable !== undefined) return durable;
  }
  return input.reconcileFromEvidence();
};

export const verifyRepairLaunchInspection = (
  value: unknown,
  expected: RepairLaunchAttempt,
): void => {
  const items = Array.isArray(value) ? value : [value];
  if (items.length !== 1) {
    throw new Error("Fabro repair inspection must contain exactly one run");
  }
  const run = record(items[0], "Fabro repair run");
  if (fabroRunId(run.run_id, "Fabro repair run ID") !== expected.runId) {
    throw new Error("Fabro repair inspection run ID mismatch");
  }
  const runSpec = record(run.run_spec, "Fabro repair run spec");
  const settings = record(runSpec.settings, "Fabro repair run settings");
  const configuration = record(settings.run, "Fabro repair configuration");
  const inputs = record(configuration.inputs, "Fabro repair inputs");
  const metadata = record(
    configuration.metadata ?? runSpec.labels ?? run.labels,
    "Fabro repair metadata labels",
  );
  const graph =
    typeof runSpec.graph === "object" &&
    runSpec.graph !== null &&
    !Array.isArray(runSpec.graph)
      ? (runSpec.graph as JsonRecord)
      : undefined;
  const workflow =
    typeof run.workflow === "object" &&
    run.workflow !== null &&
    !Array.isArray(run.workflow)
      ? (run.workflow as JsonRecord)
      : undefined;
  const graphName =
    graph?.name ??
    graph?.id ??
    workflow?.graph_name ??
    run.workflow_graph_name ??
    run.workflow_name;
  if (string(graphName, "Fabro repair graph name") !== "BrainRepairTranche") {
    throw new Error("Fabro repair workflow mismatch");
  }
  if (
    string(metadata.recovery_token, "Fabro recovery token label") !==
      expected.reservationToken ||
    Number(metadata.launch_attempt) !== expected.attempt ||
    string(metadata.tranche, "Fabro repair tranche label") !==
      expected.tranche ||
    fabroRunId(inputs.source_review_run, "Fabro repair source run") !==
      expected.sourceReviewRun ||
    gitSha(inputs.base_sha, "Fabro repair base SHA") !== expected.baseSha ||
    safeAbsolutePath(inputs.workdir, "Fabro repair workdir") !==
      expected.workdir ||
    string(inputs.tranche, "Fabro repair tranche input") !== expected.tranche
  ) {
    throw new Error("Fabro repair labels or inputs do not match reservation");
  }
};

export type RepairRunPhase = "accepted" | "startable";

export const inspectRepairRunPhase = (
  inspection: unknown,
  expected: RepairLaunchAttempt,
): RepairRunPhase => {
  verifyRepairLaunchInspection(inspection, expected);
  const values = Array.isArray(inspection) ? inspection : [inspection];
  const inspected = record(values[0], "Fabro repair inspection");
  const status =
    typeof inspected.status === "string"
      ? inspected.status
      : string(
          record(inspected.status, "Fabro repair status").kind,
          "Fabro repair status kind",
        );
  if (new Set(["created", "pending"]).has(status)) return "startable";
  if (
    new Set([
      "blocked",
      "cancelled",
      "failed",
      "interrupted",
      "pending_control",
      "queued",
      "running",
      "succeeded",
      "waiting",
    ]).has(status)
  ) {
    return "accepted";
  }
  throw new Error(`Fabro repair run has unknown status ${status}`);
};

export const discoverCreatedRepairRun = (input: {
  readonly identity: Omit<RepairLaunchReceiptInput, "runId">;
  readonly inspect: (target: string) => unknown;
  readonly outcomePath: string;
  readonly rawPath: string;
  readonly receiptPath: string;
}): RepairCreateDiscovery => {
  const persistReceipt = (receipt: JsonRecord): void => {
    const content = `${JSON.stringify(receipt, null, 2)}\n`;
    if (existsSync(input.receiptPath)) {
      if (readFileSync(input.receiptPath, "utf8") !== content) {
        throw new Error(
          `repair create receipt conflicts at ${input.receiptPath}`,
        );
      }
      return;
    }
    writeFileSync(input.receiptPath, content, { flag: "wx" });
  };
  const receiptFromRunId = (runId: string): JsonRecord => {
    verifyRepairLaunchInspection(input.inspect(runId), {
      ...input.identity,
      runId,
    });
    const receipt = buildRepairCreateReceipt({ ...input.identity, runId });
    persistReceipt(receipt);
    return receipt;
  };
  const authoritativePreSpawnFailure = (): boolean => {
    if (!existsSync(input.outcomePath)) return false;
    try {
      const outcome = readJsonRecord(input.outcomePath);
      return (
        outcome.schemaVersion === "maestro-rtk-file-outcome/v1" &&
        outcome.kind === "spawn_failed" &&
        outcome.outputPath === resolve(input.rawPath) &&
        outcome.outputSha256 ===
          hashText(readFileSync(input.rawPath, "utf8")) &&
        outcome.status === null
      );
    } catch {
      return false;
    }
  };

  if (existsSync(input.receiptPath)) {
    try {
      const receipt = readJsonRecord(input.receiptPath);
      const runId = fabroRunId(
        receipt.runId,
        "structured repair create run ID",
      );
      const expected = buildRepairCreateReceipt({ ...input.identity, runId });
      if (JSON.stringify(receipt) !== JSON.stringify(expected)) {
        throw new Error("structured repair create receipt identity mismatch");
      }
      verifyRepairLaunchInspection(input.inspect(runId), {
        ...input.identity,
        runId,
      });
      return { kind: "found", receipt };
    } catch (error) {
      return {
        kind: "ambiguous",
        reason: `structured create receipt could not be verified: ${String(error)}`,
      };
    }
  }
  if (!existsSync(input.rawPath)) return { kind: "absent" };

  let rawRunId: string;
  try {
    const raw = JSON.parse(readFileSync(input.rawPath, "utf8")) as {
      readonly run_id?: unknown;
      readonly runId?: unknown;
    };
    rawRunId = fabroRunId(raw.run_id ?? raw.runId, "raw repair create run ID");
  } catch (error) {
    if (authoritativePreSpawnFailure()) {
      return { kind: "absent" };
    }
    return {
      kind: "ambiguous",
      reason: `create output has no exact run ID and remote acceptance is unknown: ${String(error)}`,
    };
  }
  try {
    return { kind: "found", receipt: receiptFromRunId(rawRunId) };
  } catch (error) {
    return {
      kind: "ambiguous",
      reason: `exact created run could not be verified: ${String(error)}`,
    };
  }
};

const writeRepairReservation = (
  path: string,
  current: RepairReservation,
  next: JsonRecord,
): RepairReservation => {
  const temporary = `${path}.next`;
  const currentContent = readFileSync(path, "utf8");
  const nextContent = `${JSON.stringify(
    {
      ...next,
      priorLaunchAttempt: current.launchAttempt,
      priorStartAttempt: current.startAttempt,
      priorStatus: current.status,
      reservationToken: current.reservationToken,
    },
    null,
    2,
  )}\n`;
  if (existsSync(temporary)) {
    if (readFileSync(temporary, "utf8") !== nextContent) {
      throw new Error(`repair launch staging file conflicts at ${temporary}`);
    }
  } else {
    writeFileSync(temporary, nextContent, { flag: "wx" });
  }
  if (readFileSync(path, "utf8") !== currentContent) {
    throw new Error(`repair launch reservation changed at ${path}`);
  }
  const staged = repairReservation(
    JSON.parse(nextContent),
    repairIdentityFromRecord(current),
  );
  validateRepairTransition(current, staged);
  renameSync(temporary, path);
  return staged;
};

const validateRepairTransition = (
  current: RepairReservation,
  staged: RepairReservation,
): void => {
  if (
    current.reservationToken !== staged.reservationToken ||
    current.baseSha !== staged.baseSha ||
    current.integrationBaseSha !== staged.integrationBaseSha ||
    current.sourceReviewRun !== staged.sourceReviewRun ||
    current.tranche !== staged.tranche ||
    current.workdir !== staged.workdir ||
    current.recoveryAt !== staged.recoveryAt ||
    current.recoveryReason !== staged.recoveryReason ||
    current.transitionHash !== staged.transitionHash ||
    JSON.stringify(current.taskIds) !== JSON.stringify(staged.taskIds) ||
    staged.priorStatus !== current.status ||
    staged.priorLaunchAttempt !== current.launchAttempt ||
    staged.priorStartAttempt !== current.startAttempt ||
    (current.createdRunId !== undefined &&
      current.createdRunId !== staged.createdRunId) ||
    (current.createReceipt !== undefined &&
      JSON.stringify(current.createReceipt) !==
        JSON.stringify(staged.createReceipt))
  ) {
    throw new Error(
      "repair promotion residue is not an exact owned transition",
    );
  }
  if (new Set(["created", "starting", "launched"]).has(staged.status)) {
    const createdRunId = validateRepairCreateReceipt(
      staged.createReceipt,
      staged,
    );
    if (staged.createdRunId !== createdRunId) {
      throw new Error("repair created run ID does not match its receipt");
    }
  }
  if (staged.status === "launched") {
    const launchedRunId = validateRepairLaunchReceipt(
      staged.launchReceipt,
      staged,
    );
    if (
      staged.createdRunId !== launchedRunId ||
      staged.runId !== launchedRunId
    ) {
      throw new Error("repair launched run ID does not match created run");
    }
  }
  const legal =
    (current.status === "preparing" &&
      staged.launchAttempt === current.launchAttempt &&
      staged.startAttempt === 0 &&
      new Set(["created", "launch_failed", "launch_unknown"]).has(
        staged.status,
      )) ||
    (current.status === "launch_unknown" &&
      staged.launchAttempt === current.launchAttempt &&
      staged.startAttempt === 0 &&
      new Set(["created", "launch_failed"]).has(staged.status)) ||
    (current.status === "launch_failed" &&
      staged.startAttempt === 0 &&
      ((staged.status === "preparing" &&
        staged.launchAttempt === current.launchAttempt + 1) ||
        (staged.status === "created" &&
          staged.launchAttempt === current.launchAttempt))) ||
    (current.status === "created" &&
      staged.launchAttempt === current.launchAttempt &&
      ((staged.status === "starting" &&
        staged.startAttempt === current.startAttempt + 1) ||
        (staged.status === "launched" &&
          staged.startAttempt === current.startAttempt))) ||
    (current.status === "starting" &&
      staged.launchAttempt === current.launchAttempt &&
      ((staged.status === "starting" &&
        staged.startAttempt === current.startAttempt + 1) ||
        (staged.status === "launched" &&
          staged.startAttempt === current.startAttempt)));
  if (!legal)
    throw new Error("repair promotion residue is an illegal transition");
};

const recoveryTransition = (plan: LegacyIntegrationRecoveryPlan) => {
  const audit = record(plan.auditEvent, "recovery audit transition");
  if (!Array.isArray(audit.legacyIncludedTaskIds)) {
    throw new Error("recovery transition has no task IDs");
  }
  return {
    integrationBaseSha: gitSha(
      audit.baseSha,
      "recovery transition integrationBaseSha",
    ),
    recoveryAt: string(audit.at, "recovery transition at"),
    recoveryReason: string(audit.reason, "recovery transition reason"),
    taskIds: audit.legacyIncludedTaskIds
      .map((taskId, index) =>
        string(taskId, `recovery transition taskIds[${index}]`),
      )
      .sort(),
    transitionHash: hashJson({
      auditEvent: plan.auditEvent,
      normalizedResult: plan.normalizedResult,
    }),
  };
};

const canonicalRecoveryPlan = (
  plan: LegacyIntegrationRecoveryPlan,
  reservation: RepairReservation,
): LegacyIntegrationRecoveryPlan => {
  const requested = recoveryTransition(plan);
  if (requested.recoveryReason !== reservation.recoveryReason) {
    throw new Error("recovery reason does not match reserved transition");
  }
  const normalizedResult = structuredClone(plan.normalizedResult);
  const recovery = record(normalizedResult.recovery, "normalized recovery");
  recovery.at = reservation.recoveryAt;
  const auditEvent = structuredClone(plan.auditEvent);
  auditEvent.at = reservation.recoveryAt;
  const canonical = {
    ...plan,
    auditEvent,
    normalizedResult,
  } satisfies LegacyIntegrationRecoveryPlan;
  const canonicalTransition = recoveryTransition(canonical);
  if (
    canonicalTransition.integrationBaseSha !== reservation.integrationBaseSha ||
    JSON.stringify(canonicalTransition.taskIds) !==
      JSON.stringify(reservation.taskIds) ||
    canonicalTransition.transitionHash !== reservation.transitionHash
  ) {
    throw new Error(
      "reconstructed recovery transition does not match reservation",
    );
  }
  return canonical;
};

const ensureRepairReservation = (
  path: string,
  identity: RepairRecoveryIdentity,
  plan?: LegacyIntegrationRecoveryPlan,
): { readonly created: boolean; readonly reservation: RepairReservation } => {
  if (!existsSync(path)) {
    if (!plan) throw new Error("new recovery reservation requires a plan");
    const transition = recoveryTransition(plan);
    reserveRepairLaunch(path, {
      ...identity,
      ...transition,
      launchAttempt: 1,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      startAttempt: 0,
      status: "preparing",
    });
    return {
      created: true,
      reservation: repairReservation(readJsonRecord(path), identity),
    };
  }
  if (existsSync(`${path}.next`)) {
    const current = repairReservation(readJsonRecord(path), identity);
    const staged = repairReservation(readJsonRecord(`${path}.next`), identity);
    validateRepairTransition(current, staged);
    renameSync(`${path}.next`, path);
  }
  return {
    created: false,
    reservation: repairReservation(readJsonRecord(path), identity),
  };
};

export interface ReconcileRecoveryInput {
  readonly auditPath: string;
  readonly create: (input: Omit<RepairLaunchReceiptInput, "runId">) => unknown;
  readonly discoverCreatedRun: (
    input: Omit<RepairLaunchReceiptInput, "runId">,
  ) => RepairCreateDiscovery;
  readonly fault?: (point: RecoveryFaultPoint) => void;
  readonly identity: RepairRecoveryIdentity;
  readonly inspectRun: (input: RepairLaunchAttempt) => RepairRunPhase;
  readonly plan: LegacyIntegrationRecoveryPlan;
  readonly repairRecordPath: string;
  readonly resultPath: string;
  readonly start: (input: RepairStartInput) => unknown;
}

export interface RepairStartInput extends RepairLaunchReceiptInput {
  readonly startAttempt: number;
}

const repairLaunchInput = (
  reservation: RepairReservation,
): Omit<RepairLaunchReceiptInput, "runId"> => ({
  attempt: reservation.launchAttempt,
  baseSha: reservation.baseSha,
  integrationBaseSha: reservation.integrationBaseSha,
  reservationToken: reservation.reservationToken,
  sourceReviewRun: reservation.sourceReviewRun,
  taskIds: reservation.taskIds,
  tranche: reservation.tranche,
  workdir: reservation.workdir,
});

const verifiedCreateDiscovery = (
  discovery: RepairCreateDiscovery,
  reservation: RepairReservation,
): { readonly receipt: JsonRecord; readonly runId: string } | undefined => {
  if (discovery.kind !== "found") return undefined;
  const runId = validateRepairCreateReceipt(discovery.receipt, reservation);
  return {
    receipt: record(discovery.receipt, "repair create receipt"),
    runId,
  };
};

const recordUnknownLaunch = (
  path: string,
  reservation: RepairReservation,
  reason: string,
): RepairReservation => {
  if (
    reservation.status === "launch_unknown" ||
    reservation.status === "launch_failed"
  ) {
    return reservation;
  }
  return writeRepairReservation(path, reservation, {
    ...repairIdentityFromRecord(reservation),
    ...reservationTransitionFields(reservation),
    failure: reason,
    launchAttempt: reservation.launchAttempt,
    schemaVersion: "maestro-brain-repair-reservation/v1",
    status: "launch_unknown",
  });
};

const promoteVerifiedRepairLaunch = (input: {
  readonly fault?: (point: RecoveryFaultPoint) => void;
  readonly path: string;
  readonly receipt: JsonRecord;
  readonly reservation: RepairReservation;
  readonly runId: string;
}): void => {
  promoteRepairLaunch(
    input.path,
    input.reservation.reservationToken,
    {
      ...repairIdentityFromRecord(input.reservation),
      ...reservationTransitionFields(input.reservation),
      launchAttempt: input.reservation.launchAttempt,
      launchReceipt: input.receipt,
      runId: input.runId,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      status: "launched",
    },
    input.fault,
  );
};

const recordCreatedRepairRun = (input: {
  readonly path: string;
  readonly receipt: JsonRecord;
  readonly reservation: RepairReservation;
  readonly runId: string;
}): RepairReservation =>
  writeRepairReservation(input.path, input.reservation, {
    ...repairIdentityFromRecord(input.reservation),
    ...reservationTransitionFields(input.reservation),
    createReceipt: input.receipt,
    createdRunId: input.runId,
    launchAttempt: input.reservation.launchAttempt,
    schemaVersion: "maestro-brain-repair-reservation/v1",
    startAttempt: 0,
    status: "created",
  });

const reconcileCreatedRepairRun = (input: {
  readonly fault?: (point: RecoveryFaultPoint) => void;
  readonly inspectRun: (input: RepairLaunchAttempt) => RepairRunPhase;
  readonly path: string;
  readonly reservation: RepairReservation;
  readonly start: (input: RepairStartInput) => unknown;
}): { readonly runId: string; readonly status: "launched" } => {
  let reservation = input.reservation;
  const runId = validateRepairCreateReceipt(
    reservation.createReceipt,
    reservation,
  );
  if (reservation.createdRunId !== runId) {
    throw new Error("repair reservation created run ID mismatch");
  }
  const launchIdentity = { ...repairLaunchInput(reservation), runId };
  let phase: RepairRunPhase;
  try {
    phase = input.inspectRun(launchIdentity);
  } catch (error) {
    throw new Error(`exact created-run inspection failed: ${String(error)}`, {
      cause: error,
    });
  }
  if (phase === "accepted") {
    const receipt = buildRepairLaunchReceipt(launchIdentity);
    promoteVerifiedRepairLaunch({
      ...(input.fault ? { fault: input.fault } : {}),
      path: input.path,
      receipt,
      reservation,
      runId,
    });
    return { runId, status: "launched" };
  }
  reservation = writeRepairReservation(input.path, reservation, {
    ...repairIdentityFromRecord(reservation),
    ...reservationTransitionFields(reservation),
    launchAttempt: reservation.launchAttempt,
    schemaVersion: "maestro-brain-repair-reservation/v1",
    startAttempt: reservation.startAttempt + 1,
    status: "starting",
  });
  input.fault?.("after-start-reservation");
  let startError: unknown;
  try {
    input.start({
      ...repairLaunchInput(reservation),
      runId,
      startAttempt: reservation.startAttempt,
    });
  } catch (error) {
    startError = error;
  }
  input.fault?.("after-launch");
  try {
    phase = input.inspectRun({ ...repairLaunchInput(reservation), runId });
  } catch (error) {
    throw new Error(`exact started-run inspection failed: ${String(error)}`, {
      cause: startError ?? error,
    });
  }
  if (phase !== "accepted") {
    if (startError !== undefined) throw startError;
    throw new Error("exact repair run remained startable after fabro start");
  }
  const receipt = buildRepairLaunchReceipt({
    ...repairLaunchInput(reservation),
    runId,
  });
  promoteVerifiedRepairLaunch({
    ...(input.fault ? { fault: input.fault } : {}),
    path: input.path,
    receipt,
    reservation,
    runId,
  });
  return { runId, status: "launched" };
};

const validateRecoveryEvidence = (input: {
  readonly auditPath: string;
  readonly manifestTaskIds: readonly string[];
  readonly reservation: RepairReservation;
  readonly resultPath: string;
}): void => {
  const { reservation } = input;
  const manifestTaskIds = new Set(input.manifestTaskIds);
  if (
    manifestTaskIds.size !== input.manifestTaskIds.length ||
    reservation.taskIds.some((taskId) => !manifestTaskIds.has(taskId))
  ) {
    throw new Error(
      "repair reservation tasks are outside the manifest tranche",
    );
  }
  const result = readJsonRecord(input.resultPath);
  const recovery = record(result.recovery, "normalized recovery history");
  if (
    result.schemaVersion !== "maestro-brain-integration-result/v1" ||
    result.tranche !== reservation.tranche ||
    result.integrationId !== reservation.tranche ||
    result.manifestTranche !== reservation.tranche ||
    result.sourceRunStatus !== "failed" ||
    result.sourceReviewRun !== reservation.sourceReviewRun ||
    recovery.schemaVersion !== "maestro-brain-integration-recovery/v1" ||
    recovery.at !== reservation.recoveryAt ||
    recovery.reason !== reservation.recoveryReason ||
    recovery.sourceRunStatus !== "failed" ||
    recovery.sourceReviewRun !== reservation.sourceReviewRun ||
    recovery.legacyBaseHeadSha !== reservation.integrationBaseSha ||
    recovery.legacyIntegrationHeadSha !== reservation.baseSha ||
    safeAbsolutePath(recovery.legacyWorktree, "recovery legacyWorktree") !==
      reservation.workdir ||
    !Array.isArray(recovery.legacyIncludedTaskIds) ||
    JSON.stringify([...recovery.legacyIncludedTaskIds].sort()) !==
      JSON.stringify([...reservation.taskIds].sort())
  ) {
    throw new Error("durable repair normalized recovery evidence mismatch");
  }
  const auditEvents = readFileSync(input.auditPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => record(JSON.parse(line), "recovery audit event"));
  const matchingAudit = auditEvents.filter(
    (audit) =>
      audit.schemaVersion === "maestro-brain-integration-recovery-audit/v1" &&
      audit.action === "recover-legacy-integration" &&
      audit.at === reservation.recoveryAt &&
      audit.reason === reservation.recoveryReason &&
      audit.sourceRunStatus === "failed" &&
      audit.sourceReviewRun === reservation.sourceReviewRun &&
      audit.tranche === reservation.tranche &&
      audit.baseSha === reservation.integrationBaseSha &&
      audit.headSha === reservation.baseSha &&
      Array.isArray(audit.legacyIncludedTaskIds) &&
      JSON.stringify([...audit.legacyIncludedTaskIds].sort()) ===
        JSON.stringify([...reservation.taskIds].sort()),
  );
  if (matchingAudit.length !== 1) {
    throw new Error("durable repair audit event mismatch");
  }
};

export const reconcileDurableRepairLaunch = (input: {
  readonly auditPath: string;
  readonly expected: RepairRecoveryIdentity & {
    readonly integrationBaseSha: string;
  };
  readonly inspectRun: (input: RepairLaunchAttempt) => RepairRunPhase;
  readonly manifestTaskIds: readonly string[];
  readonly repairRecordPath: string;
  readonly resultPath: string;
  readonly start: (input: RepairStartInput) => unknown;
}): { readonly runId: string; readonly status: "launched" } | undefined => {
  if (!existsSync(input.repairRecordPath)) return undefined;
  const identity: RepairRecoveryIdentity = {
    baseSha: gitSha(input.expected.baseSha, "durable repair baseSha"),
    sourceReviewRun: fabroRunId(
      input.expected.sourceReviewRun,
      "durable repair sourceReviewRun",
    ),
    tranche: safeTranche(input.expected.tranche, "durable repair tranche"),
    workdir: safeAbsolutePath(input.expected.workdir, "durable repair workdir"),
  };
  const { reservation } = ensureRepairReservation(
    input.repairRecordPath,
    identity,
  );
  if (
    reservation.integrationBaseSha !==
    gitSha(input.expected.integrationBaseSha, "durable integration baseSha")
  ) {
    throw new Error("repair reservation integration base mismatch");
  }
  validateRecoveryEvidence({
    auditPath: input.auditPath,
    manifestTaskIds: input.manifestTaskIds,
    reservation,
    resultPath: input.resultPath,
  });
  if (reservation.status === "launched") {
    const runId = validateRepairLaunchReceipt(
      reservation.launchReceipt,
      reservation,
    );
    if (reservation.runId !== runId) {
      throw new Error("repair reservation run ID does not match its receipt");
    }
    if (
      reservation.createdRunId !== runId ||
      input.inspectRun({ ...repairLaunchInput(reservation), runId }) !==
        "accepted"
    ) {
      throw new Error("durable repair run is not the accepted created run");
    }
    return {
      runId,
      status: "launched",
    };
  }
  if (!new Set(["created", "starting"]).has(reservation.status)) {
    return undefined;
  }
  return reconcileCreatedRepairRun({
    inspectRun: input.inspectRun,
    path: input.repairRecordPath,
    reservation,
    start: input.start,
  });
};

export const reconcileLegacyIntegrationRecovery = (
  input: ReconcileRecoveryInput,
): { readonly runId: string; readonly status: "launched" } => {
  const identity: RepairRecoveryIdentity = {
    baseSha: gitSha(input.identity.baseSha, "recovery identity baseSha"),
    sourceReviewRun: fabroRunId(
      input.identity.sourceReviewRun,
      "recovery identity sourceReviewRun",
    ),
    tranche: safeTranche(input.identity.tranche, "recovery identity tranche"),
    workdir: safeAbsolutePath(
      input.identity.workdir,
      "recovery identity workdir",
    ),
  };
  if (
    input.plan.repairBaseSha !== identity.baseSha ||
    input.plan.sourceReviewRun !== identity.sourceReviewRun
  ) {
    throw new Error("recovery plan does not match reservation identity");
  }
  const ensured = ensureRepairReservation(
    input.repairRecordPath,
    identity,
    input.plan,
  );
  let reservation = ensured.reservation;
  const plan = canonicalRecoveryPlan(input.plan, reservation);
  if (ensured.created) input.fault?.("after-reservation");
  if (reservation.status === "launched") {
    const createdRunId = validateRepairCreateReceipt(
      reservation.createReceipt,
      reservation,
    );
    const runId = validateRepairLaunchReceipt(
      reservation.launchReceipt,
      reservation,
    );
    if (
      reservation.runId !== runId ||
      reservation.createdRunId !== runId ||
      createdRunId !== runId ||
      input.inspectRun({ ...repairLaunchInput(reservation), runId }) !==
        "accepted"
    ) {
      throw new Error("repair reservation run ID does not match created run");
    }
    return {
      runId,
      status: "launched",
    };
  }
  if (new Set(["created", "starting"]).has(reservation.status)) {
    return reconcileCreatedRepairRun({
      ...(input.fault ? { fault: input.fault } : {}),
      path: input.repairRecordPath,
      inspectRun: input.inspectRun,
      reservation,
      start: input.start,
    });
  }
  let discovery = input.discoverCreatedRun(repairLaunchInput(reservation));
  let created = verifiedCreateDiscovery(discovery, reservation);
  if (created) {
    reservation = recordCreatedRepairRun({
      path: input.repairRecordPath,
      receipt: created.receipt,
      reservation,
      runId: created.runId,
    });
    input.fault?.("after-create-record");
    return reconcileCreatedRepairRun({
      ...(input.fault ? { fault: input.fault } : {}),
      inspectRun: input.inspectRun,
      path: input.repairRecordPath,
      reservation,
      start: input.start,
    });
  }
  if (discovery.kind === "ambiguous") {
    reservation = recordUnknownLaunch(
      input.repairRecordPath,
      reservation,
      discovery.reason,
    );
    throw new Error(`repair create outcome is ambiguous: ${discovery.reason}`);
  }
  if (reservation.status === "launch_unknown") {
    reservation = writeRepairReservation(input.repairRecordPath, reservation, {
      ...identity,
      ...reservationTransitionFields(reservation),
      failure: "authoritative discovery found no accepted run",
      launchAttempt: reservation.launchAttempt,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      status: "launch_failed",
    });
  }
  persistLegacyIntegrationRecovery({
    auditPath: input.auditPath,
    ...(input.fault ? { fault: input.fault } : {}),
    plan,
    resultPath: input.resultPath,
  });
  if (reservation.status === "launch_failed") {
    reservation = writeRepairReservation(input.repairRecordPath, reservation, {
      ...identity,
      ...reservationTransitionFields(reservation),
      launchAttempt: reservation.launchAttempt + 1,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      startAttempt: 0,
      status: "preparing",
    });
  }
  let createError: unknown;
  let returnedCreate: unknown;
  try {
    returnedCreate = input.create(repairLaunchInput(reservation));
  } catch (error) {
    createError = error;
  }
  if (createError === undefined) {
    const runId = validateRepairCreateReceipt(returnedCreate, reservation);
    created = {
      receipt: record(returnedCreate, "repair create receipt"),
      runId,
    };
    input.fault?.("after-create-output");
  } else {
    discovery = input.discoverCreatedRun(repairLaunchInput(reservation));
    created = verifiedCreateDiscovery(discovery, reservation);
    if (!created) {
      const ambiguous =
        discovery.kind === "ambiguous" ? discovery.reason : undefined;
      reservation = writeRepairReservation(
        input.repairRecordPath,
        reservation,
        {
          ...identity,
          ...reservationTransitionFields(reservation),
          failure: ambiguous ?? "repair create failed before allocation",
          launchAttempt: reservation.launchAttempt,
          schemaVersion: "maestro-brain-repair-reservation/v1",
          status: ambiguous ? "launch_unknown" : "launch_failed",
        },
      );
      if (ambiguous) {
        throw new Error(`repair create outcome is ambiguous: ${ambiguous}`, {
          cause: createError,
        });
      }
      throw createError;
    }
  }
  reservation = recordCreatedRepairRun({
    path: input.repairRecordPath,
    receipt: created.receipt,
    reservation,
    runId: created.runId,
  });
  input.fault?.("after-create-record");
  return reconcileCreatedRepairRun({
    ...(input.fault ? { fault: input.fault } : {}),
    inspectRun: input.inspectRun,
    path: input.repairRecordPath,
    reservation,
    start: input.start,
  });
};

export const repairWorkflowCreateArgs = (input: {
  readonly controlRoot: string;
  readonly evidenceDirectory: string;
  readonly launchAttempt: number;
  readonly recoveryAuditPath: string;
  readonly repairBaseSha: string;
  readonly reservationToken: string;
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
  if (!Number.isInteger(input.launchAttempt) || input.launchAttempt < 1) {
    throw new Error("launchAttempt must be a positive integer");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input.reservationToken,
    )
  ) {
    throw new Error("reservationToken must be a UUID");
  }
  const repairBaseSha = gitSha(input.repairBaseSha, "repairBaseSha");
  const sourceReviewRun = fabroRunId(input.sourceReviewRun, "sourceReviewRun");
  const tranche = safeTranche(input.tranche, "tranche");
  const workdir = safeAbsolutePath(input.workdir, "workdir");
  const workflow = safeAbsolutePath(input.workflow, "workflow");
  return [
    "fabro",
    "create",
    workflow,
    "--json",
    "--no-upgrade-check",
    "--environment",
    "local",
    "--label",
    `tranche=${tranche}`,
    "--label",
    `recovery_token=${input.reservationToken}`,
    "--label",
    `launch_attempt=${input.launchAttempt}`,
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

export const repairWorkflowStartArgs = (runId: string): readonly string[] => [
  "fabro",
  "start",
  fabroRunId(runId, "repair start run ID"),
  "--json",
  "--no-upgrade-check",
  "--quiet",
];

export const readJsonRecord = (path: string): JsonRecord =>
  record(JSON.parse(readFileSync(path, "utf8")), path);
