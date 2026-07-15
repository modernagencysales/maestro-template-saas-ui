import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import { hydrateWorktreeDependencies } from "./dependencies.js";
import {
  completedTaskIdsForControlHead,
  type LaneCompletionResult,
} from "./factory-state.js";
import {
  acquireIntegrationOwnership,
  fabroRunId,
  gitSha,
  integrationLockPath,
  safeAbsolutePath,
} from "./integration-recovery.js";
import {
  integrationWaveId,
  planIntegrationWave,
  type IntegrationWaveCandidate,
} from "./integration-wave.js";
import {
  replaceWaveRunRecord,
  verifyWaveRunInspection,
  waveWorkflowArgs,
} from "./integration-wave-launch.js";
import { readJson, string } from "./integration-check-support.js";
import { laneFileOwnershipIssues } from "./lane-ownership.js";
import { buildManifest } from "./manifest.js";
import { gitIsAncestor, runRtk, runRtkToFile } from "./process.js";
import { proofChangedFilesMatch, validateProofContract } from "./proof.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const root = process.cwd();
const state = safeAbsolutePath(
  resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain"),
  "state path",
);
const evidence = resolve(state, "evidence");
const laneRoot = resolve(evidence, "lane-results");
const runs = resolve(state, "runs");
const workflow = resolve(
  ".fabro/workflows/brain-integrate-wave/workflow.fabro",
);
const worktreeRoot = resolve(root, "..", ".maestro-brain-fabro-workdirs");
for (const [label, path] of [
  ["workflow", workflow],
  ["lane evidence", laneRoot],
] as const) {
  if (!existsSync(path)) throw new Error(`missing ${label} ${path}`);
}
mkdirSync(runs, { recursive: true });
mkdirSync(worktreeRoot, { recursive: true });
const baseSha = gitSha(
  runRtk(["git", "rev-parse", "HEAD"], { quiet: true }),
  "control HEAD",
);
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
    action: "launch-integration-wave-v2",
    at: new Date().toISOString(),
    baseSha,
    pid: process.pid,
  },
});

