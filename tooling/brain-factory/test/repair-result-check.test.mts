import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateRepairResult } from "../src/repair-result-check.mjs";

const recoveryFindingId = "legacy-integration-run-failed";
const sourceReviewRun = "01KXHDXG8A8751TZ3HY4CQJKBD";

const temporaryDirectories: string[] = [];

const command = (directory: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();

const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const fixture = () => {
  const root = mkdtempSync(resolve(tmpdir(), "brain-repair-check-"));
  temporaryDirectories.push(root);
  const workdir = resolve(root, "integration");
  const evidence = resolve(root, "evidence");
  mkdirSync(workdir);
  command(workdir, "init", "-q");
  command(workdir, "config", "user.email", "brain@example.test");
  command(workdir, "config", "user.name", "Brain Test");
  writeFileSync(resolve(workdir, "source.ts"), "export const base = true;\n");
  command(workdir, "add", "source.ts");
  command(workdir, "commit", "-qm", "test: add base");
  const baseSha = command(workdir, "rev-parse", "HEAD");
  writeFileSync(
    resolve(workdir, "source.ts"),
    "export const base = true;\nexport const repair = true;\n",
  );
  command(workdir, "add", "source.ts");
  command(workdir, "commit", "-qm", "fix: add repair");
  const headSha = command(workdir, "rev-parse", "HEAD");
  const laneHeadSha = "a".repeat(40);
  const laneDirectory = resolve(evidence, "lane-results", "S01-T01");
  const integrationDirectory = resolve(
    evidence,
    "integration",
    "C1-contract-spine",
  );
  mkdirSync(laneDirectory, { recursive: true });
  mkdirSync(integrationDirectory, { recursive: true });
  writeJson(resolve(laneDirectory, "ci-proof-packet.json"), {
    headSha: laneHeadSha,
  });
  writeJson(resolve(laneDirectory, "lane-gate-report.json"), {
    headSha: laneHeadSha,
    status: "passed",
  });
  writeJson(resolve(laneDirectory, "lane-result.json"), {
    headSha: laneHeadSha,
    status: "lane_green",
  });
  const resultPath = resolve(integrationDirectory, "integration-result.json");
  const auditPath = resolve(evidence, "recovery-audit.jsonl");
  const recovery = {
    at: "2026-07-15T00:00:00.000Z",
    legacyBaseHeadSha: baseSha,
    legacyIncludedTaskIds: ["S01-T01"],
    legacyIntegrationHeadSha: baseSha,
    legacyWorktree: realpathSync(workdir),
    previousReviewVerdict: "pass",
    previousStatus: "passed",
    reason: "legacy run failed its full gate",
    schemaVersion: "maestro-brain-integration-recovery/v1",
    sourceRunStatus: "failed",
    sourceReviewRun,
  };
  writeFileSync(
    auditPath,
    `${JSON.stringify({
      action: "recover-legacy-integration",
      at: recovery.at,
      baseSha,
      headSha: baseSha,
      legacyIncludedTaskIds: ["S01-T01"],
      previousReviewVerdict: "pass",
      previousStatus: "passed",
      reason: recovery.reason,
      schemaVersion: "maestro-brain-integration-recovery-audit/v1",
      sourceRunStatus: "failed",
      sourceReviewRun,
      tranche: "C1-contract-spine",
    })}\n`,
  );
  writeJson(resultPath, {
    schemaVersion: "maestro-brain-integration-result/v1",
    baseSha,
    integrationId: "C1-contract-spine",
    manifestTranche: "C1-contract-spine",
    tranche: "C1-contract-spine",
    status: "ready_for_review",
    reviewVerdict: "pass",
    integrationWorkdir: realpathSync(workdir),
    headSha,
    includedTasks: [{ taskId: "S01-T01", laneHeadSha }],
    remainingFindings: [],
    resolvedFindings: [{ id: recoveryFindingId }],
    recovery,
    sourceRunStatus: "failed",
    sourceReviewRun,
  });
  return { auditPath, baseSha, evidence, resultPath, workdir };
};

const validate = (
  value: ReturnType<typeof fixture>,
  overrides: Partial<Parameters<typeof validateRepairResult>[0]> = {},
): void =>
  validateRepairResult({
    auditPath: value.auditPath,
    baseSha: value.baseSha,
    evidenceDirectory: value.evidence,
    expectedWorkdir: value.workdir,
    sourceReviewRun,
    stage: "review",
    tranche: "C1-contract-spine",
    ...overrides,
  });

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

describe("Brain repair result check", () => {
  it("accepts a clean reviewed head with resolved findings and lane proof", () => {
    const value = fixture();
    expect(() => validate(value)).not.toThrow();
  });

  it("rejects a mutable pass claim with a remaining high finding", () => {
    const value = fixture();
    const result = JSON.parse(readFileSync(value.resultPath, "utf8")) as Record<
      string,
      unknown
    >;
    result.remainingFindings = [{ id: "still-open", severity: "high" }];
    writeJson(value.resultPath, result);
    expect(() => validate(value)).toThrow(/findings remain/);
  });

  it("uses verifier-owned recovery findings despite mutable result claims", () => {
    const value = fixture();
    const result = JSON.parse(readFileSync(value.resultPath, "utf8")) as Record<
      string,
      unknown
    >;
    result.requiredFindingIds = ["attacker-chosen-finding"];
    result.resolvedFindings = [{ id: "attacker-chosen-finding" }];
    writeJson(value.resultPath, result);
    expect(() => validate(value)).toThrow(
      `missing resolved finding ${recoveryFindingId}`,
    );
  });

  it("requires exact failed-run provenance and matching recovery audit", () => {
    const value = fixture();
    const result = JSON.parse(readFileSync(value.resultPath, "utf8")) as Record<
      string,
      unknown
    >;
    result.sourceRunStatus = "passed";
    writeJson(value.resultPath, result);
    expect(() => validate(value)).toThrow("source run status is not failed");

    result.sourceRunStatus = "failed";
    result.sourceReviewRun = "01KXHE00000000000000000000";
    writeJson(value.resultPath, result);
    expect(() => validate(value)).toThrow("source review run mismatch");

    result.sourceReviewRun = sourceReviewRun;
    result.baseSha = "f".repeat(40);
    writeJson(value.resultPath, result);
    expect(() => validate(value)).toThrow("recovery base history mismatch");

    result.baseSha = value.baseSha;
    writeJson(value.resultPath, result);
    writeFileSync(value.auditPath, `${JSON.stringify({ action: "other" })}\n`);
    expect(() => validate(value)).toThrow("matching recovery audit event");
  });

  it("cannot bypass recovery provenance by deleting mutable result history", () => {
    const value = fixture();
    const result = JSON.parse(readFileSync(value.resultPath, "utf8")) as Record<
      string,
      unknown
    >;
    delete result.recovery;
    delete result.sourceRunStatus;
    delete result.sourceReviewRun;
    writeJson(value.resultPath, result);
    expect(() => validate(value)).toThrow("source run status is not failed");
  });
});
