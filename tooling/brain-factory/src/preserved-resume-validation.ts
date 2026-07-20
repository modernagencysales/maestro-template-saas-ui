import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, resolve } from "node:path";

import { gitIsAncestor, runRtk } from "./process.js";
import { nonEmptyResumeCommits } from "./resume-support.js";

export interface PreservedResumeLaunchExpectation {
  readonly baseSha: string;
  readonly branch: string;
  readonly controlCommonDir: string;
  readonly evidence: string;
  readonly expectedCommit: string;
  readonly mode: "preserved-conflict-aware" | "preserved-worktree";
  readonly proofHead: string;
  readonly resumeCommits: readonly string[];
  readonly sourceHeadSha: string;
  readonly startSha: string;
  readonly taskId: string;
  readonly taskBaseSha: string;
  readonly workdir: string;
}

interface WorktreeRegistration {
  readonly HEAD?: string;
  readonly branch?: string;
  readonly worktree?: string;
}

interface AuthorityResumeRecord {
  readonly authorityArchivePath?: unknown;
  readonly authorityArchiveManifestSha256?: unknown;
  readonly baseSha?: unknown;
  readonly branch?: unknown;
  readonly factoryBaseSha?: unknown;
  readonly mode?: unknown;
  readonly resumeStrategy?: unknown;
  readonly runId?: unknown;
  readonly sourceHeadSha?: unknown;
  readonly status?: unknown;
  readonly taskBaseSha?: unknown;
  readonly taskId?: unknown;
  readonly workdir?: unknown;
}

const parseWorktrees = (value: string): readonly WorktreeRegistration[] =>
  value
    .split("\n\n")
    .filter(Boolean)
    .map((block) =>
      Object.fromEntries(
        block.split("\n").map((line) => {
          const separator = line.indexOf(" ");
          return separator < 0
            ? [line, ""]
            : [line.slice(0, separator), line.slice(separator + 1)];
        }),
      ),
    );

const validateSha = (value: string, label: string): void => {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`${label} is invalid`);
};

export const validateAuthorityRepairArchivePin = (input: {
  readonly evidence: string;
  readonly record: Pick<
    AuthorityResumeRecord,
    "authorityArchiveManifestSha256" | "authorityArchivePath"
  >;
  readonly taskId: string;
}): {
  readonly authorityArchiveManifestSha256: string;
  readonly authorityArchivePath: string;
} => {
  const path = input.record.authorityArchivePath;
  const manifestSha256 = input.record.authorityArchiveManifestSha256;
  if (
    typeof path !== "string" ||
    typeof manifestSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(manifestSha256) ||
    !existsSync(path)
  ) {
    throw new Error(
      `${input.taskId}: authority owner archive identity mismatch`,
    );
  }
  const archiveDirectory = realpathSync(path);
  const manifestPath = resolve(archiveDirectory, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `${input.taskId}: authority owner archive identity mismatch`,
    );
  }
  const content = readFileSync(manifestPath, "utf8");
  const actualSha256 = createHash("sha256").update(content).digest("hex");
  let manifest: {
    readonly authorityId?: unknown;
    readonly schemaVersion?: unknown;
    readonly taskId?: unknown;
  };
  try {
    manifest = JSON.parse(content) as typeof manifest;
  } catch {
    throw new Error(
      `${input.taskId}: authority owner archive identity mismatch`,
    );
  }
  const authorityId = manifest.authorityId;
  if (
    manifest.schemaVersion !== "maestro-brain-authority-repair-archive/v1" ||
    manifest.taskId !== input.taskId ||
    typeof authorityId !== "string" ||
    !/^[0-9a-f]{12}$/.test(authorityId) ||
    path !== archiveDirectory ||
    actualSha256 !== manifestSha256 ||
    basename(archiveDirectory) !== manifestSha256 ||
    realpathSync(
      resolve(
        input.evidence,
        "authority-refreshes",
        input.taskId,
        authorityId,
        manifestSha256,
      ),
    ) !== archiveDirectory
  ) {
    throw new Error(
      `${input.taskId}: authority owner archive identity mismatch`,
    );
  }
  return {
    authorityArchiveManifestSha256: manifestSha256,
    authorityArchivePath: archiveDirectory,
  };
};

