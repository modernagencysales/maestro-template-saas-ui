import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hydrateWorktreeDependencies } from "./dependencies.js";
import { buildTaskLaunchEnv } from "./build-task-launch-env.js";
import { materializeBuildTaskRunConfig } from "./build-task-run-config.js";
import {
  acquireDispatcherLock,
  promoteTaskReservation,
  recoveryCoordinatesForRecord,
  recoverTaskReservation,
  reserveTaskPreparing,
  runRecordOwnsTask,
} from "./dispatch-ownership.js";
import {
  completedTaskIdsForControlHead,
  type LaneCompletionResult,
} from "./factory-state.js";
import { loadManifestProjection } from "./manifest.js";
import {
  gitBranchExists,
  gitCommonDir,
  gitIsAncestor,
  runRtk,
} from "./process.js";
import { availableDispatchSlots, selectReadyTasks } from "./scheduler.js";

interface RunRecord {
  readonly branch: string;
  readonly runId?: string;
  readonly status?: "launched" | "preparing";
  readonly taskId: string;
  readonly workdir: string;
}

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const maximum = Number(valueAfter("--max") ?? "6");
const launch = process.argv.includes("--launch");
const recoverDispatchLock = process.argv.includes("--recover-dispatch-lock");
const recoverTaskId = valueAfter("--recover-task");
const recoveryReason = valueAfter("--recovery-reason");
const requested = new Set(
  (valueAfter("--tasks") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
if (!Number.isInteger(maximum) || maximum < 1)
  throw new Error("--max total-active-capacity must be a positive integer");
if ((recoverDispatchLock || recoverTaskId) && !recoveryReason?.trim()) {
  throw new Error("explicit recovery requires --recovery-reason");
}

const root = process.cwd();
const controlCommonDir = gitCommonDir(root);
const state = resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain");
const worktreeRoot = resolve(root, "..", ".maestro-brain-fabro-workdirs");
const workflow = resolve(".fabro/workflows/brain-build-task/workflow.fabro");
const evidence = resolve(state, "evidence");
const runDirectory = resolve(state, "runs");
mkdirSync(runDirectory, { recursive: true });
mkdirSync(resolve(evidence, "lane-results"), { recursive: true });
mkdirSync(worktreeRoot, { recursive: true });
const now = new Date().toISOString();
const auditPath = resolve(state, "recovery-audit.jsonl");
const releaseDispatcherLock = acquireDispatcherLock({
  auditPath,
  lockPath: resolve(state, "dispatch.lock"),
  now,
  owner: {
    controlRoot: root,
    controlCommonDir,
    pid: process.pid,
    startedAt: now,
  },
  ...(recoverDispatchLock && recoveryReason ? { recoveryReason } : {}),
});
process.once("exit", releaseDispatcherLock);

const readResult = (taskId: string): LaneCompletionResult | undefined => {
  const path = resolve(evidence, "lane-results", taskId, "lane-result.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as LaneCompletionResult;
};
const resultStatus = (taskId: string): string | undefined =>
  readResult(taskId)?.status;
const recordPath = (taskId: string): string =>
  resolve(runDirectory, `${taskId}.json`);
const readRecord = (taskId: string): RunRecord | undefined => {
  const path = recordPath(taskId);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as RunRecord)
    : undefined;
};
const recordOwnsTask = (record: RunRecord | undefined): boolean =>
  runRecordOwnsTask({
    recordExists: record !== undefined,
    inspect: () => {
      if (!record?.runId) return "preparing";
      const raw = runRtk(
        ["fabro", "inspect", record.runId, "--json", "--quiet"],
        {
          quiet: true,
        },
      );
      const parsed = JSON.parse(raw) as
        | { status?: { kind?: string } | string }
        | readonly { status?: { kind?: string } | string }[];
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      const status =
        typeof item?.status === "string" ? item.status : item?.status?.kind;
      return status;
    },
  });

const projection = loadManifestProjection(root);
const manifest = projection.manifest;
const contractArtifactSha256ByProducer = new Map(
  projection.contract.edges.flatMap((edge) =>
    edge.classification === "contract"
      ? [[edge.producerTaskId, edge.artifact.sha256] as const]
      : [],
  ),
);
const controlHead = runRtk(["git", "rev-parse", "HEAD"], { quiet: true });
if (recoverTaskId) {
  const task = manifest.tasks.find(
    (candidate) => candidate.taskId === recoverTaskId,
  );
  if (!task) throw new Error(`unknown recovery task ${recoverTaskId}`);
  const record = readRecord(task.taskId);
  if (!record)
    throw new Error(`${task.taskId}: no task reservation exists to recover`);
  const recovery = recoveryCoordinatesForRecord({
    record,
    requestedTaskId: task.taskId,
  });
  recoverTaskReservation({
    auditPath,
    branchExists: gitBranchExists(recovery.branch, root),
    now,
    ...(recoveryReason ? { reason: recoveryReason } : {}),
    recordPath: recordPath(task.taskId),
    taskId: task.taskId,
    worktreeExists: existsSync(recovery.workdir),
  });
}
const completedTaskIds = completedTaskIdsForControlHead({
  controlHead,
  isAncestor: (ancestor, descendant) =>
    gitIsAncestor(ancestor, descendant, root),
  resultFor: readResult,
  taskIds: manifest.tasks.map((task) => task.taskId),
});
const activeTasks = manifest.tasks.filter(
  (task) =>
    !completedTaskIds.has(task.taskId) &&
    (recordOwnsTask(readRecord(task.taskId)) ||
      resultStatus(task.taskId) === "lane_green"),
);
const availableSlots = availableDispatchSlots(maximum, activeTasks.length);
const { ready: candidates, selected } = selectReadyTasks({
  activeTaskIds: new Set(activeTasks.map((task) => task.taskId)),
  completedTaskIds,
  contractArtifactSha256ByProducer,
  maximum: availableSlots,
  requestedTaskIds: requested,
  tasks: projection.tasks,
});

console.log(
  JSON.stringify(
    {
      active: activeTasks.map((task) => task.taskId),
      availableSlots,
      launch,
      totalActiveCapacity: maximum,
      ready: candidates.map((task) => task.taskId),
      selected: selected.map((task) => task.taskId),
    },
    null,
    2,
  ),
);
if (!launch) process.exit(0);
if (!existsSync(workflow)) throw new Error(`missing workflow ${workflow}`);

const baseSha = controlHead;
for (const task of selected) {
  const branch = `fabro/brain-${task.taskId.toLowerCase()}`;
  const workdir = resolve(worktreeRoot, task.taskId.toLowerCase());
  const reservationPath = recordPath(task.taskId);
  reserveTaskPreparing(reservationPath, {
    baseSha,
    branch,
    reservedAt: now,
    status: "preparing",
    taskId: task.taskId,
    workdir,
  });
  if (existsSync(workdir)) {
    throw new Error(
      `${task.taskId}: unresolved worktree exists at ${workdir}; no force removal is allowed`,
    );
  }
  if (gitBranchExists(branch, root)) {
    throw new Error(
      `${task.taskId}: unresolved branch ${branch} exists; explicit audited recovery is required`,
    );
  }
  runRtk(["git", "worktree", "add", "-B", branch, workdir, baseSha]);
  hydrateWorktreeDependencies(root, workdir);
  const launchEnv = buildTaskLaunchEnv({
    authorityRepairArchive: "none",
    baseSha,
    controlRoot: root,
    controlCommonDir,
    evidence,
    hostTestMaxLoad1m: "20",
    reproofRequest: "none",
    resumeCommits: "none",
    resumeBranch: "none",
    resumeExpectedCommit: "none",
    resumeProofHead: "none",
    resumeMode: "none",
    resumeSourceHead: "none",
    resumeTaskBase: "none",
    startSha: baseSha,
    taskId: task.taskId,
    workdir,
  });
  const runConfig = materializeBuildTaskRunConfig({
    env: launchEnv,
    graph: workflow,
    path: resolve(state, "launch-configs", `${task.taskId}.toml`),
  });
  const output = runRtk(
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
      `task=${task.taskId}`,
      "-I",
      `workdir=${workdir}`,
      "-I",
      `evidence_dir=${evidence}`,
      "-I",
      `task_id=${task.taskId}`,
      "-I",
      `base_sha=${baseSha}`,
      "-I",
      `control_root=${root}`,
      "-I",
      `control_common_dir=${controlCommonDir}`,
      "-I",
      `start_sha=${baseSha}`,
      "-I",
      "resume_branch=none",
      "-I",
      "resume_expected_commit=none",
      "-I",
      "resume_proof_head=none",
    ],
    {
      quiet: true,
      env: launchEnv,
    },
  );
  const parsed = JSON.parse(output) as { run_id?: string; runId?: string };
  const runId = parsed.run_id ?? parsed.runId;
  if (!runId)
    throw new Error(`${task.taskId}: Fabro did not return a run ID: ${output}`);
  const record = {
    branch,
    runId,
    status: "launched",
    taskId: task.taskId,
    workdir,
  } satisfies RunRecord;
  promoteTaskReservation(reservationPath, record);
  console.log(`${task.taskId}: launched ${runId} in ${workdir}`);
}
