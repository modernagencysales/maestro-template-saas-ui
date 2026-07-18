import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { hydrateWorktreeDependencies } from "./dependencies.js";
import { validateContractReproofRequest } from "./contract-reproof.js";
import { atomicWrite, jsonContent } from "./evidence-write.js";
import { focusedGateCommand } from "./gates.js";
import {
  git,
  gitIsAncestor,
  type JsonRecord,
  record,
  string,
} from "./integration-check-support.js";
import {
  INTEGRATION_WAVE_SCHEMA,
  readIntegrationWaveSelection,
  type IntegrationWaveSelectionV3,
  type IntegrationWaveTaskSnapshot,
} from "./integration-wave.js";
import {
  integrationGeneratedFileAllowlist,
  laneHistoryOwnershipIssues,
  laneHistoryShapeIssues,
} from "./lane-ownership.js";
import { validateFinalLaneResult } from "./lane-result.js";
import { proofChangedFilesMatch, validateProofContract } from "./proof.js";
import { runRtk } from "./process.js";

export type ApplyIntegrationWaveMode = "integrate" | "recover";

export interface ApplyIntegrationWaveHooks {
  readonly hydrate: (controlRoot: string, workdir: string) => void;
  readonly run: (args: readonly string[], workdir: string) => string;
}

export interface ApplyIntegrationWaveInput {
  readonly baseSha: string;
  readonly controlRoot: string;
  readonly evidenceDirectory: string;
  readonly hooks?: ApplyIntegrationWaveHooks;
  readonly integrationId: string;
  readonly mode: ApplyIntegrationWaveMode;
  readonly selectionFileSha256: string;
  readonly selectionPath: string;
  readonly selectionPayloadSha256: string;
  readonly workdir: string;
}

export interface ApplyIntegrationWaveIncludedTask {
  readonly taskId: string;
  readonly tranche: string;
  readonly laneHeadSha: string;
  readonly commitShas: readonly string[];
  readonly patchState: "applied" | "already-present";
}

export interface ApplyIntegrationWaveResult {
  readonly schemaVersion: "maestro-brain-integration-apply/v1";
  readonly integrationId: string;
  readonly mode: ApplyIntegrationWaveMode;
  readonly baseSha: string;
  readonly headSha: string;
  readonly selectionPayloadSha256: string;
  readonly selectionFileSha256: string;
  readonly includedTasks: readonly ApplyIntegrationWaveIncludedTask[];
  readonly generatedFiles: readonly string[];
  readonly focusedChecks: readonly string[];
  readonly conflicts: readonly [];
}

interface ValidatedLane {
  readonly commitShas: readonly string[];
  readonly focusedCommands: readonly string[];
  readonly snapshot: IntegrationWaveTaskSnapshot;
}