export const validatePreservedResumeLaunch = (
  expected: PreservedResumeLaunchExpectation,
): {
  readonly branch: string;
  readonly cherryPickHead?: string;
  readonly headSha: string;
  readonly mode: PreservedResumeLaunchExpectation["mode"];
  readonly workdir: string;
} => {
  validateSha(expected.baseSha, "preserved base SHA");
  validateSha(expected.startSha, "preserved start SHA");
  validateSha(expected.sourceHeadSha, "preserved source HEAD");
  validateSha(expected.taskBaseSha, "preserved task base");
  for (const commit of expected.resumeCommits)
    validateSha(commit, "preserved resume commit");
  if (!existsSync(expected.workdir))
    throw new Error("preserved worktree path mismatch");
  const workdir = realpathSync(expected.workdir);
  const git = (args: readonly string[]): string =>
    runRtk(["proxy", "git", ...args], { cwd: workdir, quiet: true });
  if (realpathSync(git(["rev-parse", "--show-toplevel"])) !== workdir) {
    throw new Error("preserved worktree path mismatch");
  }
  const branch = git(["branch", "--show-current"]);
  if (branch !== expected.branch) {
    throw new Error("preserved worktree branch mismatch");
  }
  const commonDir = realpathSync(
    git(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  );
  if (
    !existsSync(expected.controlCommonDir) ||
    commonDir !== realpathSync(expected.controlCommonDir)
  ) {
    throw new Error("preserved common directory mismatch");
  }
  const registration = parseWorktrees(
    git(["worktree", "list", "--porcelain"]),
  ).find(
    (candidate) =>
      candidate.worktree !== undefined &&
      existsSync(candidate.worktree) &&
      realpathSync(candidate.worktree) === workdir,
  );
  const headSha = git(["rev-parse", "HEAD"]);
  if (
    registration?.branch !== `refs/heads/${expected.branch}` ||
    registration.HEAD !== headSha
  ) {
    throw new Error("preserved registered worktree identity mismatch");
  }
  if (headSha !== expected.startSha) {
    throw new Error("preserved worktree HEAD mismatch");
  }
  if (!gitIsAncestor(expected.baseSha, headSha, workdir)) {
    throw new Error("preserved base is not an ancestor of worktree HEAD");
  }
  git(["cat-file", "-e", `${expected.sourceHeadSha}^{commit}`]);
  git(["cat-file", "-e", `${expected.taskBaseSha}^{commit}`]);
  if (!gitIsAncestor(expected.taskBaseSha, expected.sourceHeadSha, workdir)) {
    throw new Error("preserved task base is not an ancestor of source HEAD");
  }
  const sourceCommitRange = nonEmptyResumeCommits({
    revisionList: git([
      "rev-list",
      "--reverse",
      `${expected.taskBaseSha}..${expected.sourceHeadSha}`,
    ]),
    changedPathsFor: (commit) =>
      git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]),
  });
  if (
    JSON.stringify(sourceCommitRange) !== JSON.stringify(expected.resumeCommits)
  ) {
    throw new Error("preserved source commit range mismatch");
  }

  const proofPath = resolve(
    expected.evidence,
    "lane-results",
    expected.taskId,
    "ci-proof-packet.json",
  );
  if (existsSync(proofPath)) {
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as {
      baseSha?: unknown;
      headSha?: unknown;
      taskId?: unknown;
    };
    if (
      expected.proofHead === "none" ||
      proof.taskId !== expected.taskId ||
      proof.baseSha !== expected.baseSha
    ) {
      throw new Error("preserved proof identity mismatch");
    }
    if (proof.headSha !== expected.proofHead) {
      throw new Error("preserved proof head mismatch");
    }
    const proofHead = String(proof.headSha ?? "");
    validateSha(proofHead, "preserved proof head");
    if (!gitIsAncestor(proofHead, headSha, workdir)) {
      throw new Error("preserved proof head is not an ancestor");
    }
  } else if (
    expected.mode === "preserved-worktree" ||
    expected.proofHead !== "none"
  ) {
    throw new Error("clean preserved resume requires an exact proof");
  }

  const status = git(["status", "--porcelain=v1"]);
  if (expected.mode === "preserved-worktree") {
    if (status !== "")
      throw new Error(`clean preserved worktree is dirty: ${status}`);
    return { branch, headSha, mode: expected.mode, workdir };
  }
  const statusLines = status.split("\n").filter(Boolean);
  if (statusLines.length === 0) {
    throw new Error("preserved conflict worktree is clean");
  }
  if (statusLines.some((line) => line.startsWith("??"))) {
    throw new Error(
      `preserved conflict contains untracked files: ${statusLines.join(",")}`,
    );
  }
  validateSha(expected.expectedCommit, "preserved expected commit");
  if (!expected.resumeCommits.includes(expected.expectedCommit)) {
    throw new Error("preserved expected commit is outside pinned sequence");
  }
  const markerPath = git([
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "CHERRY_PICK_HEAD",
  ]);
  if (!existsSync(markerPath)) {
    throw new Error("preserved conflict has no cherry-pick marker");
  }
  const cherryPickHead = readFileSync(markerPath, "utf8").trim();
  if (cherryPickHead !== expected.expectedCommit) {
    throw new Error("preserved cherry-pick commit mismatch");
  }

  const markerIndex = expected.resumeCommits.indexOf(cherryPickHead);
  const todoPath = git([
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "sequencer/todo",
  ]);
  const remaining = existsSync(todoPath)
    ? readFileSync(todoPath, "utf8")
        .split("\n")
        .filter((line) => line.startsWith("pick "))
        .map((line) => line.split(/\s+/)[1] ?? "")
        .map((commit) => git(["rev-parse", `${commit}^{commit}`]))
    : [];
  const suffixIncludingMarker = expected.resumeCommits.slice(markerIndex);
  const suffixAfterMarker = expected.resumeCommits.slice(markerIndex + 1);
  if (
    JSON.stringify(remaining) !== JSON.stringify(suffixIncludingMarker) &&
    JSON.stringify(remaining) !== JSON.stringify(suffixAfterMarker)
  ) {
    throw new Error("preserved cherry-pick sequence mismatch");
  }
  return {
    branch,
    cherryPickHead,
    headSha,
    mode: expected.mode,
    workdir,
  };
};

