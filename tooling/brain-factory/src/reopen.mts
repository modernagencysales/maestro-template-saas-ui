import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  buildContractReproofRequest,
  buildRefreshedContractReproofRequest,
} from "./contract-reproof.js";
import { admitContractReproof } from "./contract-reproof-admission.js";
import { buildTaskLaunchEnv } from "./build-task-launch-env.js";
import { materializeBuildTaskRunConfig } from "./build-task-run-config.js";
import { hydrateWorktreeDependencies } from "./dependencies.js";
import {
  acquireDispatcherLock,
  archiveTerminalTaskRecord,
  promoteTaskReservation,
  reserveTaskPreparing,
} from "./dispatch-ownership.js";
import { completedTaskIdsForControlHead } from "./factory-state.js";
import { planFailedIntegrationRework } from "./failed-integration-rework.js";
import { integrationResultBindsBroadGate } from "./failed-integration-rework-validation.js";
import { buildManifest } from "./manifest.js";
import {
  gitBranchExists,
  gitCommonDir,
  gitIsAncestor,
  runRtk,
} from "./process.js";
import {
  serializeResumeCommits,
  validateResumeSource,
} from "./resume-support.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const taskId = valueAfter("--task");
const reason = valueAfter("--reason")?.trim();
const failedIntegrationId = valueAfter("--failed-integration");
const ownerFindingsSha256 = valueAfter("--owner-findings-sha256");
const launch = process.argv.includes("--launch");
if (!taskId || !reason) {
  throw new Error(
    "usage: brain:factory:reopen -- --task <id> --reason <text> [--failed-integration wave-NNNNNN] [--launch]",
  );
}
if (
  ownerFindingsSha256 !== undefined &&
  !/^[0-9a-f]{64}$/.test(ownerFindingsSha256)
) {
  throw new Error(`${taskId}: owner findings hash is invalid`);
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const terminalStatuses = new Set([
  "canceled",
  "cancelled",
  "failed",
  "succeeded",
]);
const inspectStatus = (runId: string): string => {
  const parsed = JSON.parse(
    runRtk(["fabro", "inspect", runId, "--json", "--quiet"], { quiet: true }),
  ) as { status?: { kind?: string } | string }[];
  const value = parsed[0]?.status;
  const status = typeof value === "string" ? value : value?.kind;
  if (!status) throw new Error(`${taskId}: Fabro run ${runId} has no status`);
  return status;
};
const controlTreeIsClean = (): boolean =>
  runRtk(["proxy", "git", "status", "--porcelain"], { quiet: true })
    .split("\n")
    .filter((line) => line.trim() !== "")
    .every((line) => line.slice(3).trim() === ".mcp.json");

const root = process.cwd();
const controlCommonDir = gitCommonDir(root);
const state = resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain");
const evidence = resolve(state, "evidence");
const laneDirectory = resolve(evidence, "lane-results", taskId);
const lanePath = resolve(laneDirectory, "lane-result.json");
if (!existsSync(lanePath)) throw new Error(`${taskId}: lane result is missing`);
const laneContent = readFileSync(lanePath, "utf8");
const lane = JSON.parse(laneContent) as Record<string, unknown>;
if (
  !new Set(["integrated", "accepted", "lane_green"]).has(String(lane.status))
) {
  throw new Error(
    `${taskId}: only integrated, accepted, or already re-proved lane_green tasks may be re-proved`,
  );
}
const manifest = buildManifest(root);
const task = manifest.tasks.find((candidate) => candidate.taskId === taskId);
if (!task) throw new Error(`unknown task ${taskId}`);
const controlHeadSha = runRtk(["git", "rev-parse", "HEAD"], { quiet: true });
const completedTaskIds = completedTaskIdsForControlHead({
  controlHead: controlHeadSha,
  isAncestor: (ancestor, descendant) =>
    gitIsAncestor(ancestor, descendant, root),
  resultFor: (candidateTaskId) => {
    const path = resolve(
      evidence,
      "lane-results",
      candidateTaskId,
      "lane-result.json",
    );
    return existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as {
          integrationHeadSha?: string;
          status?: string;
        })
      : undefined;
  },
  taskIds: manifest.tasks.map((candidate) => candidate.taskId),
});
const unmetCodeStart = task.codeStartAfter.filter(
  (dependency) => !completedTaskIds.has(dependency),
);
if (unmetCodeStart.length > 0) {
  throw new Error(
    `${taskId}: contract reproof waits for code-start dependencies ${unmetCodeStart.join(", ")}`,
  );
}
const refreshedLane = lane.status === "lane_green";
const laneReproof =
  typeof lane.reproof === "object" &&
  lane.reproof !== null &&
  !Array.isArray(lane.reproof)
    ? (lane.reproof as Record<string, unknown>)
    : undefined;
