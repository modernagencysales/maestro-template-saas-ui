import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hydrateWorktreeDependencies } from "./dependencies.js";
import { buildTaskLaunchEnv } from "./build-task-launch-env.js";
import { materializeBuildTaskRunConfig } from "./build-task-run-config.js";
import { launchAuthorityRefresh } from "./authority-refresh-launch.js";
import {
  acquireDispatcherLock,
  assertArchiveActionSelectorApplicable,
  assertArchiveActionSelectorUsed,
  auditedTerminalResumeRecord,
  parseArchiveActionSelector,
  preservedResumeDisposition,
  promoteTaskReservation,
  replaceTerminalTaskRecord,
  reserveTaskPreparing,
  resolvePreservedFactoryBase,
} from "./dispatch-ownership.js";
import { buildManifest } from "./manifest.js";
import {
  gitBranchExists,
  gitCommonDir,
  gitIsAncestor,
  runRtk,
} from "./process.js";
import {
  adoptTerminalAuthorityResumeRecord,
  resolveResumeStrategy,
  serializeResumeCommits,
  validateResumeSource,
} from "./resume-support.js";
import { validateTerminalAuthorityResumeOwner } from "./preserved-resume-validation.js";

interface ResumeRecord {
  readonly authorityArchivePath?: string;
  readonly baseSha?: string;
  readonly branch: string;
  readonly factoryBaseSha?: string;
  readonly mode?: "authority-refresh" | "authority-repair" | "resume-review";
  readonly runId?: string;
  readonly resumeStrategy?: "in-lane-cherry-pick" | "prelaunch-cherry-pick";
  readonly sourceHeadSha?: string;
  readonly status?: "launched" | "preparing";
  readonly taskBaseSha?: string;
  readonly taskId: string;
  readonly workdir: string;
}

type PreservedResumeRecord = Omit<ResumeRecord, "mode"> & {
  readonly mode?: "resume-review";
};

const asPreservedResumeRecord = (
  record: ResumeRecord,
): PreservedResumeRecord => {
  const { mode, ...rest } = record;
  if (mode === undefined) return rest;
  if (mode !== "resume-review") {
    throw new Error(`${record.taskId}: preserved resume mode mismatch`);
  }
  return { ...rest, mode };
};

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
const archiveActionId = parseArchiveActionSelector(process.argv.slice(2));
const authorityRefresh = process.argv.includes("--authority-refresh");
const authorityRepair = process.argv.includes("--authority-repair");
const conflictAware = process.argv.includes("--conflict-aware");
let resumeStrategy = resolveResumeStrategy({
  authorityOwner: false,
  conflictAware,
});
if (
  !taskId ||
  (!authorityRefresh && !authorityRepair && (!sourceRef || !taskBase))
) {
  console.error(
    "usage: brain:factory:resume -- --task <id> (--authority-refresh | --authority-repair | --ref <git-ref> --base <sha> [--conflict-aware]) [--archive-action <id>]",
  );
  process.exit(2);
}
if (
  (authorityRefresh || authorityRepair) &&
  (sourceRef || taskBase || conflictAware || archiveActionId)
) {
  throw new Error(
    `${taskId}: authority transition derives exact source coordinates and cannot be combined with --ref, --base, --conflict-aware, or --archive-action`,
  );
}
if (authorityRefresh && authorityRepair) {
  throw new Error(`${taskId}: choose exactly one authority transition`);
}
const root = process.cwd();
const state = resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain");
const evidence = resolve(state, "evidence");
const runDirectory = resolve(state, "runs");
let workdir = resolve(
  root,
  "..",
  ".maestro-brain-fabro-workdirs",
  `resume-${taskId.toLowerCase()}`,
);
let branch = `fabro/review-${taskId.toLowerCase()}`;
const recordPath = resolve(runDirectory, `${taskId}.json`);
const recordExists = existsSync(recordPath);
const preservedWorktreeExists = existsSync(workdir);
const preservedBranchExists =
  archiveActionId !== undefined && !recordExists
    ? gitBranchExists(branch, root)
    : false;
assertArchiveActionSelectorApplicable({
  archiveActionId,
  preservedBranchExists,
  preservedWorktreeExists,
  recordExists,
  taskId,
});
if (authorityRefresh || authorityRepair) {
  launchAuthorityRefresh({
    authorityRepair,
    evidence,
    recordPath,
    root,
    state,
    taskId,
  });
  process.exit(0);
}
if (!sourceRef || !taskBase)
  throw new Error(`${taskId}: resume source is missing`);
