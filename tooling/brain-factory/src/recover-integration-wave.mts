import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  acquireIntegrationOwnership,
  fabroRunId,
  gitSha,
  integrationLockPath,
  safeAbsolutePath,
} from "./integration-recovery.js";
import { record, string } from "./integration-check-support.js";
import {
  type IntegrationWaveSelection,
  validateIntegrationWaveSelection,
} from "./integration-wave.js";
import {
  replaceWaveRunRecord,
  verifyWaveRunInspection,
  waveWorkflowArgs,
  type WaveRunIdentity,
} from "./integration-wave-launch.js";
import { gitIsAncestor, runRtk, runRtkToFile } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const integrationId = valueAfter("--integration-id");
const reason = valueAfter("--recovery-reason");
if (!integrationId || !/^wave-\d{6}$/.test(integrationId) || !reason?.trim()) {
  throw new Error(
    "usage: brain:factory:recover-wave -- --integration-id wave-NNNNNN --recovery-reason <text>",
  );
}

const root = process.cwd();
const state = safeAbsolutePath(
  resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain"),
  "state path",
);
const evidence = resolve(state, "evidence");
const runs = resolve(state, "runs");
const recordPath = resolve(runs, `integration-${integrationId}.json`);
const workflow = resolve(
  ".fabro/workflows/brain-integrate-wave/workflow.fabro",
);
if (!existsSync(recordPath) || !existsSync(workflow)) {
  throw new Error(`${integrationId}: missing durable run record or workflow`);
}
const gitCommonDirectory = safeAbsolutePath(
  resolve(
    root,
    runRtk(["git", "rev-parse", "--git-common-dir"], { quiet: true }),
  ),
  "Git common directory",
);
const releaseOwnership = acquireIntegrationOwnership({
  lockPath: integrationLockPath(gitCommonDirectory, "wave-v2"),
  owner: {
    action: "recover-integration-wave-v2",
    at: new Date().toISOString(),
    integrationId,
    pid: process.pid,
    reason: reason.trim(),
  },
});

