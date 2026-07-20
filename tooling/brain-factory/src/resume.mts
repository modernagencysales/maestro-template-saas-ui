import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hydrateWorktreeDependencies } from "./dependencies.js";
import { buildTaskLaunchEnv } from "./build-task-launch-env.js";
import { materializeBuildTaskRunConfig } from "./build-task-run-config.js";
import {
  acquireDispatcherLock,
  archiveTerminalTaskRecord,
  preservedResumeDisposition,
  promoteTaskReservation,
  reserveTaskPreparing,
  resolvePreservedFactoryBase,
} from "./dispatch-ownership.js";
import { buildManifest } from "./manifest.js";
import { gitBranchExists, gitIsAncestor, runRtk } from "./process.js";
import {
  serializeResumeCommits,
  validateResumeSource,
} from "./resume-support.js";

interface ResumeRecord {
  readonly branch: string;
  readonly factoryBaseSha?: string;
  readonly mode?: "resume-review";
  readonly runId?: string;
  readonly resumeStrategy?: "in-lane-cherry-pick" | "prelaunch-cherry-pick";
  readonly sourceHeadSha?: string;
  readonly status?: "launched" | "preparing";
  readonly taskBaseSha?: string;
  readonly taskId: string;
  readonly workdir: string;
}

const inspectedStatus = (runId: string): string => {
  const parsed = JSON.parse(
    runRtk(["fabro", "inspect", runId, "--json", "--quiet"], { quiet: true }),
  ) as
    | { status?: { kind?: string } | string }
    | readonly { status?: { kind?: string } | string }[];
  const item = Array.isArray(parsed) ? parsed[0] : parsed;
  const status =
    typeof item?.status === "string" ? item.status : item?.status?.kind;
  if (!status)
    throw new Error(`Fabro run ${runId} has no status; ownership is unknown`);
  return status;
};

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const taskId = valueAfter("--task");
const sourceRef = valueAfter("--ref");
const taskBase = valueAfter("--base");
const conflictAware = process.argv.includes("--conflict-aware");
const resumeStrategy: "in-lane-cherry-pick" | "prelaunch-cherry-pick" =
  conflictAware ? "in-lane-cherry-pick" : "prelaunch-cherry-pick";
