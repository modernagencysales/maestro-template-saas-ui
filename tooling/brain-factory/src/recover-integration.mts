import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  acquireIntegrationOwnership,
  fabroRunId,
  gitSha,
  integrationLockPath,
  persistLegacyIntegrationRecovery,
  planLegacyIntegrationRecovery,
  promoteRepairLaunch,
  readJsonRecord,
  repairWorkflowArgs,
  reserveRepairLaunch,
  safeAbsolutePath,
} from "./integration-recovery.js";
import { gitIsAncestor, runRtk } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const tranche = valueAfter("--tranche");
const recoveryReason = valueAfter("--recovery-reason");
if (!tranche || !recoveryReason?.trim()) {
  console.error(
    "usage: brain:factory:recover-integration -- --tranche <id> --recovery-reason <text>",
  );
  process.exit(2);
}
if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(tranche)) {
  throw new Error(`invalid tranche ${tranche}`);
}

const root = process.cwd();
const state = safeAbsolutePath(
  resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain"),
  "state path",
);
const gitCommonDirectory = safeAbsolutePath(
  resolve(
    root,
    runRtk(["git", "rev-parse", "--git-common-dir"], { quiet: true }),
  ),
  "Git common directory",
);
const evidenceDirectory = resolve(state, "evidence");
const resultPath = resolve(
  evidenceDirectory,
  "integration",
  tranche,
  "integration-result.json",
);
const runRecordPath = resolve(state, "runs", `integration-${tranche}.json`);
const repairRecordPath = resolve(state, "runs", `repair-${tranche}.json`);
const auditPath = resolve(state, "recovery-audit.jsonl");
const expectedWorkdir = resolve(
  root,
  "..",
  ".maestro-brain-fabro-workdirs",
  `integration-${tranche}`,
);
const workflow = resolve(
  root,
  ".fabro/workflows/brain-repair-tranche/workflow.fabro",
);
const manifestPath = resolve(
  root,
  "docs/superpowers/execution/maestro-brain/task-manifest.json",
);
for (const [label, path] of [
  ["integration result", resultPath],
  ["integration run record", runRecordPath],
  ["integration worktree", expectedWorkdir],
  ["repair workflow", workflow],
  ["task manifest", manifestPath],
] as const) {
  if (!existsSync(path))
    throw new Error(`${tranche}: missing ${label} ${path}`);
}
const manifest = readJsonRecord(manifestPath);
if (manifest.schemaVersion !== "maestro-brain-task-manifest/v1") {
  throw new Error(`${tranche}: unexpected task manifest schema`);
}
const manifestTaskIds = Array.isArray(manifest.tasks)
  ? manifest.tasks.flatMap((task) => {
      if (
        typeof task !== "object" ||
        task === null ||
        Array.isArray(task) ||
        (task as { readonly tranche?: unknown }).tranche !== tranche
      ) {
        return [];
      }
      const taskId = (task as { readonly taskId?: unknown }).taskId;
      if (typeof taskId !== "string" || !/^S\d{2}-T\d{2}$/.test(taskId)) {
        throw new Error(`${tranche}: manifest tranche has an invalid task ID`);
      }
      return [taskId];
    })
  : [];
if (manifestTaskIds.length === 0) {
  throw new Error(`${tranche}: tranche is absent from the task manifest`);
}
if (existsSync(repairRecordPath)) {
  throw new Error(
    `${tranche}: repair launch record already exists at ${repairRecordPath}`,
  );
}

const releaseOwnership = acquireIntegrationOwnership({
  lockPath: integrationLockPath(gitCommonDirectory, tranche),
  owner: {
    action: "recover-legacy-integration",
    at: new Date().toISOString(),
    pid: process.pid,
    tranche,
  },
});

try {
  const runRecord = readJsonRecord(runRecordPath);
  const integrationResult = readJsonRecord(resultPath);
  const runId = fabroRunId(runRecord.runId, "run record runId");
  const inspection = JSON.parse(
    runRtk(["fabro", "inspect", runId, "--json", "--quiet"], {
      quiet: true,
    }),
  ) as readonly {
    readonly run_id?: string;
    readonly status?: { readonly kind?: string };
  }[];
  if (inspection.length !== 1 || inspection[0]?.run_id !== runId) {
    throw new Error(
      `${tranche}: Fabro inspection did not return exactly one run`,
    );
  }

  const worktreePath = realpathSync(expectedWorkdir);
  const worktreeHead = gitSha(
    runRtk(["git", "rev-parse", "HEAD"], {
      cwd: worktreePath,
      quiet: true,
    }),
    "worktree HEAD",
  );
  const branch = `fabro/brain-${tranche.toLowerCase()}`;
  const branchHead = gitSha(
    runRtk(["git", "rev-parse", `refs/heads/${branch}`], {
      cwd: root,
      quiet: true,
    }),
    "branch head",
  );
  const worktreeClean =
    runRtk(["proxy", "git", "status", "--porcelain"], {
      cwd: worktreePath,
      quiet: true,
    }) === "";
  const controlHead = gitSha(
    runRtk(["git", "rev-parse", "HEAD"], {
      cwd: root,
      quiet: true,
    }),
    "control HEAD",
  );
  const now = new Date().toISOString();
  const plan = planLegacyIntegrationRecovery({
    branchHead,
    controlHead,
    failedRun: inspection[0],
    integrationResult,
    isAncestor: (ancestor, descendant) =>
      gitIsAncestor(ancestor, descendant, root),
    manifestTaskIds,
    now,
    reason: recoveryReason,
    runRecord,
    tranche,
    worktreeClean,
    worktreeHead,
    worktreePath,
  });
  const workflowArgs = repairWorkflowArgs({
    controlRoot: root,
    evidenceDirectory,
    recoveryAuditPath: auditPath,
    repairBaseSha: plan.repairBaseSha,
    sourceReviewRun: plan.sourceReviewRun,
    tranche,
    workdir: worktreePath,
    workflow,
  });
  const reservationToken = reserveRepairLaunch(repairRecordPath, {
    baseSha: plan.repairBaseSha,
    sourceReviewRun: plan.sourceReviewRun,
    status: "preparing",
    tranche,
    workdir: worktreePath,
  });
  persistLegacyIntegrationRecovery({ auditPath, plan, resultPath });
  const output = runRtk(workflowArgs, { quiet: true });
  const parsed = JSON.parse(output) as { run_id?: string; runId?: string };
  const repairRunId = fabroRunId(
    parsed.run_id ?? parsed.runId,
    "repair Fabro run ID",
  );
  promoteRepairLaunch(repairRecordPath, reservationToken, {
    baseSha: plan.repairBaseSha,
    runId: repairRunId,
    sourceReviewRun: plan.sourceReviewRun,
    status: "launched",
    tranche,
    workdir: worktreePath,
  });
  console.log(
    `${tranche}: normalized failed legacy attempt and launched repair ${repairRunId}`,
  );
} finally {
  releaseOwnership();
}