try {
  let currentContent = readFileSync(recordPath, "utf8");
  let runRecord = record(JSON.parse(currentContent), "wave run record");
  if (
    runRecord.schemaVersion !== "maestro-brain-integration-wave-run/v2" ||
    runRecord.integrationId !== integrationId
  ) {
    throw new Error(`${integrationId}: run record identity mismatch`);
  }
  const baseSha = gitSha(runRecord.baseSha, "wave baseSha");
  const workdir = safeAbsolutePath(runRecord.workdir, "wave workdir");
  const expectedWorkdir = resolve(
    root,
    "..",
    ".maestro-brain-fabro-workdirs",
    `integration-${integrationId}`,
  );
  const expectedBranch = `fabro/brain-${integrationId}`;
  if (workdir !== expectedWorkdir || runRecord.branch !== expectedBranch) {
    throw new Error(`${integrationId}: recorded worktree or branch mismatch`);
  }
  const selectionPath = safeAbsolutePath(
    runRecord.selectionPath,
    "wave selection path",
  );
  const selection = record(
    JSON.parse(readFileSync(selectionPath, "utf8")),
    "wave selection",
  ) as unknown as IntegrationWaveSelection;
  validateIntegrationWaveSelection(selection);
  const selectionSha256 = string(
    runRecord.selectionSha256,
    "wave selection hash",
  );
  if (
    selection.integrationId !== integrationId ||
    selection.baseSha !== baseSha ||
    selection.selectionSha256 !== selectionSha256
  ) {
    throw new Error(`${integrationId}: immutable selection drift`);
  }
  if (!existsSync(workdir))
    throw new Error(`${integrationId}: workdir is missing`);
  const worktreeHead = gitSha(
    runRtk(["git", "rev-parse", "HEAD"], { cwd: workdir, quiet: true }),
    "wave worktree HEAD",
  );
  const branchHead = gitSha(
    runRtk(["git", "rev-parse", `refs/heads/${expectedBranch}`], {
      cwd: root,
      quiet: true,
    }),
    "wave branch HEAD",
  );
  if (
    branchHead !== worktreeHead ||
    !gitIsAncestor(baseSha, worktreeHead, workdir)
  ) {
    throw new Error(`${integrationId}: wave worktree ancestry drift`);
  }
  const inspect = (runId: string): unknown =>
    JSON.parse(
      runRtk(["fabro", "inspect", runId, "--json", "--quiet"], { quiet: true }),
    );
  const identityFor = (mode: "integrate" | "recover"): WaveRunIdentity => ({
    baseSha,
    integrationId,
    mode,
    selectionPath,
    selectionSha256,
    workdir,
  });
  let runId =
    typeof runRecord.runId === "string"
      ? fabroRunId(runRecord.runId, "recorded wave run ID")
      : undefined;
  if (!runId) {
    const rawPath = `${recordPath}.launch-1.raw`;
    const integrateIdentity = identityFor("integrate");
    const raw = existsSync(rawPath)
      ? record(JSON.parse(readFileSync(rawPath, "utf8")), "raw launch receipt")
      : record(
          JSON.parse(
            runRtkToFile(
              waveWorkflowArgs({
                ...integrateIdentity,
                controlRoot: root,
                evidenceDirectory: evidence,
                workflow,
              }),
              rawPath,
              { outcomePath: `${rawPath}.outcome.json` },
            ),
          ),
          "recovered initial launch receipt",
        );
    runId = fabroRunId(raw.run_id ?? raw.runId, "raw wave run ID");
    verifyWaveRunInspection(inspect(runId), {
      ...integrateIdentity,
      runId,
    });
    replaceWaveRunRecord(recordPath, currentContent, {
      ...runRecord,
      activeMode: "integrate",
      attempt: 1,
      runId,
      runIds: [runId],
      status: "launched",
    });
    currentContent = readFileSync(recordPath, "utf8");
    runRecord = record(JSON.parse(currentContent), "wave run record");
  }
  const activeMode =
    runRecord.activeMode === "recover" ? "recover" : ("integrate" as const);
  const exactInspection = inspect(runId);
  verifyWaveRunInspection(exactInspection, {
    ...identityFor(activeMode),
    runId,
  });
  const inspected = record(
    Array.isArray(exactInspection) ? exactInspection[0] : exactInspection,
    "wave run inspection",
  );
  const statusValue = inspected.status;
  const status =
    typeof statusValue === "string"
      ? statusValue
      : string(
          record(statusValue, "wave run status").kind,
          "wave run status kind",
        );
  const terminalFailure = new Set([
    "failed",
    "canceled",
    "cancelled",
    "dead",
    "interrupted",
  ]).has(status);
  if (!terminalFailure) {
    console.log(
      `${integrationId}: reconciled exact run ${runId} in status ${status}; no replacement launched`,
    );
  } else {
    const attempt = Number(runRecord.attempt ?? 1) + 1;
    if (!Number.isInteger(attempt) || attempt < 2 || attempt > 20) {
      throw new Error(`${integrationId}: recovery attempt limit exceeded`);
    }
    const rawPath = `${recordPath}.launch-${attempt}.raw`;
    const outcomePath = `${rawPath}.outcome.json`;
    const recoveryIdentity = identityFor("recover");
    const output = runRtkToFile(
      waveWorkflowArgs({
        ...recoveryIdentity,
        controlRoot: root,
        evidenceDirectory: evidence,
        workflow,
      }),
      rawPath,
      { outcomePath },
    );
    const raw = record(JSON.parse(output), "recovery launch output");
    const recoveryRunId = fabroRunId(
      raw.run_id ?? raw.runId,
      "recovery wave run ID",
    );
    verifyWaveRunInspection(inspect(recoveryRunId), {
      ...recoveryIdentity,
      runId: recoveryRunId,
    });
    const previousRunIds = Array.isArray(runRecord.runIds)
      ? runRecord.runIds.map((value, index) =>
          fabroRunId(value, `runIds[${index}]`),
        )
      : [runId];
    replaceWaveRunRecord(recordPath, currentContent, {
      ...runRecord,
      activeMode: "recover",
      attempt,
      recoveredAt: new Date().toISOString(),
      recoveryReason: reason.trim(),
      runId: recoveryRunId,
      runIds: [...previousRunIds, recoveryRunId],
      status: "launched",
    });
    console.log(`${integrationId}: launched recovery ${recoveryRunId}`);
  }
} finally {
  releaseOwnership();
}
