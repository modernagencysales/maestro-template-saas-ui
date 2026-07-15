import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  acquireIntegrationOwnership,
  discoverRepairLaunch,
  dispatchIntegrationRecovery,
  fabroRunId,
  gitSha,
  integrationLockPath,
  planLegacyIntegrationRecovery,
  readJsonRecord,
  reconcileDurableRepairLaunch,
  reconcileLegacyIntegrationRecovery,
  repairWorkflowArgs,
  safeAbsolutePath,
  verifyRepairLaunchInspection,
  type RepairLaunchDiscovery,
  type RepairLaunchReceiptInput,
} from "./integration-recovery.js";
import { gitIsAncestor, runRtk, runRtkToFile } from "./process.js";

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
const receiptPath = (attempt: number): string =>
  `${repairRecordPath}.launch-${attempt}.json`;
const rawLaunchPath = (attempt: number): string =>
  `${repairRecordPath}.launch-${attempt}.raw`;
const launchOutcomePath = (attempt: number): string =>
  `${rawLaunchPath(attempt)}.outcome.json`;
type LaunchIdentity = Omit<RepairLaunchReceiptInput, "runId">;
const inspectFabro = (target: string): unknown =>
  JSON.parse(
    runRtk(["fabro", "inspect", target, "--json", "--quiet"], {
      quiet: true,
    }),
  );
const discoverLaunch = (identity: LaunchIdentity): RepairLaunchDiscovery =>
  discoverRepairLaunch({
    identity,
    inspect: inspectFabro,
    outcomePath: launchOutcomePath(identity.attempt),
    rawPath: rawLaunchPath(identity.attempt),
    receiptPath: receiptPath(identity.attempt),
  });
const verifyLaunchedRun = (identity: RepairLaunchReceiptInput): void =>
  verifyRepairLaunchInspection(inspectFabro(identity.runId), identity);
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
  const durableRunRecord = readJsonRecord(runRecordPath);
  const durableResult = readJsonRecord(resultPath);
  const durableRecovery =
    typeof durableResult.recovery === "object" &&
    durableResult.recovery !== null &&
    !Array.isArray(durableResult.recovery)
      ? (durableResult.recovery as Record<string, unknown>)
      : undefined;
  const durableWorkdir = realpathSync(expectedWorkdir);
  const reconcileFromEvidence = (): string => {
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
    const reconciled = reconcileLegacyIntegrationRecovery({
      auditPath,
      discoverLaunchedRun: discoverLaunch,
      identity: {
        baseSha: plan.repairBaseSha,
        sourceReviewRun: plan.sourceReviewRun,
        tranche,
        workdir: worktreePath,
      },
      launch: ({ attempt, reservationToken }) => {
        runRtkToFile(
          repairWorkflowArgs({
            controlRoot: root,
            evidenceDirectory,
            launchAttempt: attempt,
            recoveryAuditPath: auditPath,
            repairBaseSha: plan.repairBaseSha,
            reservationToken,
            sourceReviewRun: plan.sourceReviewRun,
            tranche,
            workdir: worktreePath,
            workflow,
          }),
          rawLaunchPath(attempt),
          { outcomePath: launchOutcomePath(attempt) },
        );
        const discovery = discoverLaunch({
          attempt,
          baseSha: plan.repairBaseSha,
          integrationBaseSha: gitSha(
            plan.auditEvent.baseSha,
            "recovery integration baseSha",
          ),
          reservationToken,
          sourceReviewRun: plan.sourceReviewRun,
          taskIds: Array.isArray(plan.auditEvent.legacyIncludedTaskIds)
            ? (plan.auditEvent.legacyIncludedTaskIds as string[])
            : [],
          tranche,
          workdir: worktreePath,
        });
        if (discovery.kind !== "found") {
          throw new Error(
            discovery.kind === "ambiguous"
              ? discovery.reason
              : "successful launch produced no durable receipt",
          );
        }
        return discovery.receipt;
      },
      plan,
      repairRecordPath,
      resultPath,
      verifyLaunchedRun,
    });
    return reconciled.runId;
  };
  const repairRunId = dispatchIntegrationRecovery({
    integrationResult: durableResult,
    reconcileDurable: () =>
      reconcileDurableRepairLaunch({
        auditPath,
        discoverLaunchedRun: discoverLaunch,
        expected: {
          baseSha: gitSha(
            durableRecovery?.legacyIntegrationHeadSha,
            "durable recovery legacy integration head",
          ),
          integrationBaseSha: gitSha(
            durableRunRecord.baseSha,
            "run record baseSha",
          ),
          sourceReviewRun: fabroRunId(
            durableRunRecord.runId,
            "run record runId",
          ),
          tranche,
          workdir: durableWorkdir,
        },
        manifestTaskIds,
        repairRecordPath,
        resultPath,
        verifyLaunchedRun,
      })?.runId,
    reconcileFromEvidence,
    repairRecordExists: existsSync(repairRecordPath),
  });
  console.log(
    `${tranche}: normalized failed legacy attempt and launched repair ${repairRunId}`,
  );
} finally {
  releaseOwnership();
}
