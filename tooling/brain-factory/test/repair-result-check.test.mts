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

const findingIds = [
  "api-key-server-derived-scope",
  "eval-external-run-artifacts",
  "eval-mechanical-answer-scoring",
  "export-lifecycle-fencing",
  "llm-exact-provider-request",
  "model-receipt-tenant-lifecycle",
  "provider-server-client-boundary",
  "workspace-explicit-fake-mode",
];

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
  writeJson(resultPath, {
    schemaVersion: "maestro-brain-integration-result/v1",
    tranche: "C1-contract-spine",
    status: "ready_for_review",
    reviewVerdict: "pass",
    integrationWorkdir: realpathSync(workdir),
    headSha,
    includedTasks: [{ taskId: "S01-T01", laneHeadSha }],
    remainingFindings: [],
    resolvedFindings: findingIds.map((id) => ({ id })),
  });
  return { baseSha, evidence, resultPath, workdir };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

describe("Brain repair result check", () => {
  it("accepts a clean reviewed head with resolved findings and lane proof", () => {
    const value = fixture();
    expect(() =>
      validateRepairResult({
        baseSha: value.baseSha,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        stage: "review",
        tranche: "C1-contract-spine",
      }),
    ).not.toThrow();
  });

  it("rejects a mutable pass claim with a remaining high finding", () => {
    const value = fixture();
    const result = JSON.parse(readFileSync(value.resultPath, "utf8")) as Record<
      string,
      unknown
    >;
    result.remainingFindings = [{ id: "still-open", severity: "high" }];
    writeJson(value.resultPath, result);
    expect(() =>
      validateRepairResult({
        baseSha: value.baseSha,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        stage: "review",
        tranche: "C1-contract-spine",
      }),
    ).toThrow(/findings remain/);
  });

  it("uses evidence-owned required finding IDs for non-C1 repairs", () => {
    const value = fixture();
    const result = JSON.parse(readFileSync(value.resultPath, "utf8")) as Record<
      string,
      unknown
    >;
    result.requiredFindingIds = ["legacy-integration-run-failed"];
    result.resolvedFindings = [{ id: "legacy-integration-run-failed" }];
    writeJson(value.resultPath, result);
    expect(() =>
      validateRepairResult({
        baseSha: value.baseSha,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        stage: "review",
        tranche: "C1-contract-spine",
      }),
    ).not.toThrow();
  });
});