export const validateTerminalAuthorityResumeOwner = (input: {
  readonly controlCommonDir: string;
  readonly evidence: string;
  readonly record: AuthorityResumeRecord;
  readonly resumeCommits: readonly string[];
  readonly sourceHeadSha: string;
  readonly status: string;
  readonly taskBaseSha: string;
  readonly taskId: string;
}): {
  readonly branch: string;
  readonly factoryBaseSha: string;
  readonly proofHeadSha: string;
  readonly resumeStrategy: "in-lane-cherry-pick";
  readonly startSha: string;
  readonly workdir: string;
} => {
  const authorityRepair = input.record.mode === "authority-repair";
  const repairPin = authorityRepair
    ? validateAuthorityRepairArchivePin({
        evidence: input.evidence,
        record: input.record,
        taskId: input.taskId,
      })
    : undefined;
  if (
    !new Set(["canceled", "cancelled", "failed", "succeeded"]).has(input.status)
  ) {
    throw new Error(`${input.taskId}: authority owner run is not terminal`);
  }
  const identities = [
    ["task ID", input.record.taskId, input.taskId],
    [
      "mode",
      input.record.mode,
      authorityRepair ? "authority-repair" : "authority-refresh",
    ],
    ["resume strategy", input.record.resumeStrategy, "in-lane-cherry-pick"],
    ["launch base", input.record.baseSha, input.taskBaseSha],
    ["factory base", input.record.factoryBaseSha, input.taskBaseSha],
    ["reservation status", input.record.status, "launched"],
  ] as const;
  for (const [label, actual, expected] of identities) {
    if (actual !== expected) {
      throw new Error(`${input.taskId}: authority owner ${label} mismatch`);
    }
  }
  if (typeof input.record.runId !== "string" || !input.record.runId) {
    throw new Error(`${input.taskId}: authority owner run ID is missing`);
  }
  if (typeof input.record.branch !== "string" || !input.record.branch) {
    throw new Error(`${input.taskId}: authority owner branch is missing`);
  }
  if (typeof input.record.workdir !== "string" || !input.record.workdir) {
    throw new Error(`${input.taskId}: authority owner workdir is missing`);
  }
  if (
    typeof input.record.sourceHeadSha !== "string" ||
    typeof input.record.taskBaseSha !== "string"
  ) {
    throw new Error(`${input.taskId}: authority owner source is missing`);
  }
  validateSha(input.record.sourceHeadSha, "authority owner source HEAD");
  validateSha(input.record.taskBaseSha, "authority owner task base");
  if (
    typeof input.record.authorityArchivePath !== "string" ||
    !existsSync(input.record.authorityArchivePath)
  ) {
    throw new Error(`${input.taskId}: authority owner archive is missing`);
  }
  const archiveRoot = realpathSync(
    resolve(input.evidence, "authority-refreshes", input.taskId),
  );
  const archiveDirectory = realpathSync(input.record.authorityArchivePath);
  if (!archiveDirectory.startsWith(`${archiveRoot}/`)) {
    throw new Error(`${input.taskId}: authority owner archive path mismatch`);
  }
  const archiveManifestPath = resolve(archiveDirectory, "manifest.json");
  if (!existsSync(archiveManifestPath)) {
    throw new Error(
      `${input.taskId}: authority owner archive manifest is missing`,
    );
  }
  const archiveManifestContent = readFileSync(archiveManifestPath, "utf8");
  const archiveManifestSha256 = createHash("sha256")
    .update(archiveManifestContent)
    .digest("hex");
  const archiveManifest = JSON.parse(archiveManifestContent) as {
    readonly artifacts?: unknown;
    readonly authorityId?: unknown;
    readonly currentAuthority?: { readonly controlHeadSha?: unknown };
    readonly schemaVersion?: unknown;
    readonly source?: {
      readonly baseSha?: unknown;
      readonly commits?: unknown;
      readonly headSha?: unknown;
    };
    readonly taskId?: unknown;
  };
  const authorityId = archiveManifest.authorityId;
  const expectedArchiveDirectory = repairPin
    ? resolve(
        input.evidence,
        "authority-refreshes",
        input.taskId,
        String(authorityId),
        repairPin.authorityArchiveManifestSha256,
      )
    : resolve(
        input.evidence,
        "authority-refreshes",
        input.taskId,
        String(authorityId),
      );
  if (
    typeof authorityId !== "string" ||
    !/^[0-9a-f]{12}$/.test(authorityId) ||
    input.record.authorityArchivePath !== archiveDirectory ||
    (authorityRepair
      ? typeof input.record.authorityArchiveManifestSha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(input.record.authorityArchiveManifestSha256) ||
        input.record.authorityArchiveManifestSha256 !== archiveManifestSha256 ||
        basename(archiveDirectory) !== archiveManifestSha256 ||
        basename(resolve(archiveDirectory, "..")) !== authorityId
      : basename(archiveDirectory) !== authorityId) ||
    realpathSync(expectedArchiveDirectory) !== archiveDirectory
  ) {
    throw new Error(
      `${input.taskId}: authority owner archive identity mismatch`,
    );
  }
  const slug = input.taskId.toLowerCase();
  if (
    input.record.branch !== `fabro/review-${slug}-authority-${authorityId}` ||
    basename(input.record.workdir) !== `resume-${slug}-authority-${authorityId}`
  ) {
    throw new Error(
      `${input.taskId}: authority owner recorded coordinates mismatch`,
    );
  }
  if (
    archiveManifest.schemaVersion !==
      (authorityRepair
        ? "maestro-brain-authority-repair-archive/v1"
        : "maestro-brain-authority-refresh-archive/v1") ||
    archiveManifest.taskId !== input.taskId ||
    archiveManifest.currentAuthority?.controlHeadSha !== input.taskBaseSha ||
    archiveManifest.source?.baseSha !== input.record.taskBaseSha ||
    archiveManifest.source.headSha !== input.record.sourceHeadSha ||
    !Array.isArray(archiveManifest.source.commits) ||
    !archiveManifest.source.commits.every(
      (commit) => typeof commit === "string",
    )
  ) {
    throw new Error(
      `${input.taskId}: authority owner archive provenance mismatch`,
    );
  }
  if (
    !Array.isArray(archiveManifest.artifacts) ||
    archiveManifest.artifacts.length === 0
  ) {
    throw new Error(
      `${input.taskId}: authority owner archive artifacts are missing`,
    );
  }
  const artifactFiles = new Set<string>();
  for (const value of archiveManifest.artifacts) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(
        `${input.taskId}: authority owner archive artifact identity mismatch`,
      );
    }
    const artifact = value as { file?: unknown; sha256?: unknown };
    if (
      typeof artifact.file !== "string" ||
      artifact.file !== basename(artifact.file) ||
      artifact.file === "manifest.json" ||
      artifactFiles.has(artifact.file) ||
      typeof artifact.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(artifact.sha256)
    ) {
      throw new Error(
        `${input.taskId}: authority owner archive artifact identity mismatch`,
      );
    }
    artifactFiles.add(artifact.file);
    const artifactPath = resolve(archiveDirectory, artifact.file);
    if (!existsSync(artifactPath)) {
      throw new Error(
        `${input.taskId}: authority owner archive artifact is missing`,
      );
    }
    const actualHash = createHash("sha256")
      .update(readFileSync(artifactPath))
      .digest("hex");
    if (actualHash !== artifact.sha256) {
      throw new Error(
        `${input.taskId}: authority owner archive artifact hash mismatch`,
      );
    }
  }
  const validated = validatePreservedResumeLaunch({
    baseSha: input.taskBaseSha,
    branch: input.record.branch,
    controlCommonDir: input.controlCommonDir,
    evidence: input.evidence,
    expectedCommit: "none",
    mode: "preserved-worktree",
    proofHead: input.sourceHeadSha,
    resumeCommits: input.resumeCommits,
    sourceHeadSha: input.sourceHeadSha,
    startSha: input.sourceHeadSha,
    taskBaseSha: input.taskBaseSha,
    taskId: input.taskId,
    workdir: input.record.workdir,
  });
  if (input.record.workdir !== validated.workdir) {
    throw new Error(
      `${input.taskId}: authority owner registered workdir mismatch`,
    );
  }
  const lanePath = resolve(
    input.evidence,
    "lane-results",
    input.taskId,
    "lane-result.json",
  );
  if (!authorityRepair && !existsSync(lanePath)) {
    throw new Error(`${input.taskId}: authority owner lane result is missing`);
  }
  const lane = existsSync(lanePath)
    ? (JSON.parse(readFileSync(lanePath, "utf8")) as {
        readonly headSha?: unknown;
        readonly taskId?: unknown;
        readonly treeSha?: unknown;
      })
    : undefined;
  const git = (args: readonly string[]): string =>
    runRtk(["proxy", "git", ...args], {
      cwd: validated.workdir,
      quiet: true,
    });
  if (
    !gitIsAncestor(
      input.record.taskBaseSha,
      input.record.sourceHeadSha,
      validated.workdir,
    ) ||
    !gitIsAncestor(
      input.record.taskBaseSha,
      input.sourceHeadSha,
      validated.workdir,
    )
  ) {
    throw new Error(
      `${input.taskId}: authority owner archived provenance is not ancestral`,
    );
  }
  const archivedCommits = git([
    "rev-list",
    "--reverse",
    `${input.record.taskBaseSha}..${input.record.sourceHeadSha}`,
  ])
    .split("\n")
    .filter(Boolean);
  if (
    JSON.stringify(archiveManifest.source.commits) !==
    JSON.stringify(archivedCommits)
  ) {
    throw new Error(
      `${input.taskId}: authority owner archived commit sequence mismatch`,
    );
  }
  if (
    !authorityRepair &&
    (lane?.taskId !== input.taskId ||
      lane?.headSha !== input.sourceHeadSha ||
      lane?.treeSha !== git(["rev-parse", "HEAD^{tree}"]))
  ) {
    throw new Error(`${input.taskId}: authority owner lane identity mismatch`);
  }
  return {
    branch: validated.branch,
    factoryBaseSha: input.taskBaseSha,
    proofHeadSha: input.sourceHeadSha,
    resumeStrategy: "in-lane-cherry-pick",
    startSha: validated.headSha,
    workdir: validated.workdir,
  };
};