if (failedIntegrationId && !/^wave-\d{6}$/.test(failedIntegrationId)) {
  throw new Error(`${taskId}: failed integration ID is invalid`);
}
if (failedIntegrationId && lane.status !== "lane_green") {
  throw new Error(`${taskId}: failed integration rework requires lane_green`);
}
if (failedIntegrationId && laneReproof) {
  throw new Error(`${taskId}: failed integration rework lineage is ambiguous`);
}
const failedSelectionPath = failedIntegrationId
  ? resolve(state, "runs", `integration-${failedIntegrationId}-selection.json`)
  : undefined;
if (failedSelectionPath && !existsSync(failedSelectionPath)) {
  throw new Error(`${taskId}: failed wave selection is missing`);
}
const failedSelection = failedSelectionPath
  ? (JSON.parse(readFileSync(failedSelectionPath, "utf8")) as Record<
      string,
      unknown
    >)
  : undefined;
const priorIntegrationId = String(
  failedIntegrationId ??
    (refreshedLane ? laneReproof?.priorIntegrationId : lane.integrationId) ??
    "",
);
const priorIntegrationHeadSha = String(
  failedIntegrationId
    ? (failedSelection?.baseSha ?? "")
    : refreshedLane
      ? (laneReproof?.priorIntegrationHeadSha ?? "")
      : lane.integrationHeadSha,
);
const integrationResultPath = resolve(
  evidence,
  "integration",
  priorIntegrationId,
  "integration-result.json",
);
const priorIntegrationResult = existsSync(integrationResultPath)
  ? (JSON.parse(readFileSync(integrationResultPath, "utf8")) as Record<
      string,
      unknown
    >)
  : undefined;
const effectivePriorIntegrationHeadSha =
  failedIntegrationId && typeof priorIntegrationResult?.headSha === "string"
    ? priorIntegrationResult.headSha
    : priorIntegrationHeadSha;
if (
  !priorIntegrationId ||
  !/^[0-9a-f]{40}$/.test(priorIntegrationHeadSha) ||
  !gitIsAncestor(priorIntegrationHeadSha, controlHeadSha, root)
) {
  throw new Error(`${taskId}: prior integration is not authoritative on HEAD`);
}
const archiveManifestPath = resolve(
  evidence,
  "archive",
  priorIntegrationId,
  "archive-manifest.json",
);
if (!existsSync(integrationResultPath)) {
  throw new Error(`${taskId}: prior integration result is missing`);
}
const baseRequestDirectory = resolve(
  evidence,
  "reproofs",
  taskId,
  task.taskBlockHash,
);
const requestDirectory = refreshedLane
  ? resolve(baseRequestDirectory, controlHeadSha)
  : baseRequestDirectory;
let legacySnapshotContent = `${JSON.stringify(
  {
    schemaVersion: "maestro-brain-prior-evidence-snapshot/v1",
    taskId,
    integrationResult: JSON.parse(readFileSync(integrationResultPath, "utf8")),
    laneResult: lane,
    proof: existsSync(resolve(laneDirectory, "ci-proof-packet.json"))
      ? JSON.parse(
          readFileSync(resolve(laneDirectory, "ci-proof-packet.json"), "utf8"),
        )
      : null,
    gate: existsSync(resolve(laneDirectory, "lane-gate-report.json"))
      ? JSON.parse(
          readFileSync(resolve(laneDirectory, "lane-gate-report.json"), "utf8"),
        )
      : null,
    adoption: existsSync(resolve(laneDirectory, "lane-evidence-adoption.json"))
      ? JSON.parse(
          readFileSync(
            resolve(laneDirectory, "lane-evidence-adoption.json"),
            "utf8",
          ),
        )
      : null,
  },
  null,
  2,
)}\n`;
let priorEvidencePath: string;
let priorArchiveSha256: string;
let failedReworkPlan:
  ReturnType<typeof planFailedIntegrationRework> | undefined;
