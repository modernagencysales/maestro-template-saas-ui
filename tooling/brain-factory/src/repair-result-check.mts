import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { changedHandAuthoredSourceLines } from "./source-budget.js";

type JsonRecord = Record<string, unknown>;

const legacyRequiredFindingIds = new Set([
  "api-key-server-derived-scope",
  "eval-external-run-artifacts",
  "eval-mechanical-answer-scoring",
  "export-lifecycle-fencing",
  "llm-exact-provider-request",
  "model-receipt-tenant-lifecycle",
  "provider-server-client-boundary",
  "workspace-explicit-fake-mode",
]);

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
  readonly baseSha: string;
  readonly evidenceDirectory: string;
  readonly expectedWorkdir: string;
  readonly stage: "record" | "review";
  readonly tranche: string;
}

export const validateRepairResult = (input: RepairCheckInput): void => {
  if (
    !isAbsolute(input.expectedWorkdir) ||
    !isAbsolute(input.evidenceDirectory)
  )
    throw new Error("workdir and evidence directory must be absolute");
  const workdir = realpathSync(input.expectedWorkdir);
  const resultPath = resolve(
    input.evidenceDirectory,
    "integration",
    input.tranche,
    "integration-result.json",
  );
  const result = readJson(resultPath);
  const headSha = git(workdir, ["rev-parse", "HEAD"]);
  if (
    string(result.schemaVersion, "schemaVersion") !==
    "maestro-brain-integration-result/v1"
  )
    throw new Error("unexpected integration result schema");
  if (string(result.tranche, "tranche") !== input.tranche)
    throw new Error("tranche mismatch");
  if (
    realpathSync(string(result.integrationWorkdir, "integrationWorkdir")) !==
    workdir
  )
    throw new Error("integration workdir mismatch");
  if (string(result.headSha, "headSha") !== headSha)
    throw new Error("evidence head does not match HEAD");
  if (result.reviewVerdict !== "pass")
    throw new Error("review verdict is not pass");
  if (git(workdir, ["status", "--porcelain"]) !== "")
    throw new Error("integration worktree is not clean");
  git(workdir, ["merge-base", "--is-ancestor", input.baseSha, headSha]);

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
  const requiredFindingIds = Array.isArray(result.requiredFindingIds)
    ? new Set(
        result.requiredFindingIds.map((value, index) =>
          string(value, `requiredFindingIds[${index}]`),
        ),
      )
    : legacyRequiredFindingIds;
  const resolved = new Set(
    (Array.isArray(result.resolvedFindings) ? result.resolvedFindings : []).map(
      (item, index) =>
        string(record(item, `resolvedFindings[${index}]`).id, "finding id"),
    ),
  );
  for (const id of requiredFindingIds)
    if (!resolved.has(id)) throw new Error(`missing resolved finding ${id}`);

  const included = Array.isArray(result.includedTasks)
    ? result.includedTasks
    : [];
  if (included.length === 0) throw new Error("no included tasks");
  const seenTasks = new Set<string>();
  for (const [index, value] of included.entries()) {
    const task = record(value, `includedTasks[${index}]`);
    const taskId = string(task.taskId, "taskId");
    const laneHeadSha = string(task.laneHeadSha, `${taskId} laneHeadSha`);
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
      proof.headSha !== laneHeadSha ||
      gate.headSha !== laneHeadSha ||
      lane.headSha !== laneHeadSha
    )
      throw new Error(`${taskId}: lane proof/head mismatch`);
    if (gate.status !== "passed")
      throw new Error(`${taskId}: lane gate is not passed`);
  }

  const commits = git(workdir, [
    "rev-list",
    "--reverse",
    `${input.baseSha}..${headSha}`,
  ])
    .split("\n")
    .filter(Boolean);
  for (const commit of commits) {
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
  if (broadGate.status !== "passed" || broadGate.headSha !== headSha)
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
    if (lane.integrationHeadSha !== headSha)
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
  const tranche = valueAfter("--tranche");
  const baseSha = valueAfter("--base");
  const stage = valueAfter("--stage");
  if (
    !workdir ||
    !evidence ||
    !tranche ||
    !baseSha ||
    !new Set(["review", "record"]).has(stage ?? "")
  )
    throw new Error(
      "usage: repair-result-check --workdir ... --evidence ... --tranche ... --base ... --stage review|record",
    );
  validateRepairResult({
    baseSha,
    evidenceDirectory: evidence,
    expectedWorkdir: workdir,
    stage: stage as "review" | "record",
    tranche,
  });
  console.log(`${tranche}: repaired integration ${stage} check passed`);
}