if (!taskId || !sourceRef || !taskBase) {
  console.error(
    "usage: brain:factory:resume -- --task <id> --ref <git-ref> --base <sha> [--conflict-aware]",
  );
  process.exit(2);
}
const root = process.cwd();
const task = buildManifest(root).tasks.find(
  (candidate) => candidate.taskId === taskId,
);
if (!task) throw new Error(`unknown task ${taskId}`);
const state = resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain");
const evidence = resolve(state, "evidence");
const runDirectory = resolve(state, "runs");
const workdir = resolve(
  root,
  "..",
  ".maestro-brain-fabro-workdirs",
  `resume-${taskId.toLowerCase()}`,
);
const branch = `fabro/review-${taskId.toLowerCase()}`;
const workflow = resolve(".fabro/workflows/brain-build-task/workflow.fabro");
mkdirSync(runDirectory, { recursive: true });
mkdirSync(resolve(evidence, "lane-results", taskId), { recursive: true });
runRtk(["git", "fetch", "origin"]);
const now = new Date().toISOString();
const auditPath = resolve(state, "recovery-audit.jsonl");
const releaseDispatcherLock = acquireDispatcherLock({
  auditPath,
  lockPath: resolve(state, "dispatch.lock"),
  now,
  owner: {
    controlRoot: root,
    mode: "resume-review",
    pid: process.pid,
    startedAt: now,
    taskId,
  },
});
process.once("exit", releaseDispatcherLock);
const factoryBase = runRtk(["git", "rev-parse", "HEAD"], { quiet: true });
const { sourceHeadSha, taskBaseSha, taskCommits } = validateResumeSource({
  runGit: (args) => runRtk(args, { quiet: true }),
  sourceRef,
  taskBase,
  taskId,
});
const recordPath = resolve(runDirectory, `${taskId}.json`);
const expectedResume = {
  branch,
  mode: "resume-review" as const,
  resumeStrategy,
  sourceHeadSha,
  taskBaseSha,
  taskId,
  workdir,
};
let disposition:
  | { readonly kind: "create" }
  | { readonly kind: "reuse-clean"; readonly startSha: string }
  | { readonly kind: "reuse-conflict"; readonly startSha: string } = {
  kind: "create",
};
let launchBaseSha = factoryBase;
let preservedProofHeadSha: string | undefined;
if (existsSync(recordPath)) {
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as ResumeRecord;
  if (!record.runId) {
    throw new Error(
      `${taskId}: incomplete task reservation owns resume; audited recovery is required`,
    );
  }
  const status = inspectedStatus(record.runId);
  const terminal = new Set([
    "canceled",
    "cancelled",
    "failed",
    "succeeded",
  ]).has(status);
  const normalizedRecord = {
    ...record,
    resumeStrategy: record.resumeStrategy ?? "prelaunch-cherry-pick",
  };
  const exactResume = Object.entries(expectedResume).every(
    ([key, value]) => normalizedRecord[key as keyof ResumeRecord] === value,
  );
  if (!terminal) {
    if (exactResume && existsSync(workdir) && gitBranchExists(branch, root)) {
      console.log(
        `${taskId}: resume already owned by ${record.runId} (${status})`,
      );
      process.exit(0);
    }
    throw new Error(
      `${taskId}: live or unknown Fabro run ${record.runId} (${status}) owns this task`,
    );
  }
  const worktreeExists = existsSync(workdir);
  const branchExists = gitBranchExists(branch, root);
  const git = (args: readonly string[]): string =>
    runRtk(["proxy", "git", ...args], { cwd: workdir, quiet: true });
  const cherryPickPath =
    worktreeExists && branchExists
      ? git([
          "rev-parse",
          "--path-format=absolute",
          "--git-path",
          "CHERRY_PICK_HEAD",
        ])
      : "";
  if (worktreeExists && branchExists) {
    const proofPath = resolve(
      evidence,
      "lane-results",
      taskId,
      "ci-proof-packet.json",
    );
    const resolvedBase = resolvePreservedFactoryBase({
      ...(existsSync(proofPath)
        ? {
            proof: JSON.parse(readFileSync(proofPath, "utf8")) as {
              baseSha?: unknown;
              headSha?: unknown;
              taskId?: unknown;
            },
          }
        : {}),
      ...(record.factoryBaseSha
        ? { recordFactoryBaseSha: record.factoryBaseSha }
        : {}),
      taskId,
    });
    launchBaseSha = resolvedBase.baseSha;
    preservedProofHeadSha = resolvedBase.proofHeadSha;
    if (!gitIsAncestor(launchBaseSha, "HEAD", workdir)) {
      throw new Error(
        `${taskId}: preserved factory base is not an ancestor of worktree HEAD`,
      );
    }
    if (
      resolvedBase.proofHeadSha !== undefined &&
      !gitIsAncestor(resolvedBase.proofHeadSha, "HEAD", workdir)
    ) {
      throw new Error(
        `${taskId}: preserved proof head is not an ancestor of worktree HEAD`,
      );
    }
  }
  disposition = preservedResumeDisposition({
    expected: expectedResume,
    observation: {
      branchExists,
      ...(cherryPickPath && existsSync(cherryPickPath)
        ? { cherryPickHead: readFileSync(cherryPickPath, "utf8").trim() }
        : {}),
      controlCommonDir:
        worktreeExists && branchExists
          ? runRtk(
              [
                "proxy",
                "git",
                "rev-parse",
                "--path-format=absolute",
                "--git-common-dir",
              ],
              { cwd: root, quiet: true },
            )
          : "",
      headSha: worktreeExists && branchExists ? git(["rev-parse", "HEAD"]) : "",
      proofHeadIsAncestor:
        worktreeExists && branchExists && preservedProofHeadSha !== undefined
          ? gitIsAncestor(preservedProofHeadSha, "HEAD", workdir)
          : false,
      statusPorcelain:
        worktreeExists && branchExists ? git(["status", "--porcelain=v1"]) : "",
      taskBaseIsAncestor:
        worktreeExists && branchExists
          ? gitIsAncestor(taskBaseSha, "HEAD", workdir)
          : false,
      worktreeBranch:
        worktreeExists && branchExists ? git(["branch", "--show-current"]) : "",
      worktreeCommonDir:
        worktreeExists && branchExists
          ? git(["rev-parse", "--path-format=absolute", "--git-common-dir"])
          : "",
      worktreeExists,
    },
    record: normalizedRecord,
  });
  archiveTerminalTaskRecord({
    auditPath,
    now,
    recordPath,
    runId: record.runId,
    status,
    taskId,
  });
}
if (disposition.kind === "create" && existsSync(workdir)) {
  throw new Error(
    `${taskId}: resume worktree already exists at ${workdir}; no force removal is allowed`,
  );
}
if (disposition.kind === "create" && gitBranchExists(branch, root)) {
  throw new Error(
    `${taskId}: resume branch ${branch} already exists; no reset is allowed`,
  );
}
reserveTaskPreparing(recordPath, {
  branch,
  factoryBaseSha: launchBaseSha,
  mode: "resume-review",
  resumeStrategy,
  sourceHeadSha,
  status: "preparing",
  taskBaseSha,
  taskId,
  workdir,
});
if (disposition.kind === "create") {
  runRtk(["git", "worktree", "add", "-b", branch, workdir, factoryBase]);
  hydrateWorktreeDependencies(root, workdir);
  if (!conflictAware) {
    for (const commit of taskCommits)
      runRtk(["git", "cherry-pick", commit], { cwd: workdir });
  }
}
const startSha =
  disposition.kind === "create"
    ? runRtk(["git", "rev-parse", "HEAD"], {
        cwd: workdir,
        quiet: true,
      })
    : disposition.startSha;
