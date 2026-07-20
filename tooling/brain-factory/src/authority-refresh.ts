import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import type { AuthorityRepairTransition } from "./manifest.js";

import { validateFinalLaneResult } from "./lane-result.js";
import {
  laneHistoryOwnershipIssues,
  laneHistoryShapeIssues,
} from "./lane-ownership.js";
import { validateProofContract, proofChangedFilesMatch } from "./proof.js";
import {
  changedHandAuthoredSourceLines,
  validSourceSlices,
} from "./source-budget.js";

type JsonRecord = Record<string, unknown>;
type GitRunner = (cwd: string, args: readonly string[]) => string;

export interface AuthorityRefreshTask {
  readonly fileLocks: readonly string[];
  readonly planSha256: string;
  readonly sourceSliceBudget: number;
  readonly sourceSliceLimit: number;
  readonly taskBlockHash: string;
  readonly taskId: string;
}

interface AuthorityRefreshCoordinatesInput {
  readonly controlHeadSha: string;
  readonly planSha256: string;
  readonly root: string;
  readonly taskBlockHash: string;
  readonly taskId: string;
  readonly branchExists?: (branch: string) => boolean;
}

export interface AuthorityRefreshCoordinates {
  readonly authorityId: string;
  readonly branch: string;
  readonly workdir: string;
}

interface PreservedArtifact {
  readonly content: string;
  readonly file: string;
  readonly sha256: string;
}