if (failedIntegrationId) {
  if (!failedSelectionPath)
    throw new Error(`${taskId}: failed wave selection is missing`);
  const integrationDirectory = resolve(
    evidence,
    "integration",
    failedIntegrationId,
  );
  const failedIntegrationResult = JSON.parse(
    readFileSync(integrationResultPath, "utf8"),
  ) as Record<string, unknown>;
  if (ownerFindingsSha256) {
    const ownerFindings = Array.isArray(
      failedIntegrationResult.remainingFindings,
    )
      ? failedIntegrationResult.remainingFindings
          .filter(
            (finding) =>
              typeof finding === "object" &&
              finding !== null &&
              !Array.isArray(finding) &&
              (finding as Record<string, unknown>).taskId === taskId,
          )
          .sort((left, right) =>
            String((left as Record<string, unknown>).id).localeCompare(
              String((right as Record<string, unknown>).id),
            ),
          )
      : [];
    if (
      ownerFindings.length === 0 ||
      sha256(JSON.stringify(ownerFindings)) !== ownerFindingsSha256
    ) {
      throw new Error(`${taskId}: owner findings subset hash mismatch`);
    }
  }
  const broadGatePath = resolve(
    integrationDirectory,
    `broad-gate-${String(failedIntegrationResult.headSha ?? "")}.json`,
  );
  const broadGateExists =
    existsSync(broadGatePath) &&
    integrationResultBindsBroadGate(failedIntegrationResult);
  const supersessionPath = resolve(integrationDirectory, "supersession.json");
  const promotionPath = resolve(integrationDirectory, "promotion.json");
  const typeCoverageFinding = Array.isArray(
    failedIntegrationResult.remainingFindings,
  )
    ? failedIntegrationResult.remainingFindings.some(
        (finding) =>
          typeof finding === "object" &&
          finding !== null &&
          !Array.isArray(finding) &&
          typeof (finding as { readonly id?: unknown }).id === "string" &&
          (finding as { readonly id: string }).id.includes("type-coverage"),
      )
    : false;
  const typeCoverageRegressionPath = typeCoverageFinding
    ? resolve(
        integrationDirectory,
        `type-coverage-regression-${String(failedIntegrationResult.headSha ?? "")}.json`,
      )
    : undefined;
  const proofPath = resolve(laneDirectory, "ci-proof-packet.json");
  const finalGatePath = resolve(laneDirectory, "lane-gate-report.json");
  const sourceRecordPath = resolve(state, "runs", `${taskId}.json`);
  const failedRunRecordPath = resolve(
    state,
    "runs",
    `integration-${failedIntegrationId}.json`,
  );
  for (const [path, label] of [
    ...(broadGateExists
      ? ([[broadGatePath, "failed broad gate receipt"]] as const)
      : []),
    [supersessionPath, "failed wave supersession"],
    [proofPath, "lane proof"],
    [finalGatePath, "lane final gate"],
    [sourceRecordPath, "source run record"],
    [failedRunRecordPath, "failed wave run record"],
    ...(typeCoverageRegressionPath
      ? ([
          [typeCoverageRegressionPath, "type coverage regression evidence"],
        ] as const)
      : []),
  ] as const) {
    if (!existsSync(path)) throw new Error(`${taskId}: ${label} is missing`);
  }
  const sourceRecord = JSON.parse(
    readFileSync(sourceRecordPath, "utf8"),
  ) as Record<string, unknown>;
  const sourceWorkdir = String(sourceRecord.workdir ?? "");
  const sourceBranch = String(sourceRecord.branch ?? "");
  const planInput = {
    ...(broadGateExists
      ? { broadGateContent: readFileSync(broadGatePath, "utf8") }
      : {}),
    controlClean: controlTreeIsClean(),
    controlHeadSha,
    dependenciesIntegrated: task.codeStartAfter.every((dependency) =>
      completedTaskIds.has(dependency),
    ),
    expectedSourceBranch: sourceBranch,
    gateContent: readFileSync(finalGatePath, "utf8"),
    integrationResultContent: readFileSync(integrationResultPath, "utf8"),
    isAncestor: (ancestor: string, descendant: string) =>
      gitIsAncestor(ancestor, descendant, root),
    laneContent,
    manifestTaskBlockHash: task.taskBlockHash,
    planSha256: manifest.planSha256,
    promotionExists: existsSync(promotionPath),
    proofContent: readFileSync(proofPath, "utf8"),
    reason,
    runRecordContent: readFileSync(failedRunRecordPath, "utf8"),
    selectionContent: readFileSync(failedSelectionPath, "utf8"),
    selectionPath: failedSelectionPath,
    sourceBranch: runRtk(
      ["git", "-C", sourceWorkdir, "branch", "--show-current"],
      {
        quiet: true,
      },
    ),
    sourceBranchHeadSha: runRtk(
      ["git", "rev-parse", `refs/heads/${sourceBranch}`],
      { quiet: true },
    ),
    sourceClean:
      runRtk(["proxy", "git", "-C", sourceWorkdir, "status", "--porcelain"], {
        quiet: true,
      }) === "",
    sourceWorktreeHeadSha: runRtk(
      ["git", "-C", sourceWorkdir, "rev-parse", "HEAD"],
      { quiet: true },
    ),
    supersessionContent: readFileSync(supersessionPath, "utf8"),
    taskId,
    ...(typeCoverageRegressionPath
      ? {
          typeCoverageRegressionContent: readFileSync(
            typeCoverageRegressionPath,
            "utf8",
          ),
        }
      : {}),
  };
  const provisional = planFailedIntegrationRework({
    ...planInput,
    priorEvidencePath: resolve(integrationDirectory, "pending.json"),
  });
  priorArchiveSha256 = sha256(provisional.archiveContent);
  priorEvidencePath = resolve(
    evidence,
    "archive",
    failedIntegrationId,
    `${priorArchiveSha256}.json`,
  );
  failedReworkPlan = planFailedIntegrationRework({
    ...planInput,
    priorEvidencePath,
  });
  legacySnapshotContent = failedReworkPlan.archiveContent;
} else if (existsSync(archiveManifestPath)) {
  const archiveManifest = JSON.parse(
    readFileSync(archiveManifestPath, "utf8"),
  ) as Record<string, unknown>;
  priorArchiveSha256 = String(archiveManifest.contentSha256 ?? "");
  priorEvidencePath = resolve(
    evidence,
    "archive",
    priorIntegrationId,
    String(archiveManifest.artifactFile ?? ""),
  );
  if (
    !/^[0-9a-f]{64}$/.test(priorArchiveSha256) ||
    !existsSync(priorEvidencePath) ||
    sha256(readFileSync(priorEvidencePath, "utf8")) !== priorArchiveSha256
  ) {
    throw new Error(`${taskId}: prior immutable archive does not verify`);
  }
} else {
  priorArchiveSha256 = sha256(legacySnapshotContent);
  priorEvidencePath = resolve(
    requestDirectory,
    `${priorArchiveSha256}.prior-evidence.json`,
  );
}
let refreshResume:
  | {
      readonly sourceHeadSha: string;
      readonly taskBaseSha: string;
      readonly taskCommits: readonly string[];
    }
  | undefined;
