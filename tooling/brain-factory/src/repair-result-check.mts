import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { changedHandAuthoredSourceLines } from "./source-budget.js";
import { fabroRunId, gitSha } from "./integration-recovery.js";

type JsonRecord = Record<string, unknown>;

const recoveryRequiredFindingIds = new Set(["legacy-integration-run-failed"]);

const record = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as JsonRecord;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
  return value;
};

const readJson = (path: string): JsonRecord =>
  record(JSON.parse(readFileSync(path, "utf8")), path);

const git = (workdir: string, args: readonly string[]): string => {
  const result = spawnSync("git", args, { cwd: workdir, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
};

export interface RepairCheckInput {
  readonly auditPath: string;
  readonly baseSha: string;
  readonly evidenceDirectory: string;
  readonly expectedWorkdir: string;
  readonly sourceReviewRun: string;
  readonly stage: "record" | "review";
  readonly tranche: string;
}

export const validateRepairResult = (input: RepairCheckInput): void => {
  if (
    !isAbsolute(input.expectedWorkdir) ||
    !isAbsolute(input.evidenceDirectory) ||
    !isAbsolute(input.auditPath)
  )
    throw new Error(
      "workdir, evidence directory, and audit path must be absolute",
    );
  const workdir = realpathSync(input.expectedWorkdir);
  const repairBaseSha = gitSha(input.baseSha, "repair baseSha");
  const sourceReviewRun = fabroRunId(input.sourceReviewRun, "sourceReviewRun");
  const resultPath = resolve(
    input.evidenceDirectory,
    "integration",
    input.tranche,
    "integration-result.json",
  );
  const result = readJson(resultPath);
  const headSha = gitSha(git(workdir, ["rev-parse", "HEAD"]), "worktree HEAD");
  if (
    string(result.schemaVersion, "schemaVersion") !==
    "maestro-brain-integration-result/v1"
  )
    throw new Error("unexpected integration result schema");
  if (string(result.tranche, "tranche") !== input.tranche)
    throw new Error("tranche mismatch");
  if (string(result.integrationId, "integrationId") !== input.tranche)
    throw new Error("integration ID mismatch");
  if (string(result.manifestTranche, "manifestTranche") !== input.tranche)
    throw new Error("manifest tranche mismatch");
  const resultBaseSha = gitSha(result.baseSha, "baseSha");
  if (
    realpathSync(string(result.integrationWorkdir, "integrationWorkdir")) !==
    workdir
  )
    throw new Error("integration workdir mismatch");
  if (gitSha(result.headSha, "headSha") !== headSha)
    throw new Error("evidence head does not match HEAD");
  if (result.reviewVerdict !== "pass")
    throw new Error("review verdict is not pass");
  if (git(workdir, ["status", "--porcelain"]) !== "")
    throw new Error("integration worktree is not clean");
  git(workdir, ["merge-base", "--is-ancestor", repairBaseSha, headSha]);

  if (result.sourceRunStatus !== "failed")
    throw new Error("source run status is not failed");
  if (
    fabroRunId(result.sourceReviewRun, "result sourceReviewRun") !==
    sourceReviewRun
  )
    throw new Error("source review run mismatch");
  const recovery = record(result.recovery, "recovery");
  if (
    recovery.schemaVersion !== "maestro-brain-integration-recovery/v1" ||
    recovery.sourceRunStatus !== "failed" ||
    fabroRunId(recovery.sourceReviewRun, "recovery sourceReviewRun") !==
      sourceReviewRun
  )
    throw new Error("invalid recovery history");
  const recoveryAt = string(recovery.at, "recovery at");
  const recoveryReason = string(recovery.reason, "recovery reason");
  const legacyBaseHeadSha = gitSha(
    recovery.legacyBaseHeadSha,
    "recovery legacyBaseHeadSha",
  );
  if (resultBaseSha !== legacyBaseHeadSha)
    throw new Error("recovery base history mismatch");
  if (!Array.isArray(recovery.legacyIncludedTaskIds))
    throw new Error("recovery included-task history is missing");
  const recoveryTaskIds = recovery.legacyIncludedTaskIds
    .map((taskId, index) =>
      string(taskId, `recovery legacyIncludedTaskIds[${index}]`),
    )
    .sort();
  if (new Set(recoveryTaskIds).size !== recoveryTaskIds.length)
    throw new Error("recovery included-task history has duplicates");
  if (
    recovery.previousStatus !== "passed" ||
    recovery.previousReviewVerdict !== "pass"
  )
    throw new Error("recovery does not preserve contradictory pass history");
  if (
    gitSha(
      recovery.legacyIntegrationHeadSha,
      "recovery legacyIntegrationHeadSha",
    ) !== repairBaseSha
  )
    throw new Error("recovery integration head mismatch");
  if (
    realpathSync(string(recovery.legacyWorktree, "recovery legacyWorktree")) !==
    workdir
  )
    throw new Error("recovery worktree mismatch");
  const auditEvents = readFileSync(input.auditPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line, index) =>
      record(JSON.parse(line), `recovery audit line ${index + 1}`),
    );
  const hasMatchingAudit = auditEvents.some(
    (event) =>
      event.schemaVersion === "maestro-brain-integration-recovery-audit/v1" &&
      event.action === "recover-legacy-integration" &&
      event.at === recoveryAt &&
      event.baseSha === legacyBaseHeadSha &&
      event.headSha === repairBaseSha &&
      JSON.stringify(event.legacyIncludedTaskIds) ===
        JSON.stringify(recoveryTaskIds) &&
      event.previousReviewVerdict === recovery.previousReviewVerdict &&
      event.previousStatus === recovery.previousStatus &&
      event.reason === recoveryReason &&
      event.sourceRunStatus === "failed" &&
      event.sourceReviewRun === sourceReviewRun &&
      event.tranche === input.tranche,
  );
  if (!hasMatchingAudit) throw new Error("no matching recovery audit event");

  const remaining = Array.isArray(result.remainingFindings)
    ? result.remainingFindings.map((item, index) =>
        record(item, `remainingFindings[${index}]`),
      )
    : [];
  if (
    remaining.some((finding) =>
      /^(?:critical|high|no-merge)$/i.test(String(finding.severity ?? "")),
    )
  )
    throw new Error("critical/high findings remain");
  const resolved = new Set(
    (Array.isArray(result.resolvedFindings) ? result.resolvedFindings : []).map(
      (item, index) =>
        string(record(item, `resolvedFindings[${index}]`).id, "finding id"),
    ),
  );
  for (const id of recoveryRequiredFindingIds)
    if (!resolved.has(id)) throw new Error(`missing resolved finding ${id}`);

  const included = Array.isArray(result.includedTasks)
    ? result.includedTasks
    : [];
  if (included.length === 0) throw new Error("no included tasks");
  const seenTasks = new Set<string>();
  for (const [index, value] of included.entries()) {
    const task = record(value, `includedTasks[${index}]`);
    const taskId = string(task.taskId, "taskId");
    const laneHeadSha = gitSha(task.laneHeadSha, `${taskId} laneHeadSha`);
    if (seenTasks.has(taskId))
      throw new Error(`duplicate included task ${taskId}`);
    seenTasks.add(taskId);
    const laneDirectory = resolve(
      input.evidenceDirectory,
      "lane-results",
      taskId,
    );
    for (const name of [
      "ci-proof-packet.json",
      "lane-gate-report.json",
      "lane-result.json",
    ])
      if (!existsSync(resolve(laneDirectory, name)))
        throw new Error(`${taskId}: missing ${name}`);
    const proof = readJson(resolve(laneDirectory, "ci-proof-packet.json"));
    const gate = readJson(resolve(laneDirectory, "lane-gate-report.json"));
    const lane = readJson(resolve(laneDirectory, "lane-result.json"));
    if (
      gitSha(proof.headSha, `${taskId} proof headSha`) !== laneHeadSha ||
      gitSha(gate.headSha, `${taskId} gate headSha`) !== laneHeadSha ||
      gitSha(lane.headSha, `${taskId} lane headSha`) !== laneHeadSha
    )
      throw new Error(`${taskId}: lane proof/head mismatch`);
    if (gate.status !== "passed")
      throw new Error(`${taskId}: lane gate is not passed`);
  }
  if (JSON.stringify([...seenTasks].sort()) !== JSON.stringify(recoveryTaskIds))
    throw new Error("included tasks do not match recovery history");

  const commits = git(workdir, [
    "rev-list",
    "--reverse",
    `${repairBaseSha}..${headSha}`,
  ])
    .split("\n")
    .filter(Boolean);
  for (const commit of commits) {
    gitSha(commit, "repair commit");
    const numstat = git(workdir, ["show", "--numstat", "--format=", commit]);
    const lines = changedHandAuthoredSourceLines(numstat);
    if (lines > 300)
      throw new Error(`${commit}: repair slice changes ${lines} source lines`);
  }

  if (input.stage === "review") {
    if (result.status !== "ready_for_review")
      throw new Error("review result is not ready_for_review");
    return;
  }
  if (result.status !== "passed")
    throw new Error("record result is not passed");
  const broadGate = record(result.broadGate, "broadGate");
  if (
    broadGate.status !== "passed" ||
    gitSha(broadGate.headSha, "broad gate headSha") !== headSha
  )
    throw new Error("broad gate receipt does not prove this head");
  for (const taskId of seenTasks) {
    const lane = readJson(
      resolve(
        input.evidenceDirectory,
        "lane-results",
        taskId,
        "lane-result.json",
      ),
    );
    if (!new Set(["integrated", "accepted"]).has(String(lane.status)))
      throw new Error(`${taskId}: lane result not integrated`);
    if (
      gitSha(lane.integrationHeadSha, `${taskId} integrationHeadSha`) !==
      headSha
    )
      throw new Error(`${taskId}: integration head mismatch`);
  }
};

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1]?.endsWith("repair-result-check.mts")) {
  const workdir = valueAfter("--workdir");
  const evidence = valueAfter("--evidence");
  const auditPath = valueAfter("--audit");
  const tranche = valueAfter("--tranche");
  const baseSha = valueAfter("--base");
  const sourceReviewRun = valueAfter("--source-run");
  const stage = valueAfter("--stage");
  if (
    !workdir ||
    !evidence ||
    !auditPath ||
    !tranche ||
    !baseSha ||
    !sourceReviewRun ||
    !new Set(["review", "record"]).has(stage ?? "")
  )
    throw new Error(
      "usage: repair-result-check --workdir ... --evidence ... --audit ... --tranche ... --base ... --source-run ... --stage review|record",
    );
  validateRepairResult({
    auditPath,
    baseSha,
    evidenceDirectory: evidence,
    expectedWorkdir: workdir,
    sourceReviewRun,
    stage: stage as "review" | "record",
    tranche,
  });
  console.log(`${tranche}: repaired integration ${stage} check passed`);
}
