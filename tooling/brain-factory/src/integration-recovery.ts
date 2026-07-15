import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

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
  return value.trim();
};

export const integrationLockPath = (state: string, tranche: string): string =>
  resolve(state, "locks", `integration-${tranche}.lock`);

export const acquireIntegrationOwnership = (input: {
  readonly lockPath: string;
  readonly owner: JsonRecord;
}): (() => void) => {
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
  writeFileSync(
    resolve(input.lockPath, "owner.json"),
    `${JSON.stringify(input.owner, null, 2)}\n`,
  );
  return () => rmSync(input.lockPath, { recursive: true });
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
  readonly now: string;
  readonly reason: string | undefined;
  readonly runRecord: unknown;
  readonly tranche: string;
  readonly worktreeClean: boolean;
  readonly worktreeHead: string;
  readonly worktreePath: string;
}): LegacyIntegrationRecoveryPlan => {
  const reason = string(input.reason, "recovery reason");
  const tranche = string(input.tranche, "tranche");
  const run = record(input.runRecord, "run record");
  const result = record(input.integrationResult, "integration result");
  const runId = string(run.runId, "run record runId");
  const baseSha = string(run.baseSha, "run record baseSha");
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
  if (
    resolve(string(run.workdir, "run record workdir")) !== input.worktreePath
  ) {
    throw new Error(`${tranche}: run record worktree mismatch`);
  }

  const failedRun = record(input.failedRun, "Fabro run");
  const failedRunStatus = record(failedRun.status, "Fabro run status").kind;
  if (failedRunStatus !== "failed") {
    throw new Error(
      `${tranche}: source Fabro run is ${String(failedRunStatus ?? "unknown")}; only a verified failed run may be recovered`,
    );
  }
  if (string(failedRun.run_id, "Fabro run ID") !== runId) {
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
  if (string(failedRunInputs.base_sha, "Fabro run base") !== baseSha) {
    throw new Error(`${tranche}: Fabro run base mismatch`);
  }
  if (string(failedRunInputs.tranche, "Fabro run tranche") !== tranche) {
    throw new Error(`${tranche}: Fabro run tranche mismatch`);
  }
  if (
    resolve(string(failedRunInputs.workdir, "Fabro run workdir")) !==
    input.worktreePath
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
  if (input.branchHead !== input.worktreeHead) {
    throw new Error(`${tranche}: branch and worktree heads differ`);
  }
  if (!input.isAncestor(baseSha, input.worktreeHead)) {
    throw new Error(
      `${tranche}: integration base is not an ancestor of its head`,
    );
  }
  if (!input.isAncestor(input.worktreeHead, input.controlHead)) {
    throw new Error(
      `${tranche}: integration head is not an ancestor of control HEAD`,
    );
  }

  const modernFields = [
    result.baseSha,
    result.headSha,
    result.integrationId,
    result.integrationWorkdir,
    result.manifestTranche,
  ];
  if (
    modernFields.every((value) => typeof value === "string" && value.length > 0)
  ) {
    throw new Error(`${tranche}: integration evidence is already versioned`);
  }
  if (
    !Array.isArray(result.includedTasks) ||
    result.includedTasks.length === 0
  ) {
    throw new Error(`${tranche}: legacy evidence has no included tasks`);
  }

  const includedTasks = result.includedTasks.map((value, index) => {
    const task = record(value, `includedTasks[${index}]`);
    const laneHeadSha = string(
      task.laneHeadSha ?? task.taskHeadSha,
      `includedTasks[${index}] lane head`,
    );
    return { ...task, laneHeadSha };
  });
  const previousStatus = result.status ?? null;
  const previousReviewVerdict = result.reviewVerdict ?? null;
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
  const requiredFindingIds = new Set<string>(
    Array.isArray(result.requiredFindingIds)
      ? result.requiredFindingIds.map((value, index) =>
          string(value, `requiredFindingIds[${index}]`),
        )
      : [],
  );
  for (const [index, finding] of previousRemainingFindings.entries()) {
    if (/^(?:critical|high|no-merge)$/i.test(String(finding.severity ?? ""))) {
      requiredFindingIds.add(
        string(finding.id, `remainingFindings[${index}] id`),
      );
    }
  }
  requiredFindingIds.add(recoveryFinding.id);
  const legacy: JsonRecord = { ...result };
  for (const key of [
    "baseSha",
    "broadGate",
    "headSha",
    "integrationId",
    "integrationWorkdir",
    "manifestTranche",
  ]) {
    delete legacy[key];
  }
  const normalizedResult: JsonRecord = {
    ...legacy,
    baseSha,
    headSha: input.worktreeHead,
    includedTasks,
    integrationId: tranche,
    integrationWorkdir: input.worktreePath,
    manifestTranche: tranche,
    recovery: {
      at: input.now,
      previousReviewVerdict,
      previousStatus,
      reason,
      sourceRunStatus: "failed",
      sourceReviewRun: runId,
    },
    remainingFindings: [...previousRemainingFindings, recoveryFinding],
    requiredFindingIds: [...requiredFindingIds].sort(),
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
      headSha: input.worktreeHead,
      previousReviewVerdict,
      previousStatus,
      reason,
      sourceRunStatus: "failed",
      sourceReviewRun: runId,
      tranche,
    },
    normalizedResult,
    repairBaseSha: input.worktreeHead,
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
): void => {
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
    writeFileSync(descriptor, `${JSON.stringify(reservation, null, 2)}\n`);
  } finally {
    closeSync(descriptor);
  }
};

export const promoteRepairLaunch = (
  path: string,
  recordValue: JsonRecord,
): void => {
  const temporary = `${path}.next`;
  writeFileSync(temporary, `${JSON.stringify(recordValue, null, 2)}\n`, {
    flag: "wx",
  });
  renameSync(temporary, path);
};

export const repairWorkflowArgs = (input: {
  readonly controlRoot: string;
  readonly evidenceDirectory: string;
  readonly repairBaseSha: string;
  readonly sourceReviewRun: string;
  readonly tranche: string;
  readonly workdir: string;
  readonly workflow: string;
}): readonly string[] => [
  "fabro",
  "run",
  input.workflow,
  "--detach",
  "--json",
  "--no-upgrade-check",
  "--environment",
  "local",
  "--label",
  `tranche=${input.tranche}`,
  "-I",
  `workdir=${input.workdir}`,
  "-I",
  `evidence_dir=${input.evidenceDirectory}`,
  "-I",
  `tranche=${input.tranche}`,
  "-I",
  `base_sha=${input.repairBaseSha}`,
  "-I",
  `source_review_run=${input.sourceReviewRun}`,
  "-I",
  `control_root=${input.controlRoot}`,
];

export const readJsonRecord = (path: string): JsonRecord =>
  record(JSON.parse(readFileSync(path, "utf8")), path);