let refreshSnapshots:
  readonly { readonly content: string; readonly path: string }[] | undefined;
if (failedReworkPlan) {
  const proof = JSON.parse(
    readFileSync(resolve(laneDirectory, "ci-proof-packet.json"), "utf8"),
  ) as Record<string, unknown>;
  refreshResume = validateResumeSource({
    runGit: (args) => runRtk(args, { quiet: true }),
    sourceRef: String(lane.headSha ?? ""),
    taskBase: String(proof.baseSha ?? ""),
    taskId,
  });
}
const request = (() => {
  if (failedReworkPlan) return failedReworkPlan.request;
  if (!refreshedLane) {
    return buildContractReproofRequest({
      controlHeadSha,
      planSha256: manifest.planSha256,
      priorArchiveSha256,
      priorIntegrationHeadSha: effectivePriorIntegrationHeadSha,
      priorIntegrationId,
      priorIntegrationResultSha256: sha256(
        readFileSync(integrationResultPath, "utf8"),
      ),
      priorLaneResultSha256: sha256(laneContent),
      priorEvidencePath,
      reason,
      taskBlockHash: task.taskBlockHash,
      taskId,
    });
  }
  const previousRequestPath = String(laneReproof?.requestPath ?? "");
  if (!previousRequestPath || !existsSync(previousRequestPath)) {
    throw new Error(`${taskId}: prior reproof request is missing`);
  }
  const previousRequestContent = readFileSync(previousRequestPath, "utf8");
  const previousRequest = JSON.parse(previousRequestContent) as Record<
    string,
    unknown
  >;
  const proofPath = resolve(laneDirectory, "ci-proof-packet.json");
  const finalGatePath = resolve(laneDirectory, "lane-gate-report.json");
  if (!existsSync(proofPath) || !existsSync(finalGatePath)) {
    throw new Error(`${taskId}: prior reproof proof or final gate is missing`);
  }
  const proofContent = readFileSync(proofPath, "utf8");
  const proof = JSON.parse(proofContent) as Record<string, unknown>;
  const finalGateContent = readFileSync(finalGatePath, "utf8");
  const finalGate = JSON.parse(finalGateContent) as Record<string, unknown>;
  const priorLanePath = resolve(requestDirectory, "prior-lane-result.json");
  const priorProofPath = resolve(requestDirectory, "prior-proof.json");
  const priorFinalGatePath = resolve(requestDirectory, "prior-final-gate.json");
  const laneHeadSha = String(lane.headSha ?? "");
  const laneTreeSha = runRtk(
    ["git", "rev-parse", "--verify", `${laneHeadSha}^{tree}`],
    { quiet: true },
  );
  const refreshed = buildRefreshedContractReproofRequest({
    currentControlHeadSha: controlHeadSha,
    currentPlanSha256: manifest.planSha256,
    currentTaskBlockHash: task.taskBlockHash,
    finalGateContent,
    finalGatePath: priorFinalGatePath,
    finalGateReport: finalGate,
    lane,
    laneContent,
    lanePath: priorLanePath,
    laneTreeSha,
    previousRequest,
    previousRequestContent,
    previousRequestPath,
    proof,
    proofContent,
    proofPath: priorProofPath,
    priorReproofSourceHeadSha: laneHeadSha,
    reason,
    taskId,
  });
  const admitted = admitContractReproof({
    allowAuthorityRefreshAdvance: true,
    changedFilesBetween: (ancestor, descendant) =>
      runRtk(["git", "diff", "--name-only", `${ancestor}..${descendant}`], {
        quiet: true,
      })
        .split("\n")
        .filter(Boolean),
    currentControlHead: controlHeadSha,
    evidenceDirectory: evidence,
    fileLocks: task.fileLocks,
    isAncestor: (ancestor, descendant) =>
      gitIsAncestor(ancestor, descendant, root),
    lanePriorIntegrationHeadSha: laneReproof?.priorIntegrationHeadSha,
    lanePriorIntegrationId: laneReproof?.priorIntegrationId,
    laneRequestSha256: laneReproof?.requestSha256,
    planSha256: String(previousRequest.planSha256 ?? ""),
    proofBaseSha: String(previousRequest.controlHeadSha ?? ""),
    requestPath: previousRequestPath,
    taskBlockHash: task.taskBlockHash,
    taskId,
  });
  if (admitted.request.requestSha256 !== String(laneReproof?.requestSha256)) {
    throw new Error(`${taskId}: ambiguous prior reproof request lineage`);
  }
  refreshResume = validateResumeSource({
    runGit: (args) => runRtk(args, { quiet: true }),
    sourceRef: laneHeadSha,
    taskBase: String(proof.baseSha ?? ""),
    taskId,
  });
  refreshSnapshots = [
    { content: laneContent, path: priorLanePath },
    { content: proofContent, path: priorProofPath },
    { content: finalGateContent, path: priorFinalGatePath },
  ];
  return refreshed;
})();
const requestPath = resolve(requestDirectory, "request.json");
const requestContent = `${JSON.stringify(request, null, 2)}\n`;
console.log(JSON.stringify({ launch, requestPath, request }, null, 2));
if (!launch) process.exit(0);

