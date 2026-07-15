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
  | "after-launch"
  | "after-normalization"
  | "after-promotion-stage"
  | "after-reservation";

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
    !new Set(["launch_failed", "preparing"]).has(String(reservation.status))
  ) {
    throw new Error(`repair launch reservation changed at ${path}`);
  }
  const promotedContent = `${JSON.stringify(
    { ...recordValue, reservationToken },
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
  readonly launchAttempt: number;
  readonly reservationToken: string;
  readonly schemaVersion: "maestro-brain-repair-reservation/v1";
  readonly sourceReviewRun: string;
  readonly status: "launch_failed" | "launched" | "preparing";
  readonly tranche: string;
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
    Number(reservation.launchAttempt) < 1
  ) {
    throw new Error("repair reservation launch attempt is invalid");
  }
  if (
    !new Set(["launch_failed", "launched", "preparing"]).has(
      String(reservation.status),
    )
  ) {
    throw new Error("repair reservation status is invalid");
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

const writeRepairReservation = (
  path: string,
  current: RepairReservation,
  next: JsonRecord,
): RepairReservation => {
  const temporary = `${path}.next`;
  const currentContent = readFileSync(path, "utf8");
  const nextContent = `${JSON.stringify(
    { ...next, reservationToken: current.reservationToken },
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
  renameSync(temporary, path);
  return record(
    JSON.parse(nextContent),
    "repair reservation",
  ) as unknown as RepairReservation;
};

const ensureRepairReservation = (
  path: string,
  identity: RepairRecoveryIdentity,
): { readonly created: boolean; readonly reservation: RepairReservation } => {
  if (!existsSync(path)) {
    reserveRepairLaunch(path, {
      ...identity,
      launchAttempt: 1,
      schemaVersion: "maestro-brain-repair-reservation/v1",
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
    if (current.reservationToken !== staged.reservationToken) {
      throw new Error("repair promotion residue has different ownership");
    }
    renameSync(`${path}.next`, path);
  }
  return {
    created: false,
    reservation: repairReservation(readJsonRecord(path), identity),
  };
};

export interface ReconcileRecoveryInput {
  readonly auditPath: string;
  readonly discoverLaunchedRun: (input: {
    readonly attempt: number;
    readonly reservationToken: string;
  }) => string | undefined;
  readonly fault?: (point: RecoveryFaultPoint) => void;
  readonly identity: RepairRecoveryIdentity;
  readonly launch: (input: {
    readonly attempt: number;
    readonly reservationToken: string;
  }) => string;
  readonly plan: LegacyIntegrationRecoveryPlan;
  readonly repairRecordPath: string;
  readonly resultPath: string;
}

export const reconcileDurableRepairLaunch = (input: {
  readonly discoverLaunchedRun: (input: {
    readonly attempt: number;
    readonly reservationToken: string;
  }) => string | undefined;
  readonly repairRecordPath: string;
}): { readonly runId: string; readonly status: "launched" } | undefined => {
  if (!existsSync(input.repairRecordPath)) return undefined;
  const raw = readJsonRecord(input.repairRecordPath);
  const identity = repairIdentityFromRecord(raw);
  const { reservation } = ensureRepairReservation(
    input.repairRecordPath,
    identity,
  );
  if (reservation.status === "launched") {
    return {
      runId: fabroRunId(reservation.runId, "repair reservation runId"),
      status: "launched",
    };
  }
  const discovered = input.discoverLaunchedRun({
    attempt: reservation.launchAttempt,
    reservationToken: reservation.reservationToken,
  });
  if (discovered === undefined) return undefined;
  const runId = fabroRunId(discovered, "discovered repair runId");
  promoteRepairLaunch(input.repairRecordPath, reservation.reservationToken, {
    ...identity,
    launchAttempt: reservation.launchAttempt,
    runId,
    schemaVersion: "maestro-brain-repair-reservation/v1",
    status: "launched",
  });
  return { runId, status: "launched" };
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
  const ensured = ensureRepairReservation(input.repairRecordPath, identity);
  let reservation = ensured.reservation;
  if (ensured.created) input.fault?.("after-reservation");
  if (reservation.status === "launched") {
    return {
      runId: fabroRunId(reservation.runId, "repair reservation runId"),
      status: "launched",
    };
  }
  const discoveredRunId = input.discoverLaunchedRun({
    attempt: reservation.launchAttempt,
    reservationToken: reservation.reservationToken,
  });
  if (discoveredRunId !== undefined) {
    const runId = fabroRunId(discoveredRunId, "discovered repair runId");
    promoteRepairLaunch(
      input.repairRecordPath,
      reservation.reservationToken,
      {
        ...identity,
        launchAttempt: reservation.launchAttempt,
        runId,
        schemaVersion: "maestro-brain-repair-reservation/v1",
        status: "launched",
      },
      input.fault,
    );
    return { runId, status: "launched" };
  }
  persistLegacyIntegrationRecovery({
    auditPath: input.auditPath,
    ...(input.fault ? { fault: input.fault } : {}),
    plan: input.plan,
    resultPath: input.resultPath,
  });
  if (reservation.status === "launch_failed") {
    reservation = writeRepairReservation(input.repairRecordPath, reservation, {
      ...identity,
      launchAttempt: reservation.launchAttempt + 1,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      status: "preparing",
    });
  }
  let runId: string;
  try {
    runId = fabroRunId(
      input.launch({
        attempt: reservation.launchAttempt,
        reservationToken: reservation.reservationToken,
      }),
      "launched repair runId",
    );
  } catch (error) {
    writeRepairReservation(input.repairRecordPath, reservation, {
      ...identity,
      failure: "repair launch failed",
      launchAttempt: reservation.launchAttempt,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      status: "launch_failed",
    });
    throw error;
  }
  input.fault?.("after-launch");
  promoteRepairLaunch(
    input.repairRecordPath,
    reservation.reservationToken,
    {
      ...identity,
      launchAttempt: reservation.launchAttempt,
      runId,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      status: "launched",
    },
    input.fault,
  );
  return { runId, status: "launched" };
};

export const repairWorkflowArgs = (input: {
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
    "run",
    workflow,
    "--detach",
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

export const readJsonRecord = (path: string): JsonRecord =>
  record(JSON.parse(readFileSync(path, "utf8")), path);