try {
  const recordNames = readdirSync(runs)
    .map((name) => ({
      name,
      match: /^integration-(wave-(\d{6}))\.json$/.exec(name),
    }))
    .filter(
      (entry): entry is { name: string; match: RegExpExecArray } =>
        entry.match !== null,
    );
  for (const { name, match } of recordNames) {
    const integrationId = match[1];
    if (!integrationId) throw new Error(`${name}: invalid wave identity`);
    const promotionPath = resolve(
      evidence,
      "integration",
      integrationId,
      "promotion.json",
    );
    if (!existsSync(promotionPath)) {
      throw new Error(`${integrationId}: unresolved global integration wave`);
    }
    const promotion = readJson(promotionPath);
    const promotedHead = gitSha(
      promotion.headSha,
      `${integrationId}: promoted head`,
    );
    if (
      promotion.schemaVersion !==
        "maestro-brain-integration-wave-promotion/v2" ||
      promotion.status !== "promoted" ||
      promotion.integrationId !== integrationId ||
      !gitIsAncestor(promotedHead, baseSha, root)
    ) {
      throw new Error(
        `${integrationId}: promotion receipt is not on control HEAD`,
      );
    }
  }
  const sequence =
    Math.max(0, ...recordNames.map(({ match }) => Number(match[2]))) + 1;
  const integrationId = integrationWaveId(sequence);
  const manifest = buildManifest(root);
  const readLane = (taskId: string): LaneCompletionResult | undefined => {
    const path = resolve(laneRoot, taskId, "lane-result.json");
    return existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as LaneCompletionResult)
      : undefined;
  };
  const completedTaskIds = completedTaskIdsForControlHead({
    controlHead: baseSha,
    isAncestor: (ancestor, descendant) =>
      gitIsAncestor(ancestor, descendant, root),
    resultFor: readLane,
    taskIds: manifest.tasks.map((task) => task.taskId),
  });
  const candidates: IntegrationWaveCandidate[] = [];
  for (const task of manifest.tasks) {
    const laneDirectory = resolve(laneRoot, task.taskId);
    const lanePath = resolve(laneDirectory, "lane-result.json");
    if (!existsSync(lanePath)) continue;
    const laneContent = readFileSync(lanePath, "utf8");
    const lane = readJson(lanePath);
    if (lane.status !== "lane_green") continue;
    if (lane.taskId !== task.taskId || lane.tranche !== task.tranche) {
      throw new Error(`${task.taskId}: lane-green identity mismatch`);
    }
    const proofPath = resolve(laneDirectory, "ci-proof-packet.json");
    const gatePath = resolve(laneDirectory, "lane-gate-report.json");
    if (!existsSync(proofPath) || !existsSync(gatePath)) {
      throw new Error(`${task.taskId}: lane-green proof chain is incomplete`);
    }
    const proofContent = readFileSync(proofPath, "utf8");
    const gateContent = readFileSync(gatePath, "utf8");
    const proof = readJson(proofPath);
    const gate = readJson(gatePath);
    validateProofContract(proof, {
      planSha256: manifest.planSha256,
      taskBlockHash: task.taskBlockHash,
      taskId: task.taskId,
    });
    const laneHead = gitSha(lane.headSha, `${task.taskId}: lane head`);
    const proofBase = gitSha(proof.baseSha, `${task.taskId}: proof base`);
    if (
      proof.headSha !== laneHead ||
      proof.reviewVerdict !== "pass" ||
      gate.schemaVersion !== "maestro-brain-lane-gate/v1" ||
      gate.stage !== "final" ||
      gate.status !== "passed" ||
      gate.headSha !== laneHead ||
      gate.currentHeadSha !== laneHead ||
      gate.planSha256 !== manifest.planSha256 ||
      gate.taskBlockHash !== task.taskBlockHash ||
      !gitIsAncestor(proofBase, laneHead, root)
    ) {
      throw new Error(`${task.taskId}: lane-green proof chain drift`);
    }
    const changedFiles = runRtk(
      ["git", "diff", "--name-only", `${proofBase}..${laneHead}`],
      { quiet: true },
    )
      .split("\n")
      .filter(Boolean);
    if (
      !Array.isArray(proof.changedFiles) ||
      !proofChangedFilesMatch(proof.changedFiles as string[], changedFiles)
    ) {
      throw new Error(`${task.taskId}: proof changed-files drift`);
    }
    const ownershipIssues = laneFileOwnershipIssues(
      changedFiles,
      task.fileLocks,
    );
    if (ownershipIssues.length > 0) {
      throw new Error(`${task.taskId}: ${ownershipIssues.join("; ")}`);
    }
    candidates.push({
      changedFiles,
      gateHeadSha: string(gate.headSha, `${task.taskId}: gate head`),
      gateSha256: sha256(gateContent),
      headSha: laneHead,
      laneResultSha256: sha256(laneContent),
      planSha256: manifest.planSha256,
      proofHeadSha: string(proof.headSha, `${task.taskId}: proof head`),
      proofSha256: sha256(proofContent),
      taskBlockHash: task.taskBlockHash,
      taskId: task.taskId,
      tranche: task.tranche,
    });
  }
  if (candidates.length === 0) {
    console.log(JSON.stringify({ integrationId: null, selected: [] }, null, 2));
    process.exitCode = 0;
  } else {
    const selection = planIntegrationWave({
      baseSha,
      candidates,
      completedTaskIds,
      integrationId,
      planSha256: manifest.planSha256,
      tasks: manifest.tasks,
    });
    const branch = `fabro/brain-${integrationId}`;
    const workdir = resolve(worktreeRoot, `integration-${integrationId}`);
    const selectionPath = resolve(
      runs,
      `integration-${integrationId}-selection.json`,
    );
    const recordPath = resolve(runs, `integration-${integrationId}.json`);
    const rawPath = `${recordPath}.launch-1.raw`;
    const outcomePath = `${rawPath}.outcome.json`;
    writeFileSync(selectionPath, `${JSON.stringify(selection, null, 2)}\n`, {
      flag: "wx",
    });
    const reservation = {
      attempt: 0,
      baseSha,
      branch,
      integrationId,
      schemaVersion: "maestro-brain-integration-wave-run/v2",
      selectionPath,
      selectionSha256: selection.selectionSha256,
      status: "preparing",
      workdir,
    };
    writeFileSync(recordPath, `${JSON.stringify(reservation, null, 2)}\n`, {
      flag: "wx",
    });
    runRtk(["git", "worktree", "add", "-B", branch, workdir, baseSha]);
    hydrateWorktreeDependencies(root, workdir);
    const identity = {
      baseSha,
      integrationId,
      mode: "integrate" as const,
      selectionPath,
      selectionSha256: selection.selectionSha256,
      workdir,
    };
    const output = runRtkToFile(
      waveWorkflowArgs({
        ...identity,
        controlRoot: root,
        evidenceDirectory: evidence,
        workflow,
      }),
      rawPath,
      { outcomePath },
    );
    const parsed = JSON.parse(output) as { run_id?: unknown; runId?: unknown };
    const runId = fabroRunId(
      parsed.run_id ?? parsed.runId,
      "wave Fabro run ID",
    );
    verifyWaveRunInspection(
      JSON.parse(
        runRtk(["fabro", "inspect", runId, "--json", "--quiet"], {
          quiet: true,
        }),
      ),
      { ...identity, runId },
    );
    const currentContent = readFileSync(recordPath, "utf8");
    replaceWaveRunRecord(recordPath, currentContent, {
      ...reservation,
      activeMode: "integrate",
      attempt: 1,
      runId,
      runIds: [runId],
      status: "launched",
    });
    console.log(
      JSON.stringify(
        {
          deferred: selection.deferredTaskIds,
          integrationId,
          runId,
          selected: selection.selectedTasks.map((task) => task.taskId),
        },
        null,
        2,
      ),
    );
  }
} finally {
  releaseOwnership();
}
