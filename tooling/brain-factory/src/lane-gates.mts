import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  commandsForTaskFiles,
  commandsForProfiles,
  formatCommandForFiles,
  focusedGateCommand,
  focusedCommandContractIssues,
  type GateCommand,
  lintCommandForFiles,
} from "./gates.js";
import {
  canReusePreReviewGate,
  deduplicateGateCommands,
  gateCommandSetHash,
  reviewVerdictMatchesGateStage,
} from "./lane-gate-cache.js";
import { buildManifest } from "./manifest.js";
import {
  isCompatibleProofHead,
  proofChangedFilesMatch,
  validateProofContract,
} from "./proof.js";
import { validateContractReproofRequest } from "./contract-reproof.js";
import {
  changedHandAuthoredSourceLines,
  validSourceSlices,
} from "./source-budget.js";
import {
  laneFileOwnershipIssues,
  laneHistoryOwnershipIssues,
  laneHistoryShapeIssues,
} from "./lane-ownership.js";
import { lifecycleAdoptionRecordIssues } from "./lifecycle-adoption.js";
import { validateFinalLaneResult } from "./lane-result.js";

interface ProofPacket {
  readonly baseSha: string;
  readonly changedFiles: readonly string[];
  readonly focusedCommands: readonly string[];
  readonly headSha: string;
  readonly planSha256: string;
  readonly reviewVerdict: "pass" | "pending" | "rework";
  readonly schemaVersion: "maestro-brain-ci-proof/v1";
  readonly taskBlockHash: string;
  readonly taskId: string;
}

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const taskId = valueAfter("--task");
const evidence = valueAfter("--evidence");
const stageValue = valueAfter("--stage") ?? "pre-review";
const reusePreReview = process.argv.includes("--reuse-pre-review");
const reproofPath = valueAfter("--reproof-request");
if (!taskId || !evidence) {
  console.error(
    "usage: lane-gates --task <id> --evidence <absolute-dir> [--stage pre-review|final] [--reuse-pre-review]",
  );
  process.exit(2);
}
if (!new Set(["pre-review", "final"]).has(stageValue))
  throw new Error("--stage must be pre-review or final");
const stage = stageValue as "final" | "pre-review";
if (reusePreReview && stage !== "final")
  throw new Error("--reuse-pre-review requires --stage final");