const resumeMode =
  disposition.kind === "reuse-conflict"
    ? "preserved-conflict-aware"
    : disposition.kind === "reuse-clean"
      ? "preserved-worktree"
      : conflictAware
        ? "conflict-aware"
        : "none";
const resumeInputs =
  resumeMode !== "none"
    ? [
        "-I",
        `resume_mode=${resumeMode}`,
        "-I",
        `resume_source_head=${sourceHeadSha}`,
        "-I",
        `resume_task_base=${taskBaseSha}`,
        "-I",
        `resume_commits=${serializeResumeCommits(taskId, taskCommits)}`,
      ]
    : [];
const launchEnv = buildTaskLaunchEnv({
  baseSha: launchBaseSha,
  evidence,
  hostTestMaxLoad1m: "20",
  reproofRequest: "none",
  resumeCommits:
    resumeMode !== "none"
      ? serializeResumeCommits(taskId, taskCommits)
      : "none",
  resumeMode,
  resumeSourceHead: resumeMode !== "none" ? sourceHeadSha : "none",
  resumeTaskBase: resumeMode !== "none" ? taskBaseSha : "none",
  startSha,
  taskId,
  workdir,
});
const runConfig = materializeBuildTaskRunConfig({
  env: launchEnv,
  graph: workflow,
  path: resolve(state, "launch-configs", `resume-${taskId}.toml`),
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
    `task=${taskId}`,
    "--label",
    "mode=resume-review",
    "-I",
    `workdir=${workdir}`,
    "-I",
    `evidence_dir=${evidence}`,
    "-I",
    `task_id=${taskId}`,
    "-I",
    `base_sha=${launchBaseSha}`,
    "-I",
    `start_sha=${startSha}`,
    ...resumeInputs,
  ],
  {
    quiet: true,
    env: launchEnv,
  },
);
const parsed = JSON.parse(output) as { run_id?: string; runId?: string };
const runId = parsed.run_id ?? parsed.runId;
if (!runId)
  throw new Error(`${taskId}: Fabro did not return a run ID: ${output}`);
promoteTaskReservation(recordPath, {
  branch,
  factoryBaseSha: launchBaseSha,
  mode: "resume-review",
  resumeStrategy,
  runId,
  sourceHeadSha,
  status: "launched",
  taskBaseSha,
  taskId,
  workdir,
});
console.log(`${taskId}: resumed ${sourceRef} as ${runId}`);