const manifest = buildManifest(root);
const task = manifest.tasks.find((candidate) => candidate.taskId === taskId);
if (!task) throw new Error(`unknown task ${taskId}`);
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
const controlCommonDir = gitCommonDir(root);
const { sourceHeadSha, taskBaseSha, taskCommits } = validateResumeSource({
  runGit: (args) => runRtk(args, { quiet: true }),
  sourceRef,
  taskBase,
  taskId,
});
let expectedResume = {
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
let preservedExpectedCommit = "none";
let preservedRecord: PreservedResumeRecord | undefined;
let authorityRepairArchive = "none";
let terminalTransition:
  | {
      readonly expectedContent: string;
      readonly runId: string;
      readonly status: string;
    }
  | undefined;
let auditedArchiveSelected = false;
if (existsSync(recordPath)) {
  assertArchiveActionSelectorUsed({
    archiveActionId,
    auditedArchiveSelected: false,
    taskId,
  });
  const recordContent = readFileSync(recordPath, "utf8");
  const record = JSON.parse(recordContent) as ResumeRecord;
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
  if (
    record.mode === "authority-refresh" ||
    record.mode === "authority-repair"
  ) {
    if (record.mode === "authority-repair") {
      authorityRepairArchive = record.authorityArchivePath ?? "none";
    }
    const owner = validateTerminalAuthorityResumeOwner({
      controlCommonDir,
      evidence,
      record,
      resumeCommits: taskCommits,
      sourceHeadSha,
      status,
      taskBaseSha,
      taskId,
    });
    branch = owner.branch;
    workdir = owner.workdir;
    resumeStrategy = resolveResumeStrategy({
      authorityOwner: true,
      conflictAware,
    });
    if (resumeStrategy !== owner.resumeStrategy) {
      throw new Error(`${taskId}: authority owner resume strategy mismatch`);
    }
    expectedResume = {
      ...expectedResume,
      branch,
      resumeStrategy,
      workdir,
    };
    preservedRecord = adoptTerminalAuthorityResumeRecord({
      record,
      resumeStrategy,
      sourceHeadSha,
      taskBaseSha,
    });
  } else {
    preservedRecord = asPreservedResumeRecord(record);
  }
  terminalTransition = {
    expectedContent: recordContent,
    runId: record.runId,
    status,
  };
}
if (
  preservedRecord === undefined &&
  (existsSync(workdir) || gitBranchExists(branch, root))
) {
  const auditedArchive = auditedTerminalResumeRecord({
    ...(archiveActionId === undefined ? {} : { archiveActionId }),
    auditPath,
    expected: expectedResume,
    recordPath,
  });
  preservedRecord = asPreservedResumeRecord(
    auditedArchive.record as unknown as ResumeRecord,
  );
  auditedArchiveSelected = true;
}
assertArchiveActionSelectorUsed({
  archiveActionId,
  auditedArchiveSelected,
  taskId,
});
if (preservedRecord !== undefined) {
  const record = preservedRecord;
  const normalizedRecord = {
    ...record,
    resumeStrategy: record.resumeStrategy ?? "prelaunch-cherry-pick",
  };
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
  const cherryPickHead =
    cherryPickPath && existsSync(cherryPickPath)
      ? readFileSync(cherryPickPath, "utf8").trim()
      : undefined;
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
      ...(cherryPickHead ? { cherryPickHead } : {}),
      controlCommonDir: worktreeExists && branchExists ? controlCommonDir : "",
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
  if (disposition.kind === "reuse-conflict") {
    if (!cherryPickHead || !taskCommits.includes(cherryPickHead)) {
      throw new Error(
        `${taskId}: preserved cherry-pick marker is outside pinned resume commits`,
      );
    }
    preservedExpectedCommit = cherryPickHead;
  }
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
const preparingRecord = {
  branch,
  factoryBaseSha: launchBaseSha,
  mode: "resume-review",
  resumeStrategy,
  sourceHeadSha,
  status: "preparing",
  taskBaseSha,
  taskId,
  workdir,
} as const;
if (terminalTransition !== undefined) {
  replaceTerminalTaskRecord({
    auditPath,
    expectedContent: terminalTransition.expectedContent,
    now,
    recordPath,
    replacement: preparingRecord,
    runId: terminalTransition.runId,
    status: terminalTransition.status,
    taskId,
  });
} else {
  reserveTaskPreparing(recordPath, preparingRecord);
}
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
  authorityRepairArchive,
  baseSha: launchBaseSha,
  controlRoot: root,
  controlCommonDir,
  evidence,
  hostTestMaxLoad1m: "20",
  reproofRequest: "none",
  resumeCommits:
    resumeMode !== "none"
      ? serializeResumeCommits(taskId, taskCommits)
      : "none",
  resumeBranch: resumeMode !== "none" ? branch : "none",
  resumeExpectedCommit: preservedExpectedCommit,
  resumeProofHead: preservedProofHeadSha ?? "none",
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
    `control_root=${root}`,
    "-I",
    `control_common_dir=${controlCommonDir}`,
    "-I",
    `start_sha=${startSha}`,
    "-I",
    `resume_branch=${resumeMode !== "none" ? branch : "none"}`,
    "-I",
    `resume_expected_commit=${preservedExpectedCommit}`,
    "-I",
    `resume_proof_head=${preservedProofHeadSha ?? "none"}`,
    "-I",
    `authority_repair_archive=${authorityRepairArchive}`,
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