const productionHooks: ApplyIntegrationWaveHooks = {
  hydrate: hydrateWorktreeDependencies,
  run: (args, workdir) => runRtk(args, { cwd: workdir, quiet: true }),
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const exactSha = (value: string, length: 40 | 64, label: string): string => {
  if (!new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be a ${length}-character lowercase SHA`);
  }
  return value;
};

const absoluteRealPath = (value: string, label: string): string => {
  if (!isAbsolute(value)) throw new Error(`${label} must be absolute`);
  try {
    return realpathSync(value);
  } catch {
    throw new Error(`${label} does not exist`);
  }
};

const assertContained = (
  parent: string,
  child: string,
  label: string,
): void => {
  const path = relative(parent, child);
  if (path === "" || (!path.startsWith("..") && !isAbsolute(path))) return;
  throw new Error(`${label} escapes the control root`);
};

const json = (content: string, label: string): JsonRecord => {
  try {
    return record(JSON.parse(content), label);
  } catch (error) {
    throw new Error(
      `${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const manifestTasks = (
  controlRoot: string,
  planSha256: string,
): ReadonlyMap<string, JsonRecord> => {
  const path = resolve(
    controlRoot,
    "docs/superpowers/execution/maestro-brain/task-manifest.json",
  );
  const manifest = json(readFileSync(path, "utf8"), path);
  if (
    manifest.schemaVersion !== "maestro-brain-task-manifest/v1" ||
    manifest.planSha256 !== planSha256 ||
    !Array.isArray(manifest.tasks)
  ) {
    throw new Error("task manifest does not bind the wave plan");
  }
  return new Map(
    manifest.tasks.map((value, index) => {
      const task = record(value, `manifest.tasks[${index}]`);
      return [string(task.taskId, `manifest.tasks[${index}].taskId`), task];
    }),
  );
};

const lines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const gitStatusFiles = (workdir: string): string[] => {
  const tracked = lines(git(workdir, ["diff", "--name-only"]));
  const staged = lines(git(workdir, ["diff", "--cached", "--name-only"]));
  const untracked = lines(
    git(workdir, ["ls-files", "--others", "--exclude-standard"]),
  );
  return [...new Set([...tracked, ...staged, ...untracked])].sort();
};

const requireClean = (workdir: string, label: string): void => {
  const status = git(workdir, ["status", "--porcelain"]);
  if (status !== "")
    throw new Error(`${label} requires a clean worktree: ${status}`);
  const gitDirectory = git(workdir, ["rev-parse", "--git-dir"]);
  if (existsSync(resolve(workdir, gitDirectory, "CHERRY_PICK_HEAD"))) {
    throw new Error(`${label} found an active cherry-pick`);
  }
};

const contentAt = (path: string, label: string): string => {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  return readFileSync(path, "utf8");
};

const stringArray = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return value as readonly string[];
};

const validateLane = (input: {
  readonly baseSha: string;
  readonly evidenceDirectory: string;
  readonly manifest: ReadonlyMap<string, JsonRecord>;
  readonly snapshot: IntegrationWaveTaskSnapshot;
  readonly workdir: string;
}): ValidatedLane => {
  const { snapshot } = input;
  const taskId = snapshot.taskId;
  const manifestTask = input.manifest.get(taskId);
  if (!manifestTask) throw new Error(`${taskId}: absent from task manifest`);
  if (
    manifestTask.kind !== "product" ||
    manifestTask.fileInventoryStatus !== "ready" ||
    manifestTask.taskBlockHash !== snapshot.taskBlockHash ||
    manifestTask.tranche !== snapshot.tranche ||
    JSON.stringify(
      stringArray(manifestTask.fileLocks, `${taskId}: fileLocks`),
    ) !== JSON.stringify(snapshot.fileLocks) ||
    JSON.stringify(
      stringArray(manifestTask.codeStartAfter, `${taskId}: codeStartAfter`),
    ) !== JSON.stringify(snapshot.codeStartAfter)
  ) {
    throw new Error(`${taskId}: immutable manifest contract drift`);
  }
  for (const dependencyId of snapshot.codeStartAfter) {
    const path = resolve(
      input.evidenceDirectory,
      "lane-results",
      dependencyId,
      "lane-result.json",
    );
    const dependency = json(
      contentAt(path, `${taskId}: dependency ${dependencyId}`),
      path,
    );
    const integrationHeadSha = string(
      dependency.integrationHeadSha,
      `${dependencyId}: integrationHeadSha`,
    );
    if (
      !new Set(["integrated", "accepted"]).has(String(dependency.status)) ||
      !gitIsAncestor(input.workdir, integrationHeadSha, input.baseSha)
    ) {
      throw new Error(
        `${taskId}: dependency ${dependencyId} is absent from base`,
      );
    }
  }

  const directory = resolve(input.evidenceDirectory, "lane-results", taskId);
  const lanePath = resolve(directory, "lane-result.json");
  const proofPath = resolve(directory, "ci-proof-packet.json");
  const gatePath = resolve(directory, "lane-gate-report.json");
  const laneContent = contentAt(lanePath, `${taskId}: lane result`);
  const proofContent = contentAt(proofPath, `${taskId}: proof`);
  const gateContent = contentAt(gatePath, `${taskId}: final gate`);
  if (sha256(laneContent) !== snapshot.laneResultSha256) {
    throw new Error(`${taskId}: lane result digest drift`);
  }
  if (sha256(proofContent) !== snapshot.proofSha256) {
    throw new Error(`${taskId}: proof digest drift`);
  }
  if (sha256(gateContent) !== snapshot.gateSha256) {
    throw new Error(`${taskId}: final gate digest drift`);
  }
  const lane = json(laneContent, lanePath);
  const proof = json(proofContent, proofPath);
  const gate = json(gateContent, gatePath);
  const laneHead = exactSha(
    string(lane.headSha, `${taskId}: lane head`),
    40,
    `${taskId}: lane head`,
  );
  if (
    laneHead !== snapshot.headSha ||
    snapshot.proofHeadSha !== laneHead ||
    snapshot.gateHeadSha !== laneHead ||
    lane.tranche !== snapshot.tranche ||
    proof.planSha256 !== snapshot.planSha256
  ) {
    throw new Error(`${taskId}: selected lane identity drift`);
  }
  validateProofContract(proof, {
    taskBlockHash: snapshot.taskBlockHash,
    taskId,
  });
  validateFinalLaneResult(lane, {
    currentHeadSha: laneHead,
    currentTreeSha: git(input.workdir, ["rev-parse", `${laneHead}^{tree}`]),
    finalGateReport: gate,
    proof,
    taskId,
  });
  if (snapshot.reproofRequestSha256 !== undefined) {
    const reproof = record(lane.reproof, `${taskId}: reproof`);
    const requestPath = absoluteRealPath(
      string(reproof.requestPath, `${taskId}: reproof requestPath`),
      `${taskId}: reproof requestPath`,
    );
    assertContained(
      input.evidenceDirectory,
      requestPath,
      `${taskId}: reproof request`,
    );
    const requestDigest = sha256(readFileSync(requestPath, "utf8"));
    if (
      requestDigest !== snapshot.reproofRequestSha256 ||
      reproof.requestSha256 !== requestDigest
    ) {
      throw new Error(`${taskId}: reproof request digest drift`);
    }
    const request = validateContractReproofRequest(
      JSON.parse(readFileSync(requestPath, "utf8")),
      {
        controlHeadSha: string(proof.baseSha, `${taskId}: proof base`),
        planSha256: snapshot.planSha256,
        taskBlockHash: snapshot.taskBlockHash,
        taskId,
      },
    );
    const priorEvidencePath = absoluteRealPath(
      request.priorEvidencePath,
      `${taskId}: prior evidence path`,
    );
    assertContained(
      input.evidenceDirectory,
      priorEvidencePath,
      `${taskId}: prior evidence`,
    );
    if (
      sha256(readFileSync(priorEvidencePath, "utf8")) !==
      request.priorArchiveSha256
    ) {
      throw new Error(`${taskId}: prior reproof evidence drift`);
    }
  } else if (lane.reproof !== undefined) {
    throw new Error(`${taskId}: undeclared reproof request`);
  }

  const proofBase = exactSha(
    string(proof.baseSha, `${taskId}: proof base`),
    40,
    `${taskId}: proof base`,
  );
  if (!gitIsAncestor(input.workdir, proofBase, laneHead)) {
    throw new Error(`${taskId}: proof base is not an ancestor of lane head`);
  }
  const commitShas = lines(
    git(input.workdir, ["rev-list", "--reverse", `${proofBase}..${laneHead}`]),
  );
  if (commitShas.length === 0)
    throw new Error(`${taskId}: lane range is empty`);
  const history = commitShas.map((commit) => ({
    commit,
    files: lines(
      git(input.workdir, [
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        commit,
      ]),
    ),
    parentCount:
      lines(
        git(input.workdir, ["rev-list", "--parents", "-n", "1", commit]),
      )[0]?.split(/\s+/).length ?? 0,
  }));
  const shapeIssues = laneHistoryShapeIssues(
    history.map(({ commit, parentCount }) => ({
      commit,
      parentCount: parentCount - 1,
    })),
  );
  const ownershipIssues = laneHistoryOwnershipIssues(
    history,
    snapshot.fileLocks,
  );
  if (shapeIssues.length > 0 || ownershipIssues.length > 0) {
    throw new Error(
      `${taskId}: ${[...shapeIssues, ...ownershipIssues].join("; ")}`,
    );
  }
  const changedFiles = lines(
    git(input.workdir, ["diff", "--name-only", `${proofBase}..${laneHead}`]),
  );
  if (
    !proofChangedFilesMatch(snapshot.changedFiles, changedFiles) ||
    !proofChangedFilesMatch(
      stringArray(proof.changedFiles, `${taskId}: proof changedFiles`),
      changedFiles,
    )
  ) {
    throw new Error(`${taskId}: changed-file drift`);
  }
  const focusedCommands = stringArray(
    proof.focusedCommands,
    `${taskId}: focusedCommands`,
  );
  if (focusedCommands.length === 0) {
    throw new Error(`${taskId}: focusedCommands is empty`);
  }
  return { commitShas, focusedCommands, snapshot };
};

type PatchState = "all-missing" | "all-present" | "partial";

const classifyPatch = (
  workdir: string,
  currentHead: string,
  lane: ValidatedLane,
): PatchState => {
  if (gitIsAncestor(workdir, lane.snapshot.headSha, currentHead)) {
    return "all-present";
  }
  const proofBase = git(workdir, ["rev-parse", `${lane.commitShas[0]}^`]);
  const output = lines(
    git(workdir, ["cherry", currentHead, lane.snapshot.headSha, proofBase]),
  );
  const classified = new Map<string, string>();
  for (const line of output) {
    const match = /^([+-]) ([0-9a-f]{40})$/.exec(line);
    if (
      !match?.[1] ||
      !match[2] ||
      !lane.commitShas.includes(match[2]) ||
      classified.has(match[2])
    ) {
      throw new Error(
        `${lane.snapshot.taskId}: invalid git cherry classification`,
      );
    }
    classified.set(match[2], match[1]);
  }
  const signs = lane.commitShas.map((commit) => {
    if (gitIsAncestor(workdir, commit, currentHead)) return "-";
    const sign = classified.get(commit);
    if (!sign) {
      throw new Error(
        `${lane.snapshot.taskId}: incomplete git cherry classification`,
      );
    }
    return sign;
  });
  if (signs.every((sign) => sign === "+")) return "all-missing";
  if (signs.every((sign) => sign === "-")) return "all-present";
  return "partial";
};

const abortCherryPick = (workdir: string): void => {
  try {
    git(workdir, ["cherry-pick", "--abort"]);
  } catch {
    git(workdir, ["reset", "--hard", "HEAD"]);
  }
};

const generationCommands = (
  routeInputsChanged: boolean,
): readonly (readonly string[])[] => [
  ["pnpm", "confect:codegen"],
  ["pnpm", "confect:manifest"],
  ...(routeInputsChanged ? [["pnpm", "--dir", "apps/web", "build"]] : []),
];

const fileDigest = (root: string, file: string): string => {
  const path = resolve(root, file);
  return existsSync(path) ? sha256(readFileSync(path, "utf8")) : "<absent>";
};

const cleanWorkingResidue = (workdir: string): void => {
  const files = gitStatusFiles(workdir);
  git(workdir, ["reset", "--hard", "HEAD"]);
  for (const file of files) {
    if (git(workdir, ["ls-tree", "--name-only", "HEAD", "--", file]) !== file) {
      rmSync(resolve(workdir, file), { force: true, recursive: true });
    }
  }
};

const cleanGeneratedFailure = (
  workdir: string,
  files: readonly string[],
): void => {
  if (files.length > 0) git(workdir, ["reset", "HEAD", "--", ...files]);
  const tracked = files.filter(
    (file) =>
      git(workdir, ["ls-tree", "--name-only", "HEAD", "--", file]) === file,
  );
  if (tracked.length > 0)
    git(workdir, ["restore", "--worktree", "--", ...tracked]);
  for (const file of files.filter(
    (candidate) => !tracked.includes(candidate),
  )) {
    rmSync(resolve(workdir, file), { force: true, recursive: true });
  }
};

const generateStableOutput = (input: {
  readonly baseSha: string;
  readonly hooks: ApplyIntegrationWaveHooks;
  readonly laneFiles: readonly string[];
  readonly workdir: string;
}): readonly string[] => {
  const generationHead = git(input.workdir, ["rev-parse", "HEAD"]);
  const baseFiles = lines(
    git(input.workdir, ["diff", "--name-only", `${input.baseSha}..HEAD`]),
  );
  const allowlist = integrationGeneratedFileAllowlist({
    baseFiles,
    laneFiles: input.laneFiles,
  });
  const laneFileSet = new Set(input.laneFiles);
  const preexistingGeneratedFiles = baseFiles
    .filter((file) => !laneFileSet.has(file))
    .sort();
  const unauthorizedExisting = preexistingGeneratedFiles.filter(
    (file) => !allowlist.has(file),
  );
  if (unauthorizedExisting.length > 0) {
    throw new Error(
      `integration contains unauthorized non-lane files: ${unauthorizedExisting.join(", ")}`,
    );
  }
  const routeInputsChanged = input.laneFiles.some(
    (file) =>
      file.startsWith("apps/web/src/routes/") &&
      file !== "apps/web/src/routeTree.gen.ts",
  );
  const commands = generationCommands(routeInputsChanged);
  const runGenerationPlan = (): void => {
    for (const command of commands) {
      input.hooks.run(command, input.workdir);
      if (git(input.workdir, ["rev-parse", "HEAD"]) !== generationHead) {
        throw new Error("generator changed HEAD outside deterministic apply");
      }
    }
  };
  try {
    runGenerationPlan();
    const dirtyGeneratedFiles = gitStatusFiles(input.workdir);
    const generatedFiles = [
      ...new Set([...preexistingGeneratedFiles, ...dirtyGeneratedFiles]),
    ].sort();
    const unauthorized = generatedFiles.filter((file) => !allowlist.has(file));
    if (unauthorized.length > 0) {
      throw new Error(
        `generation changed unauthorized files: ${unauthorized.join(", ")}`,
      );
    }
    if (generatedFiles.length > 0) {
      input.hooks.run(
        ["pnpm", "exec", "prettier", "--write", "--", ...generatedFiles],
        input.workdir,
      );
    }
    const expected = new Map(
      generatedFiles.map((file) => [file, fileDigest(input.workdir, file)]),
    );
    runGenerationPlan();
    if (generatedFiles.length > 0) {
      input.hooks.run(
        ["pnpm", "exec", "prettier", "--write", "--", ...generatedFiles],
        input.workdir,
      );
    }
    const replayFiles = [
      ...new Set([
        ...preexistingGeneratedFiles,
        ...gitStatusFiles(input.workdir),
      ]),
    ].sort();
    if (
      JSON.stringify(replayFiles) !== JSON.stringify(generatedFiles) ||
      generatedFiles.some(
        (file) => expected.get(file) !== fileDigest(input.workdir, file),
      )
    ) {
      throw new Error("generated output is not byte-stable after replay");
    }
    const changedForCommit = gitStatusFiles(input.workdir);
    if (changedForCommit.length > 0) {
      git(input.workdir, ["add", "--", ...changedForCommit]);
      git(input.workdir, [
        "commit",
        "-m",
        "chore: refresh integration generated output",
      ]);
    }
    return generatedFiles;
  } catch (error) {
    if (git(input.workdir, ["rev-parse", "HEAD"]) !== generationHead) {
      git(input.workdir, ["reset", "--hard", generationHead]);
    }
    cleanGeneratedFailure(input.workdir, gitStatusFiles(input.workdir));
    throw error;
  }
};

export const applyIntegrationWave = (
  rawInput: ApplyIntegrationWaveInput,
): ApplyIntegrationWaveResult => {
  if (rawInput.mode !== "integrate" && rawInput.mode !== "recover") {
    throw new Error("mode must be integrate or recover");
  }
  const controlRoot = absoluteRealPath(rawInput.controlRoot, "controlRoot");
  const workdir = absoluteRealPath(rawInput.workdir, "workdir");
  const evidenceDirectory = absoluteRealPath(
    rawInput.evidenceDirectory,
    "evidenceDirectory",
  );
  const selectionPath = absoluteRealPath(
    rawInput.selectionPath,
    "selectionPath",
  );
  assertContained(controlRoot, evidenceDirectory, "evidenceDirectory");
  assertContained(controlRoot, selectionPath, "selectionPath");
  const baseSha = exactSha(rawInput.baseSha, 40, "baseSha");
  const selectionPayloadDigest = exactSha(
    rawInput.selectionPayloadSha256,
    64,
    "selectionPayloadSha256",
  );
  const selectionFileDigest = exactSha(
    rawInput.selectionFileSha256,
    64,
    "selectionFileSha256",
  );
  if (!/^wave-\d{6}$/.test(rawInput.integrationId)) {
    throw new Error("integrationId is invalid");
  }
  const selectionContent = readFileSync(selectionPath, "utf8");
  if (sha256(selectionContent) !== selectionFileDigest) {
    throw new Error("selection file hash mismatch");
  }
  const read = readIntegrationWaveSelection(selectionContent);
  if (read.legacy || read.selection.schemaVersion !== INTEGRATION_WAVE_SCHEMA) {
    throw new Error("deterministic apply requires a v3 selection");
  }
  const selection = read.selection as IntegrationWaveSelectionV3;
  if (
    read.selectionPayloadSha256 !== selectionPayloadDigest ||
    selection.selectionPayloadSha256 !== selectionPayloadDigest
  ) {
    throw new Error("selection payload hash mismatch");
  }
  if (
    selection.integrationId !== rawInput.integrationId ||
    selection.baseSha !== baseSha
  ) {
    throw new Error("selection launch identity mismatch");
  }
  requireClean(workdir, "integration apply");
  const initialHead = git(workdir, ["rev-parse", "HEAD"]);
  if (rawInput.mode === "integrate" && initialHead !== baseSha) {
    throw new Error("integrate mode requires HEAD at exact baseSha");
  }
  if (
    rawInput.mode === "recover" &&
    !gitIsAncestor(workdir, baseSha, initialHead)
  ) {
    throw new Error("recover mode requires baseSha to be an ancestor of HEAD");
  }
  const manifest = manifestTasks(controlRoot, selection.planSha256);
  const hooks = rawInput.hooks ?? productionHooks;
  const includedTasks: ApplyIntegrationWaveIncludedTask[] = [];
  const lanes: ValidatedLane[] = [];
  for (const snapshot of selection.selectedTasks) {
    if (snapshot.planSha256 !== selection.planSha256) {
      throw new Error(`${snapshot.taskId}: selection plan drift`);
    }
    lanes.push(
      validateLane({
        baseSha,
        evidenceDirectory,
        manifest,
        snapshot,
        workdir,
      }),
    );
  }
  const initialPatchStates = new Map(
    lanes.map((lane) => [
      lane.snapshot.taskId,
      classifyPatch(workdir, initialHead, lane),
    ]),
  );
  if (rawInput.mode === "recover") {
    const partial = [...initialPatchStates].find(
      ([, state]) => state === "partial",
    );
    if (partial)
      throw new Error(`${partial[0]}: partial lane range is forbidden`);
    const currentCommits = lines(
      git(workdir, ["rev-list", "--reverse", `${baseSha}..${initialHead}`]),
    );
    if (
      currentCommits.some(
        (commit) =>
          lines(
            git(workdir, ["rev-list", "--parents", "-n", "1", commit]),
          )[0]?.split(/\s+/).length !== 2,
      )
    ) {
      throw new Error("recover mode rejects unrecorded merge commits");
    }
    const laneFiles = lanes.flatMap((lane) => lane.snapshot.changedFiles);
    const allowedGenerated = integrationGeneratedFileAllowlist({
      baseFiles: lines(
        git(workdir, ["diff", "--name-only", `${baseSha}..${initialHead}`]),
      ),
      laneFiles,
    });
    const nonGeneratedCommits = currentCommits.filter((commit) =>
      lines(
        git(workdir, [
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          commit,
        ]),
      ).some((file) => !allowedGenerated.has(file)),
    );
    const presentCommitCount = lanes
      .filter(
        (lane) =>
          initialPatchStates.get(lane.snapshot.taskId) === "all-present",
      )
      .reduce((total, lane) => total + lane.commitShas.length, 0);
    const extraCommits = currentCommits.slice(presentCommitCount);
    const validRecoveredGeneratedCommit =
      extraCommits.length === 1 &&
      git(workdir, ["show", "-s", "--format=%s", extraCommits[0] as string]) ===
        "chore: refresh integration generated output" &&
      lines(
        git(workdir, [
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          extraCommits[0] as string,
        ]),
      ).every((file) => allowedGenerated.has(file));
    if (
      nonGeneratedCommits.length !== presentCommitCount ||
      (extraCommits.length > 0 && !validRecoveredGeneratedCommit)
    ) {
      throw new Error("recover mode found an unrelated or unrecorded commit");
    }
  }

  for (const lane of lanes) {
    const state =
      rawInput.mode === "recover"
        ? initialPatchStates.get(lane.snapshot.taskId)
        : classifyPatch(workdir, git(workdir, ["rev-parse", "HEAD"]), lane);
    if (state === "partial") {
      throw new Error(
        `${lane.snapshot.taskId}: partial lane range is forbidden`,
      );
    }
    if (state === "all-present") {
      if (rawInput.mode === "integrate") {
        throw new Error(`${lane.snapshot.taskId}: duplicate lane input`);
      }
      includedTasks.push({
        commitShas: lane.commitShas,
        laneHeadSha: lane.snapshot.headSha,
        patchState: "already-present",
        taskId: lane.snapshot.taskId,
        tranche: lane.snapshot.tranche,
      });
      continue;
    }
    for (const commit of lane.commitShas) {
      try {
        git(workdir, ["cherry-pick", commit]);
      } catch (error) {
        abortCherryPick(workdir);
        requireClean(workdir, `${lane.snapshot.taskId}: conflict cleanup`);
        throw new Error(
          `${lane.snapshot.taskId}: cherry-pick ${commit} conflicted: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (
      classifyPatch(workdir, git(workdir, ["rev-parse", "HEAD"]), lane) !==
      "all-present"
    ) {
      throw new Error(`${lane.snapshot.taskId}: applied lane patch is absent`);
    }
    includedTasks.push({
      commitShas: lane.commitShas,
      laneHeadSha: lane.snapshot.headSha,
      patchState: "applied",
      taskId: lane.snapshot.taskId,
      tranche: lane.snapshot.tranche,
    });
  }

  let generatedFiles: readonly string[] = [];
  const focusedChecks: string[] = [];
  let cleanupHead = git(workdir, ["rev-parse", "HEAD"]);
  try {
    hooks.hydrate(controlRoot, workdir);
    if (git(workdir, ["rev-parse", "HEAD"]) !== cleanupHead) {
      throw new Error("dependency hydration changed HEAD");
    }
    generatedFiles = generateStableOutput({
      baseSha,
      hooks,
      laneFiles: lanes.flatMap((lane) => lane.snapshot.changedFiles),
      workdir,
    });
    cleanupHead = git(workdir, ["rev-parse", "HEAD"]);
    const seenFocused = new Set<string>();
    for (const command of lanes.flatMap((lane) => lane.focusedCommands)) {
      const parsed = focusedGateCommand(command);
      const normalized = `rtk ${parsed.program} ${parsed.args.join(" ")}`;
      if (seenFocused.has(normalized)) continue;
      seenFocused.add(normalized);
      hooks.run([parsed.program, ...parsed.args], workdir);
      if (git(workdir, ["rev-parse", "HEAD"]) !== cleanupHead) {
        throw new Error(`focused check changed HEAD: ${normalized}`);
      }
      focusedChecks.push(normalized);
    }
    requireClean(workdir, "successful integration apply");
  } catch (error) {
    if (git(workdir, ["rev-parse", "HEAD"]) !== cleanupHead) {
      git(workdir, ["reset", "--hard", cleanupHead]);
    }
    cleanWorkingResidue(workdir);
    throw error;
  }
  const headSha = git(workdir, ["rev-parse", "HEAD"]);
  const result: ApplyIntegrationWaveResult = {
    baseSha,
    conflicts: [],
    focusedChecks,
    generatedFiles,
    headSha,
    includedTasks,
    integrationId: rawInput.integrationId,
    mode: rawInput.mode,
    schemaVersion: "maestro-brain-integration-apply/v1",
    selectionFileSha256: selectionFileDigest,
    selectionPayloadSha256: selectionPayloadDigest,
  };
  const resultPath = resolve(
    evidenceDirectory,
    "integration",
    rawInput.integrationId,
    "integration-result.json",
  );
  mkdirSync(dirname(resultPath), { recursive: true });
  atomicWrite(
    resultPath,
    jsonContent({
      ...result,
      reviewVerdict: "pending",
      schemaVersion: "maestro-brain-integration-result/v3",
      status: "ready_for_review",
    }),
  );
  return result;
};