const run = (command: GateCommand): void => {
  console.log(`+ rtk ${command.program} ${command.args.join(" ")}`);
  const result = spawnSync("rtk", [command.program, ...command.args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      `${command.program} failed with status ${result.status ?? "unknown"}`,
    );
};

const manifest = buildManifest();
const task = manifest.tasks.find((candidate) => candidate.taskId === taskId);
if (!task) throw new Error(`unknown task ${taskId}`);
const lifecycleIssues = lifecycleAdoptionRecordIssues({
  root: process.cwd(),
  state: "lane_green",
  task,
});
if (lifecycleIssues.length > 0) {
  throw new Error(lifecycleIssues.join("; "));
}
const laneDirectory = resolve(evidence, "lane-results", taskId);
const proofPath = resolve(laneDirectory, "ci-proof-packet.json");
const reportPath = resolve(laneDirectory, "lane-gate-report.json");
const resultPath = resolve(laneDirectory, "lane-result.json");
if (!existsSync(proofPath)) throw new Error(`${taskId}: missing ${proofPath}`);
const proof = JSON.parse(readFileSync(proofPath, "utf8")) as ProofPacket;
const proofPlanSha256 = validateProofContract(
  proof as unknown as Record<string, unknown>,
  {
    taskBlockHash: task.taskBlockHash,
    taskId,
  },
);
if (reproofPath && reproofPath !== "none") {
  if (!existsSync(reproofPath)) {
    throw new Error(`${taskId}: contract reproof request is missing`);
  }
  const request = validateContractReproofRequest(
    JSON.parse(readFileSync(reproofPath, "utf8")),
    {
      controlHeadSha: proof.baseSha,
      planSha256: manifest.planSha256,
      taskBlockHash: task.taskBlockHash,
      taskId,
    },
  );
  if (request.controlHeadSha !== proof.baseSha) {
    throw new Error(`${taskId}: reproof delta does not start at control HEAD`);
  }
  const evidenceRoot = `${resolve(evidence)}/`;
  if (
    !request.priorEvidencePath.startsWith(evidenceRoot) ||
    !existsSync(request.priorEvidencePath) ||
    createHash("sha256")
      .update(readFileSync(request.priorEvidencePath, "utf8"))
      .digest("hex") !== request.priorArchiveSha256
  ) {
    throw new Error(`${taskId}: reproof prior evidence is unsafe or drifted`);
  }
  const ancestry = spawnSync(
    "rtk",
    [
      "proxy",
      "git",
      "merge-base",
      "--is-ancestor",
      request.priorIntegrationHeadSha,
      proof.baseSha,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (ancestry.status !== 0) {
    throw new Error(`${taskId}: reproof prior integration is not on base`);
  }
}
if (!reviewVerdictMatchesGateStage(stage, proof.reviewVerdict)) {
  throw new Error(
    stage === "final"
      ? `${taskId}: final proof lacks independent PASS review`
      : `${taskId}: implementation proof must await independent review`,
  );
}
if (!Array.isArray(proof.changedFiles) || proof.changedFiles.length === 0)
  throw new Error(`${taskId}: proof has no changed files`);
if (!Array.isArray(proof.focusedCommands) || proof.focusedCommands.length === 0)
  throw new Error(`${taskId}: proof has no focused commands`);
const focusedCommandIssues = focusedCommandContractIssues(
  taskId,
  proof.focusedCommands,
);
if (focusedCommandIssues.length > 0)
  throw new Error(`${taskId}: ${focusedCommandIssues.join("; ")}`);
const changedFilesResult = spawnSync(
  "rtk",
  ["proxy", "git", "diff", "--name-only", `${proof.baseSha}..${proof.headSha}`],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (changedFilesResult.status !== 0)
  throw new Error(`${taskId}: could not enumerate changed files`);
const actualChangedFiles = changedFilesResult.stdout
  .trim()
  .split("\n")
  .filter(Boolean);
if (!proofChangedFilesMatch(proof.changedFiles, actualChangedFiles))
  throw new Error(`${taskId}: proof changedFiles do not match the task diff`);
const ownershipIssues = laneFileOwnershipIssues(
  actualChangedFiles,
  task.fileLocks,
);
if (ownershipIssues.length > 0)
  throw new Error(`${taskId}: ${ownershipIssues.join("; ")}`);
const focusedCommands = proof.focusedCommands.map((command) => {
  try {
    return focusedGateCommand(command);
  } catch (error) {
    throw new Error(
      `${taskId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});
const existingChangedFiles = proof.changedFiles.filter((file) =>
  existsSync(resolve(file)),
);
const formatCommand = formatCommandForFiles(existingChangedFiles);
const lintCommand = lintCommandForFiles(existingChangedFiles);
const gateCommands = deduplicateGateCommands([
  ...(formatCommand ? [formatCommand] : []),
  ...(lintCommand ? [lintCommand] : []),
  ...focusedCommands,
  ...commandsForTaskFiles(actualChangedFiles, task.fileLocks, focusedCommands),
  ...commandsForProfiles(task.gateProfiles, focusedCommands),
]);
const commandSetHash = gateCommandSetHash(gateCommands);

const requiredTaskFiles: Readonly<Record<string, readonly string[]>> = {
  "S02-T02": [
    "apps/web/src/sample/templateData.test.ts",
    "docs/superpowers/receipts/maestro-brain/file-inventories/S02-T02-confect-generated-files.json",
    "packages/convex/confect/brain/pageTree.ts",
    "packages/convex/test/brain-pages-crud.test.ts",
  ],
  "S03-T02": [
    "apps/web/src/features/clients/clients-adapter.test.ts",
    "apps/web/src/features/clients/clients-adapter.ts",
    "apps/web/src/features/clients/clients-state.test.ts",
    "apps/web/src/features/clients/clients-state.ts",
    "apps/web/src/features/clients/clients-table.test.tsx",
    "apps/web/src/features/clients/clients-table.tsx",
    "apps/web/src/features/clients/create-client-dialog.test.tsx",
    "apps/web/src/features/clients/create-client-dialog.tsx",
    "packages/convex/confect/brain/clientBrief.ts",
  ],
  "S09-T01": [
    "packages/search/src/asyncSearch.ts",
    "packages/search/src/asyncSearch.test.ts",
  ],
  "S11-T02": [
    "packages/convex/confect/headless/apiKeys.impl.ts",
    "packages/convex/confect/headless/apiKeys.spec.ts",
    "packages/convex/confect/headless/authorizeOperation.ts",
    "packages/convex/confect/headless/principal.ts",
    "packages/convex/test/http-request-security.test.ts",
  ],
};
for (const requiredFile of requiredTaskFiles[taskId] ?? [])
  if (!existsSync(resolve(requiredFile)))
    throw new Error(
      `${taskId}: missing required task artifact ${requiredFile}`,
    );

const head = spawnSync("rtk", ["proxy", "git", "rev-parse", "HEAD"], {
  cwd: process.cwd(),
  encoding: "utf8",
}).stdout.trim();
const treeResult = spawnSync(
  "rtk",
  ["proxy", "git", "rev-parse", "HEAD^{tree}"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
  },
);
if (treeResult.status !== 0)
  throw new Error(`${taskId}: could not resolve current tree`);
const currentTreeSha = treeResult.stdout.trim();
const ancestor = spawnSync(
  "rtk",
  ["git", "merge-base", "--is-ancestor", proof.headSha, head],
  { cwd: process.cwd(), stdio: "ignore" },
);
const treeDiff = spawnSync(
  "rtk",
  ["git", "diff", "--quiet", proof.headSha, head],
  { cwd: process.cwd(), stdio: "ignore" },
);
if (
  !isCompatibleProofHead({
    ancestorExit: ancestor.status,
    currentHead: head,
    proofHead: proof.headSha,
    treeDiffExit: treeDiff.status,
  })
)
  throw new Error(
    `${taskId}: proof head ${proof.headSha} is not a same-tree checkpoint ancestor of ${head}`,
  );
if (stage === "final") {
  if (!existsSync(resultPath))
    throw new Error(`${taskId}: missing final lane result ${resultPath}`);
  validateFinalLaneResult(
    JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, unknown>,
    { currentHeadSha: head, taskId },
  );
}
const commitList = spawnSync(
  "rtk",
  [
    "proxy",
    "git",
    "rev-list",
    "--reverse",
    `${proof.baseSha}..${proof.headSha}`,
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (commitList.status !== 0)
  throw new Error(`${taskId}: could not enumerate task slices`);
const taskCommits = commitList.stdout.trim().split("\n").filter(Boolean);
const historicalShapes = taskCommits.map((commit) => {
  const parents = spawnSync(
    "rtk",
    ["proxy", "git", "rev-list", "--parents", "-n", "1", commit],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (parents.status !== 0)
    throw new Error(`${taskId}: could not inspect slice ancestry ${commit}`);
  return {
    commit,
    parentCount: Math.max(
      0,
      parents.stdout.trim().split(/\s+/).filter(Boolean).length - 1,
    ),
  };
});
const historicalShapeIssues = laneHistoryShapeIssues(historicalShapes);
if (historicalShapeIssues.length > 0)
  throw new Error(`${taskId}: ${historicalShapeIssues.join("; ")}`);
const historicalPaths = taskCommits.map((commit) => {
  const paths = spawnSync(
    "rtk",
    [
      "proxy",
      "git",
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-only",
      "-r",
      "--no-renames",
      commit,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (paths.status !== 0)
    throw new Error(`${taskId}: could not inspect slice paths ${commit}`);
  return {
    commit,
    files: paths.stdout.trim().split("\n").filter(Boolean),
  };
});
const historicalOwnershipIssues = laneHistoryOwnershipIssues(
  historicalPaths,
  task.fileLocks,
);
if (historicalOwnershipIssues.length > 0)
  throw new Error(`${taskId}: ${historicalOwnershipIssues.join("; ")}`);
const sourceSlices = taskCommits.map((commit) => {
  const numstat = spawnSync(
    "rtk",
    ["proxy", "git", "show", "--no-renames", "--numstat", "--format=", commit],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (numstat.status !== 0)
    throw new Error(`${taskId}: could not inspect slice ${commit}`);
  return {
    changedSourceLines: changedHandAuthoredSourceLines(numstat.stdout),
    commit,
  };
});
const oversizedSlice = sourceSlices.find(
  (slice) => slice.changedSourceLines > task.sourceSliceBudget,
);
if (
  !validSourceSlices(
    sourceSlices.map((slice) => slice.changedSourceLines),
    task.sourceSliceBudget,
    task.sourceSliceLimit ?? 4,
  )
)
  throw new Error(
    oversizedSlice
      ? `${taskId}: slice ${oversizedSlice.commit} changes ${oversizedSlice.changedSourceLines} hand-authored source lines; split it below ${task.sourceSliceBudget}`
      : `${taskId}: expected one to ${task.sourceSliceLimit ?? 4} task slice commits, got ${taskCommits.length}`,
  );
const changedSourceLines = sourceSlices.reduce(
  (total, slice) => total + slice.changedSourceLines,
  0,
);
run({
  program: "git",
  args: ["diff", "--check", `${proof.baseSha}..${proof.headSha}`],
});
let preReviewReport: unknown;
if (reusePreReview && existsSync(reportPath)) {
  try {
    preReviewReport = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    preReviewReport = undefined;
  }
}
const reusedPreReview =
  reusePreReview &&
  canReusePreReviewGate(preReviewReport, {
    commandSetHash,
    currentHeadSha: head,
    currentTreeSha,
    planSha256: proofPlanSha256,
    reviewVerdict: proof.reviewVerdict,
    taskBlockHash: task.taskBlockHash,
  });
if (reusedPreReview) {
  console.log(`${taskId}: reusing exact-head pre-review command results`);
} else {
  for (const command of gateCommands) run(command);
}
const status = spawnSync("rtk", ["proxy", "git", "status", "--porcelain"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (status.status !== 0 || status.stdout.trim() !== "")
  throw new Error(`${taskId}: lane worktree is not clean after gates`);

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      schemaVersion: "maestro-brain-lane-gate/v1",
      commandSetHash,
      commands: gateCommands.map(
        (command) => `rtk ${command.program} ${command.args.join(" ")}`,
      ),
      currentHeadSha: head,
      currentTreeSha,
      gateProfiles: task.gateProfiles,
      headSha: proof.headSha,
      planSha256: proofPlanSha256,
      changedSourceLines,
      estimateDrift: changedSourceLines > task.estimatedSourceLines,
      estimatedSourceLines: task.estimatedSourceLines,
      sourceSliceBudget: task.sourceSliceBudget,
      sourceSliceLimit: task.sourceSliceLimit ?? 4,
      sourceSlices,
      stage,
      status: "passed",
      taskId,
      taskBlockHash: task.taskBlockHash,
      reusedPreReview,
    },
    null,
    2,
  )}\n`,
);
console.log(`${taskId}: lane gates passed (${stage})`);
