import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildContractReproofRequest } from "./contract-reproof.js";
import { hydrateWorktreeDependencies } from "./dependencies.js";
import {
  acquireDispatcherLock,
  archiveTerminalTaskRecord,
  promoteTaskReservation,
  reserveTaskPreparing,
} from "./dispatch-ownership.js";
import { completedTaskIdsForControlHead } from "./factory-state.js";
import { buildManifest } from "./manifest.js";
import { gitBranchExists, gitIsAncestor, runRtk } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const taskId = valueAfter("--task");
const reason = valueAfter("--reason")?.trim();
const launch = process.argv.includes("--launch");
if (!taskId || !reason) {
  throw new Error(
    "usage: brain:factory:reopen -- --task <id> --reason <text> [--launch]",
  );
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

const root = process.cwd();
const state = resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain");
const evidence = resolve(state, "evidence");
const laneDirectory = resolve(evidence, "lane-results", taskId);
const lanePath = resolve(laneDirectory, "lane-result.json");
if (!existsSync(lanePath)) throw new Error(`${taskId}: lane result is missing`);
const laneContent = readFileSync(lanePath, "utf8");
const lane = JSON.parse(laneContent) as Record<string, unknown>;
if (!new Set(["integrated", "accepted"]).has(String(lane.status))) {
  throw new Error(
    `${taskId}: only integrated or accepted tasks may be re-proved`,
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
const priorIntegrationId = String(lane.integrationId ?? "");
const priorIntegrationHeadSha = String(lane.integrationHeadSha ?? "");
if (
  !priorIntegrationId ||
  !/^[0-9a-f]{40}$/.test(priorIntegrationHeadSha) ||
  !gitIsAncestor(priorIntegrationHeadSha, controlHeadSha, root)
) {
  throw new Error(`${taskId}: prior integration is not authoritative on HEAD`);
}
const integrationResultPath = resolve(
  evidence,
  "integration",
  priorIntegrationId,
  "integration-result.json",
);
const archiveManifestPath = resolve(
  evidence,
  "archive",
  priorIntegrationId,
  "archive-manifest.json",
);
if (!existsSync(integrationResultPath)) {
  throw new Error(`${taskId}: prior integration result is missing`);
}
const requestDirectory = resolve(
  evidence,
  "reproofs",
  taskId,
  task.taskBlockHash,
);
const legacySnapshotContent = `${JSON.stringify(
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
if (existsSync(archiveManifestPath)) {
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
const request = buildContractReproofRequest({
  controlHeadSha,
  planSha256: manifest.planSha256,
  priorArchiveSha256,
  priorIntegrationHeadSha,
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
const requestPath = resolve(requestDirectory, "request.json");
const requestContent = `${JSON.stringify(request, null, 2)}\n`;
console.log(JSON.stringify({ launch, requestPath, request }, null, 2));
if (!launch) process.exit(0);

mkdirSync(requestDirectory, { recursive: true });
if (!existsSync(priorEvidencePath)) {
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
  `reproof-${taskId.toLowerCase()}`,
);
const branch = `fabro/reproof-${taskId.toLowerCase()}`;
if (existsSync(workdir) || gitBranchExists(branch, root)) {
  throw new Error(`${taskId}: unresolved reproof worktree or branch exists`);
}
reserveTaskPreparing(recordPath, {
  branch,
  mode: "contract-reproof",
  requestSha256: request.requestSha256,
  status: "preparing",
  taskId,
  workdir,
});
runRtk(["git", "worktree", "add", "-b", branch, workdir, controlHeadSha]);
hydrateWorktreeDependencies(root, workdir);
const workflow = resolve(".fabro/workflows/brain-build-task/workflow.fabro");
const output = JSON.parse(
  runRtk(
    [
      "fabro",
      "run",
      workflow,
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
      `start_sha=${controlHeadSha}`,
      "-I",
      `reproof_request=${requestPath}`,
    ],
    { quiet: true },
  ),
) as { run_id?: string; runId?: string };
const runId = output.run_id ?? output.runId;
if (!runId) throw new Error(`${taskId}: Fabro did not return a run ID`);
promoteTaskReservation(recordPath, {
  branch,
  mode: "contract-reproof",
  requestSha256: request.requestSha256,
  runId,
  status: "launched",
  taskId,
  workdir,
});
console.log(`${taskId}: contract reproof launched as ${runId}`);
