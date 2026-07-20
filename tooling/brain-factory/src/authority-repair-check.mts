import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { validateAuthorityRepairRewrite } from "./authority-repair-check.js";
import { laneHistoryOwnershipIssues } from "./lane-ownership.js";
import { buildManifest, type AuthorityRepairTransition } from "./manifest.js";
import { runRtk } from "./process.js";

const archiveInput = process.env.BRAIN_AUTHORITY_REPAIR_ARCHIVE ?? "none";
if (archiveInput === "none") process.exit(0);
const taskId = process.env.BRAIN_TASK_ID;
const baseSha = process.env.BRAIN_BASE_SHA;
const workdir = process.env.BRAIN_WORKDIR;
const evidence = process.env.BRAIN_EVIDENCE_DIR;
if (!taskId || !baseSha || !workdir || !evidence) {
  throw new Error("authority-repair check coordinates are missing");
}
const archive = realpathSync(archiveInput);
const archiveRoot = realpathSync(
  resolve(evidence, "authority-refreshes", taskId),
);
if (!archive.startsWith(`${archiveRoot}/`)) {
  throw new Error(`${taskId}: authority-repair archive path mismatch`);
}
const archiveManifest = JSON.parse(
  readFileSync(resolve(archive, "manifest.json"), "utf8"),
) as {
  artifacts?: readonly { file?: unknown; sha256?: unknown }[];
  currentAuthority?: { planSha256?: unknown; taskBlockHash?: unknown };
  schemaVersion?: unknown;
  taskId?: unknown;
};
if (
  archiveManifest.schemaVersion !==
    "maestro-brain-authority-repair-archive/v1" ||
  archiveManifest.taskId !== taskId ||
  !Array.isArray(archiveManifest.artifacts)
) {
  throw new Error(`${taskId}: authority-repair archive manifest is invalid`);
}
for (const artifact of archiveManifest.artifacts) {
  if (
    typeof artifact.file !== "string" ||
    typeof artifact.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(artifact.sha256)
  )
    throw new Error(`${taskId}: authority-repair artifact identity is invalid`);
  const path = resolve(archive, artifact.file);
  if (!existsSync(path))
    throw new Error(`${taskId}: authority-repair artifact is missing`);
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (digest !== artifact.sha256) {
    throw new Error(`${taskId}: authority-repair artifact hash mismatch`);
  }
}
const manifest = buildManifest(workdir);
const task = manifest.tasks.find((candidate) => candidate.taskId === taskId);
if (!task?.authorityRepairTransition) {
  throw new Error(
    `${taskId}: current manifest has no authority-repair transition`,
  );
}
if (
  archiveManifest.currentAuthority?.planSha256 !== manifest.planSha256 ||
  archiveManifest.currentAuthority.taskBlockHash !== task.taskBlockHash
)
  throw new Error(`${taskId}: authority-repair current authority drifted`);
const transition = JSON.parse(
  readFileSync(resolve(archive, "authority-repair-transition.json"), "utf8"),
) as AuthorityRepairTransition;
if (
  JSON.stringify(transition) !== JSON.stringify(task.authorityRepairTransition)
) {
  throw new Error(`${taskId}: authority-repair transition drifted`);
}
const git = (...args: string[]): string =>
  runRtk(["proxy", "git", ...args], { cwd: workdir, quiet: true });
if (git("status", "--porcelain=v1")) {
  throw new Error(`${taskId}: authority-repair worktree is dirty`);
}
const changedFiles = git(
  "diff",
  "--name-only",
  "--no-renames",
  `${baseSha}..HEAD`,
)
  .split("\n")
  .filter(Boolean);
validateAuthorityRepairRewrite({
  changedFiles,
  fileLocks: task.fileLocks,
  transition,
});
const histories = git("rev-list", "--reverse", `${baseSha}..HEAD`)
  .split("\n")
  .filter(Boolean)
  .map((commit) => ({
    commit,
    files: git(
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-only",
      "-r",
      "--no-renames",
      commit,
    )
      .split("\n")
      .filter(Boolean),
    parentCount:
      git("rev-list", "--parents", "-n", "1", commit).trim().split(/\s+/)
        .length - 1,
    sourceLines: 0,
  }));
const ownershipIssues = laneHistoryOwnershipIssues(histories, task.fileLocks);
if (ownershipIssues.length > 0) {
  throw new Error(`${taskId}: ${ownershipIssues.join("; ")}`);
}
console.log(`${taskId}: authority-repair rewrite satisfies current ownership`);