mkdirSync(requestDirectory, { recursive: true });
for (const snapshot of refreshSnapshots ?? []) {
  if (existsSync(snapshot.path)) {
    if (readFileSync(snapshot.path, "utf8") !== snapshot.content) {
      throw new Error(`${taskId}: reproof lineage snapshot replay differs`);
    }
  } else {
    writeFileSync(snapshot.path, snapshot.content, { flag: "wx" });
  }
}
if (!existsSync(priorEvidencePath)) {
  mkdirSync(dirname(priorEvidencePath), { recursive: true });
  writeFileSync(priorEvidencePath, legacySnapshotContent, { flag: "wx" });
}
if (sha256(readFileSync(priorEvidencePath, "utf8")) !== priorArchiveSha256) {
  throw new Error(`${taskId}: prior evidence snapshot drift`);
}
if (existsSync(requestPath)) {
  if (readFileSync(requestPath, "utf8") !== requestContent) {
    throw new Error(`${taskId}: reproof request replay differs`);
  }
} else {
  writeFileSync(requestPath, requestContent, { flag: "wx" });
}
if (failedReworkPlan) {
  admitContractReproof({
    allowAuthorityRefreshAdvance: true,
    changedFilesBetween: (ancestor, descendant) =>
      runRtk(["git", "diff", "--name-only", `${ancestor}..${descendant}`], {
        quiet: true,
      })
        .split("\n")
        .filter(Boolean),
    currentControlHead: controlHeadSha,
    evidenceDirectory: evidence,
    fileLocks: task.fileLocks,
    isAncestor: (ancestor, descendant) =>
      gitIsAncestor(ancestor, descendant, root),
    lanePriorIntegrationHeadSha: request.priorIntegrationHeadSha,
    lanePriorIntegrationId: request.priorIntegrationId,
    laneRequestSha256: request.requestSha256,
    planSha256: manifest.planSha256,
    proofBaseSha: controlHeadSha,
    requestPath,
    taskBlockHash: task.taskBlockHash,
    taskId,
  });
}
const runs = resolve(state, "runs");
mkdirSync(runs, { recursive: true });
const now = new Date().toISOString();
const auditPath = resolve(state, "recovery-audit.jsonl");
const releaseLock = acquireDispatcherLock({
  auditPath,
  lockPath: resolve(state, "dispatch.lock"),
  now,
  owner: {
    controlRoot: root,
    mode: "contract-reproof",
    pid: process.pid,
    startedAt: now,
    taskId,
  },
});
process.once("exit", releaseLock);
const recordPath = resolve(runs, `${taskId}.json`);
if (existsSync(recordPath)) {
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
    runId?: string;
  };
  if (!record.runId)
    throw new Error(`${taskId}: incomplete reservation owns task`);
  const status = inspectStatus(record.runId);
  if (!terminalStatuses.has(status)) {
    throw new Error(
      `${taskId}: live run ${record.runId} (${status}) owns task`,
    );
  }
  archiveTerminalTaskRecord({
    auditPath,
    now,
    recordPath,
    runId: record.runId,
    status,
    taskId,
  });
}
const workdir = resolve(
  root,
  "..",
  ".maestro-brain-fabro-workdirs",
  `reproof-${taskId.toLowerCase()}${refreshedLane ? `-${controlHeadSha.slice(0, 8)}` : ""}`,
);
const branch = `fabro/reproof-${taskId.toLowerCase()}${refreshedLane ? `-${controlHeadSha.slice(0, 8)}` : ""}`;
if (existsSync(workdir) || gitBranchExists(branch, root)) {
  throw new Error(`${taskId}: unresolved reproof worktree or branch exists`);
}
reserveTaskPreparing(recordPath, {
  branch,
  mode: "contract-reproof",
  requestSha256: request.requestSha256,
  ...(ownerFindingsSha256 ? { ownerFindingsSha256 } : {}),
  ...(refreshResume
    ? {
        resumeStrategy: "in-lane-cherry-pick",
        sourceHeadSha: refreshResume.sourceHeadSha,
        taskBaseSha: refreshResume.taskBaseSha,
      }
    : {}),
  status: "preparing",
  taskId,
  workdir,
});
runRtk(["git", "worktree", "add", "-b", branch, workdir, controlHeadSha]);
hydrateWorktreeDependencies(root, workdir);
const workflow = resolve(".fabro/workflows/brain-build-task/workflow.fabro");
const launchEnv = buildTaskLaunchEnv({
  authorityRepairArchive: "none",
  baseSha: controlHeadSha,
  controlRoot: root,
  controlCommonDir,
  evidence,
  hostTestMaxLoad1m: "20",
  reproofRequest: requestPath,
  resumeCommits: refreshResume
    ? serializeResumeCommits(taskId, refreshResume.taskCommits)
    : "none",
  resumeBranch: refreshResume ? branch : "none",
  resumeExpectedCommit: "none",
  resumeProofHead: "none",
  resumeMode: refreshResume ? "conflict-aware" : "none",
  resumeSourceHead: refreshResume?.sourceHeadSha ?? "none",
  resumeTaskBase: refreshResume?.taskBaseSha ?? "none",
  startSha: controlHeadSha,
  taskId,
  workdir,
});
const runConfig = materializeBuildTaskRunConfig({
  env: launchEnv,
  graph: workflow,
  path: resolve(state, "launch-configs", `reproof-${taskId}.toml`),
});
const output = JSON.parse(
  runRtk(
    [
      "fabro",
      "run",
      runConfig,
      "--detach",
      "--json",
      "--no-upgrade-check",
      "--environment",
      "local",
      "--label",
      `task=${taskId}`,
      "--label",
      "mode=contract-reproof",
      "-I",
      `workdir=${workdir}`,
      "-I",
      `evidence_dir=${evidence}`,
      "-I",
      `task_id=${taskId}`,
      "-I",
      `base_sha=${controlHeadSha}`,
      "-I",
      `control_root=${root}`,
      "-I",
      `control_common_dir=${controlCommonDir}`,
      "-I",
      `start_sha=${controlHeadSha}`,
      "-I",
      `resume_branch=${refreshResume ? branch : "none"}`,
      "-I",
      "resume_expected_commit=none",
      "-I",
      "resume_proof_head=none",
      ...(refreshResume
        ? [
            "-I",
            "resume_mode=conflict-aware",
            "-I",
            `resume_source_head=${refreshResume.sourceHeadSha}`,
            "-I",
            `resume_task_base=${refreshResume.taskBaseSha}`,
            "-I",
            `resume_commits=${serializeResumeCommits(taskId, refreshResume.taskCommits)}`,
          ]
        : []),
      "-I",
      `reproof_request=${requestPath}`,
    ],
    {
      quiet: true,
      env: launchEnv,
    },
  ),
) as { run_id?: string; runId?: string };
const runId = output.run_id ?? output.runId;
if (!runId) throw new Error(`${taskId}: Fabro did not return a run ID`);
promoteTaskReservation(recordPath, {
  branch,
  mode: "contract-reproof",
  requestSha256: request.requestSha256,
  ...(ownerFindingsSha256 ? { ownerFindingsSha256 } : {}),
  ...(refreshResume
    ? {
        resumeStrategy: "in-lane-cherry-pick",
        sourceHeadSha: refreshResume.sourceHeadSha,
        taskBaseSha: refreshResume.taskBaseSha,
      }
    : {}),
  runId,
  status: "launched",
  taskId,
  workdir,
});
console.log(`${taskId}: contract reproof launched as ${runId}`);