export interface AuthorityRefreshAdmission {
  readonly archiveDirectory: string;
  readonly artifacts: readonly PreservedArtifact[];
  readonly controlHeadSha: string;
  readonly coordinates: AuthorityRefreshCoordinates;
  readonly oldAuthority: {
    readonly planSha256: string;
    readonly taskBlockHash: string;
  };
  readonly sourceCommits: readonly string[];
  readonly sourceHeadSha: string;
  readonly task: AuthorityRefreshTask;
  readonly taskBaseSha: string;
  readonly transitionKind: "authority-refresh" | "authority-repair";
  readonly supersededPaths: AuthorityRepairTransition["supersededPaths"];
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const exactSha = (value: unknown, length: 40 | 64, label: string): string => {
  if (
    typeof value !== "string" ||
    !new RegExp(`^[0-9a-f]{${length}}$`).test(value)
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
};

const jsonRecord = (content: string, label: string): JsonRecord => {
  const value: unknown = JSON.parse(content);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
};

const lines = (value: string): readonly string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const terminalStatuses = new Set([
  "canceled",
  "cancelled",
  "failed",
  "succeeded",
]);

export const assertAuthorityRefreshTerminalStatus = (
  status: string | undefined,
  taskId: string,
): void => {
  if (!status || status === "unknown") {
    throw new Error(`${taskId}: source run status is unknown`);
  }
  if (!terminalStatuses.has(status)) {
    throw new Error(`${taskId}: source run is not terminal (${status})`);
  }
};

export const authorityRefreshCoordinates = (
  input: AuthorityRefreshCoordinatesInput,
): AuthorityRefreshCoordinates => {
  exactSha(input.controlHeadSha, 40, "authority refresh control HEAD");
  exactSha(input.planSha256, 64, "authority refresh plan SHA");
  exactSha(input.taskBlockHash, 64, "authority refresh task block hash");
  const authorityId = sha256(
    [input.controlHeadSha, input.planSha256, input.taskBlockHash].join(":"),
  ).slice(0, 12);
  const slug = input.taskId.toLowerCase();
  const branch = `fabro/review-${slug}-authority-${authorityId}`;
  const workdir = resolve(
    input.root,
    "..",
    ".maestro-brain-fabro-workdirs",
    `resume-${slug}-authority-${authorityId}`,
  );
  if (existsSync(workdir)) {
    throw new Error(
      `${input.taskId}: authority refresh worktree already exists at ${workdir}`,
    );
  }
  if (input.branchExists?.(branch)) {
    throw new Error(
      `${input.taskId}: authority refresh branch ${branch} already exists`,
    );
  }
  return { authorityId, branch, workdir };
};

export const admitAuthorityRefresh = (input: {
  readonly authorityRepairTransition?: AuthorityRepairTransition;
  readonly controlHeadSha: string;
  readonly evidence: string;
  readonly root: string;
  readonly runGit: GitRunner;
  readonly sourceBranch: string;
  readonly sourceRunId?: string;
  readonly sourceWorkdir: string;
  readonly task: AuthorityRefreshTask;
  readonly integratedTaskIds?: readonly string[];
  readonly readGitBlob?: (cwd: string, objectSha: string) => string;
  readonly branchExists?: (branch: string) => boolean;
}): AuthorityRefreshAdmission => {
  const taskId = input.task.taskId;
  const transition = input.authorityRepairTransition;
  const repair = transition !== undefined;
  const laneDirectory = resolve(input.evidence, "lane-results", taskId);
  const paths = {
    gate: resolve(laneDirectory, "lane-gate-report.json"),
    lane: resolve(laneDirectory, "lane-result.json"),
    proof: resolve(laneDirectory, "ci-proof-packet.json"),
  };
  for (const [label, path] of Object.entries(paths)) {
    if (repair && label === "lane") continue;
    if (!existsSync(path))
      throw new Error(`${taskId}: ${label} evidence is missing`);
  }
  if (!existsSync(input.sourceWorkdir)) {
    throw new Error(`${taskId}: source worktree is missing`);
  }
  const sourceWorkdir = realpathSync(input.sourceWorkdir);
  const root = realpathSync(input.root);
  const git = (cwd: string, args: readonly string[]): string =>
    input.runGit(cwd, args).trim();
  exactSha(input.controlHeadSha, 40, `${taskId}: controller HEAD`);
  if (git(root, ["rev-parse", "HEAD"]) !== input.controlHeadSha) {
    throw new Error(`${taskId}: controller HEAD mismatch`);
  }
  const controllerStatus = git(root, ["status", "--porcelain=v1"]);
  if (controllerStatus) {
    throw new Error(
      `${taskId}: controller worktree is dirty: ${controllerStatus}`,
    );
  }
  if (
    realpathSync(git(sourceWorkdir, ["rev-parse", "--show-toplevel"])) !==
    sourceWorkdir
  ) {
    throw new Error(`${taskId}: source worktree path mismatch`);
  }
  if (
    realpathSync(
      git(sourceWorkdir, [
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ]),
    ) !==
    realpathSync(
      git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    )
  ) {
    throw new Error(`${taskId}: source worktree common directory mismatch`);
  }
  if (git(sourceWorkdir, ["branch", "--show-current"]) !== input.sourceBranch) {
    throw new Error(`${taskId}: source worktree branch mismatch`);
  }
  const status = git(sourceWorkdir, ["status", "--porcelain=v1"]);
  if (status) throw new Error(`${taskId}: source worktree is dirty: ${status}`);

  const contents = {
    gate: readFileSync(paths.gate, "utf8"),
    lane: repair ? undefined : readFileSync(paths.lane, "utf8"),
    proof: readFileSync(paths.proof, "utf8"),
  };
  const proof = jsonRecord(contents.proof, `${taskId}: CI proof`);
  const gate = jsonRecord(contents.gate, `${taskId}: final gate`);
  const lane = repair
    ? undefined
    : jsonRecord(contents.lane ?? "", `${taskId}: lane result`);
  const sourceHeadSha = exactSha(
    repair ? transition.sourceHeadSha : lane?.headSha,
    40,
    `${taskId}: lane head`,
  );
  const sourceTreeSha = exactSha(
    repair ? transition.sourceTreeSha : lane?.treeSha,
    40,
    `${taskId}: lane tree`,
  );
  if (git(sourceWorkdir, ["rev-parse", "HEAD"]) !== sourceHeadSha) {
    throw new Error(`${taskId}: source worktree HEAD mismatch`);
  }
  if (git(sourceWorkdir, ["rev-parse", "HEAD^{tree}"]) !== sourceTreeSha) {
    throw new Error(`${taskId}: source worktree tree mismatch`);
  }
  if (repair) {
    if (
      input.sourceRunId !== transition.sourceRunId ||
      transition.fromPlanSha256 !== proof.planSha256 ||
      transition.fromTaskBlockHash !== proof.taskBlockHash ||
      transition.sourceBaseSha !== proof.baseSha ||
      proof.reviewVerdict !== "rework" ||
      proof.reviewHeadSha !== sourceHeadSha ||
      !Array.isArray(proof.reviewFindings) ||
      proof.reviewFindings.length === 0
    ) {
      throw new Error(`${taskId}: authority-repair proof provenance mismatch`);
    }
    const findingIds = proof.reviewFindings.map((finding) =>
      typeof finding === "object" && finding !== null && !Array.isArray(finding)
        ? (finding as JsonRecord).id
        : undefined,
    );
    if (
      findingIds.some((id) => typeof id !== "string" || !id) ||
      new Set(findingIds).size !== findingIds.length
    ) {
      throw new Error(`${taskId}: authority-repair findings are invalid`);
    }
    if (
      gate.schemaVersion !== "maestro-brain-lane-gate/v1" ||
      gate.taskId !== taskId ||
      gate.stage !== "pre-review" ||
      gate.status !== "passed" ||
      gate.headSha !== sourceHeadSha ||
      gate.currentHeadSha !== sourceHeadSha ||
      gate.currentTreeSha !== sourceTreeSha ||
      gate.planSha256 !== transition.fromPlanSha256 ||
      gate.taskBlockHash !== transition.fromTaskBlockHash
    ) {
      throw new Error(`${taskId}: authority-repair pre-review gate is invalid`);
    }
    const integrated = new Set(input.integratedTaskIds ?? []);
    const missing = transition.requiredIntegratedTaskIds.filter(
      (prerequisite) => !integrated.has(prerequisite),
    );
    if (missing.length > 0) {
      throw new Error(
        `${taskId}: authority-repair prerequisite is not integrated: ${missing.join(", ")}`,
      );
    }
  } else {
    validateFinalLaneResult(lane as JsonRecord, {
      currentHeadSha: sourceHeadSha,
      currentTreeSha: sourceTreeSha,
      finalGateReport: gate,
      proof,
      taskId,
    });
  }
  const oldTaskBlockHash = exactSha(
    proof.taskBlockHash,
    64,
    `${taskId}: prior task block hash`,
  );
  const oldPlanSha256 = validateProofContract(proof, {
    taskBlockHash: oldTaskBlockHash,
    taskId,
  });
  exactSha(oldPlanSha256, 64, `${taskId}: prior plan SHA`);
  if (
    oldPlanSha256 === input.task.planSha256 &&
    oldTaskBlockHash === input.task.taskBlockHash
  ) {
    throw new Error(`${taskId}: lane already matches current authority`);
  }
  if (
    oldPlanSha256 === input.task.planSha256 ||
    oldTaskBlockHash === input.task.taskBlockHash
  ) {
    throw new Error(`${taskId}: prior plan and task authority mismatch`);
  }
  const taskBaseSha = exactSha(proof.baseSha, 40, `${taskId}: proof base`);
  try {
    git(sourceWorkdir, [
      "merge-base",
      "--is-ancestor",
      taskBaseSha,
      sourceHeadSha,
    ]);
  } catch {
    throw new Error(`${taskId}: proof base is not an ancestor of lane HEAD`);
  }
  const sourceCommits = lines(
    git(sourceWorkdir, [
      "rev-list",
      "--reverse",
      `${taskBaseSha}..${sourceHeadSha}`,
    ]),
  );
  const histories = sourceCommits.map((commit) => {
    const revision = lines(
      git(sourceWorkdir, ["rev-list", "--parents", "-n", "1", commit]),
    )[0];
    if (!revision)
      throw new Error(`${taskId}: source commit ${commit} drifted`);
    return {
      commit,
      files: lines(
        git(sourceWorkdir, [
          "diff-tree",
          "--root",
          "--no-commit-id",
          "--name-only",
          "-r",
          "--no-renames",
          commit,
        ]),
      ),
      parentCount: Math.max(0, revision.split(/\s+/).length - 1),
      sourceLines: changedHandAuthoredSourceLines(
        git(sourceWorkdir, [
          "show",
          "--no-renames",
          "--numstat",
          "--format=",
          commit,
        ]),
      ),
    };
  });
  const shapeIssues = laneHistoryShapeIssues(histories);
  if (shapeIssues.length > 0)
    throw new Error(`${taskId}: ${shapeIssues.join("; ")}`);
  const ownershipIssues = laneHistoryOwnershipIssues(
    histories,
    repair
      ? [
          ...input.task.fileLocks,
          ...transition.supersededPaths.map(({ path }) => path),
        ]
      : input.task.fileLocks,
  );
  if (ownershipIssues.length > 0) {
    throw new Error(
      `${taskId}: ${ownershipIssues
        .join("; ")
        .replaceAll(
          "not declared in manifest fileLocks",
          "not declared in current manifest fileLocks",
        )}`,
    );
  }
  if (
    !validSourceSlices(
      histories.map((history) => history.sourceLines),
      input.task.sourceSliceBudget,
      input.task.sourceSliceLimit,
    )
  ) {
    throw new Error(
      `${taskId}: source slice limit or budget does not admit preserved commits`,
    );
  }
  const actualChangedFiles = lines(
    git(sourceWorkdir, [
      "diff",
      "--name-only",
      "--no-renames",
      `${taskBaseSha}..${sourceHeadSha}`,
    ]),
  );
  if (
    repair &&
    transition.supersededPaths.some(
      ({ path }) => !actualChangedFiles.includes(path),
    )
  ) {
    throw new Error(`${taskId}: authority-repair superseded path is absent`);
  }
  if (
    !Array.isArray(proof.changedFiles) ||
    !proof.changedFiles.every((file) => typeof file === "string") ||
    !proofChangedFilesMatch(proof.changedFiles as string[], actualChangedFiles)
  ) {
    throw new Error(`${taskId}: proof changed files mismatch source history`);
  }
  const coordinates = authorityRefreshCoordinates({
    ...(input.branchExists ? { branchExists: input.branchExists } : {}),
    controlHeadSha: input.controlHeadSha,
    planSha256: input.task.planSha256,
    root: input.root,
    taskBlockHash: input.task.taskBlockHash,
    taskId,
  });
  const archiveDirectory = resolve(
    input.evidence,
    "authority-refreshes",
    taskId,
    coordinates.authorityId,
  );
  if (existsSync(archiveDirectory)) {
    throw new Error(
      `${taskId}: authority refresh evidence coordinates already exist`,
    );
  }
  const artifactInputs: (readonly [string, string])[] = repair
    ? [
        ["prior-proof.json", contents.proof],
        ["prior-pre-review-gate.json", contents.gate],
        [
          "authority-repair-transition.json",
          `${JSON.stringify(transition, null, 2)}\n`,
        ],
      ]
    : [
        ["prior-lane-result.json", contents.lane ?? ""],
        ["prior-proof.json", contents.proof],
        ["prior-final-gate.json", contents.gate],
      ];
  if (repair) {
    const lensDirectory = resolve(
      laneDirectory,
      "review-lenses",
      sourceHeadSha,
    );
    const lensFindingIds = new Set<string>();
    for (const lens of ["contract", "safety", "quality"] as const) {
      const lensPath = resolve(lensDirectory, `${lens}.json`);
      if (!existsSync(lensPath)) {
        throw new Error(
          `${taskId}: authority-repair ${lens} review is missing`,
        );
      }
      const content = readFileSync(lensPath, "utf8");
      const artifact = jsonRecord(content, `${taskId}: ${lens} review`);
      if (
        artifact.lens !== lens ||
        artifact.taskId !== taskId ||
        artifact.planSha256 !== transition.fromPlanSha256 ||
        artifact.taskBlockHash !== transition.fromTaskBlockHash ||
        artifact.baseSha !== transition.sourceBaseSha ||
        artifact.headSha !== sourceHeadSha ||
        artifact.treeSha !== sourceTreeSha ||
        !Array.isArray(artifact.findings)
      ) {
        throw new Error(`${taskId}: authority-repair ${lens} review drifted`);
      }
      for (const finding of artifact.findings) {
        if (
          typeof finding === "object" &&
          finding !== null &&
          !Array.isArray(finding)
        ) {
          const id = (finding as JsonRecord).id;
          if (typeof id === "string") lensFindingIds.add(id);
        }
      }
      artifactInputs.push([`prior-review-${lens}.json`, content]);
    }
    const proofFindingIds = (proof.reviewFindings as JsonRecord[]).map(
      (finding) => finding.id as string,
    );
    if (
      proofFindingIds.some((id) => !lensFindingIds.has(id)) ||
      [...lensFindingIds].some((id) => !proofFindingIds.includes(id))
    ) {
      throw new Error(`${taskId}: authority-repair review findings drifted`);
    }
    for (const finding of transition.immutableFindings) {
      let objectType: string;
      let content: string;
      try {
        objectType = git(sourceWorkdir, ["cat-file", "-t", finding.objectSha]);
        if (!input.readGitBlob) {
          throw new Error("raw Git blob reader is missing");
        }
        content = input.readGitBlob(sourceWorkdir, finding.objectSha);
      } catch {
        throw new Error(`${taskId}: immutable finding object is missing`);
      }
      if (objectType !== "blob" || sha256(content) !== finding.contentSha256) {
        throw new Error(`${taskId}: immutable finding object drifted`);
      }
      artifactInputs.push([
        `independent-finding-${finding.objectSha}.txt`,
        content,
      ]);
    }
  }
  const artifacts = artifactInputs.map(([file, content]) => ({
    content,
    file,
    sha256: sha256(content),
  }));
  return {
    archiveDirectory,
    artifacts,
    controlHeadSha: input.controlHeadSha,
    coordinates,
    oldAuthority: {
      planSha256: oldPlanSha256,
      taskBlockHash: oldTaskBlockHash,
    },
    sourceCommits,
    sourceHeadSha,
    task: input.task,
    taskBaseSha,
    transitionKind: repair ? "authority-repair" : "authority-refresh",
    supersededPaths: transition?.supersededPaths ?? [],
  };
};

export const preserveAuthorityRefreshEvidence = (
  admission: AuthorityRefreshAdmission,
  fileSystem: {
    readonly remove: (path: string) => void;
    readonly rename: (from: string, to: string) => void;
    readonly write: (
      path: string,
      content: string,
      options: { readonly flag: "wx" },
    ) => void;
  } = {
    remove: (path) => rmSync(path, { force: true, recursive: true }),
    rename: renameSync,
    write: writeFileSync,
  },
): void => {
  if (existsSync(admission.archiveDirectory)) {
    throw new Error(
      `${admission.task.taskId}: authority refresh evidence coordinates already exist`,
    );
  }
  const stagingDirectory = `${admission.archiveDirectory}.next`;
  if (existsSync(stagingDirectory)) fileSystem.remove(stagingDirectory);
  mkdirSync(stagingDirectory, { recursive: true });
  const manifest = {
    schemaVersion:
      admission.transitionKind === "authority-repair"
        ? "maestro-brain-authority-repair-archive/v1"
        : "maestro-brain-authority-refresh-archive/v1",
    taskId: admission.task.taskId,
    authorityId: admission.coordinates.authorityId,
    currentAuthority: {
      controlHeadSha: admission.controlHeadSha,
      planSha256: admission.task.planSha256,
      taskBlockHash: admission.task.taskBlockHash,
    },
    oldAuthority: admission.oldAuthority,
    source: {
      baseSha: admission.taskBaseSha,
      commits: admission.sourceCommits,
      headSha: admission.sourceHeadSha,
    },
    transitionKind: admission.transitionKind,
    supersededPaths: admission.supersededPaths,
    artifacts: admission.artifacts.map(({ file, sha256: digest }) => ({
      file,
      sha256: digest,
    })),
  };
  try {
    for (const artifact of admission.artifacts) {
      fileSystem.write(
        resolve(stagingDirectory, artifact.file),
        artifact.content,
        { flag: "wx" },
      );
    }
    fileSystem.write(
      resolve(stagingDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx" },
    );
    for (const artifact of admission.artifacts) {
      if (
        sha256(
          readFileSync(resolve(stagingDirectory, artifact.file), "utf8"),
        ) !== artifact.sha256
      ) {
        throw new Error(
          `${admission.task.taskId}: staged authority evidence hash mismatch`,
        );
      }
    }
    fileSystem.rename(stagingDirectory, admission.archiveDirectory);
  } catch (error) {
    fileSystem.remove(stagingDirectory);
    throw error;
  }
};
