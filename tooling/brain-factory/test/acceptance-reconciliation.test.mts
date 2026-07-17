import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  acceptancePrerequisiteIds,
  planAcceptanceReceipt,
  reconcileAcceptanceEvidence,
} from "../src/acceptance-reconciliation.js";
import type { BrainTaskContract, BrainTaskManifest } from "../src/manifest.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const task = (
  taskId: string,
  acceptanceAfter: string,
  kind: BrainTaskContract["kind"] = "product",
): BrainTaskContract => ({
  acceptanceAfter,
  classification: "template-gap",
  codeStartAfter: [],
  estimatedSourceLines: 1,
  fileInventoryIssues: [],
  fileInventoryStatus: "ready",
  fileLocks: [`${taskId}.ts`],
  gateProfiles: ["tooling"],
  kind,
  lane: "test",
  requirements: [],
  sourceSliceBudget: 300,
  taskBlockHash: "a".repeat(64),
  taskId,
  title: taskId,
  tranche: "test",
});

const manifest = (tasks: readonly BrainTaskContract[]): BrainTaskManifest => ({
  planPath: "plan.md",
  planSha256: "b".repeat(64),
  schemaVersion: "maestro-brain-task-manifest/v1",
  tasks,
});

const requiredTask = (
  value: BrainTaskContract | undefined,
): BrainTaskContract => {
  if (!value) throw new Error("test task is missing");
  return value;
};

const anchor = (taskId: string) => ({
  archiveContentSha256: "c".repeat(64),
  archivedLaneResultSha256: "d".repeat(64),
  evidenceContentSha256: "c".repeat(64),
  evidenceKind: "integration-archive" as const,
  integrationHeadSha: "1".repeat(40),
  integrationId: "wave-000001",
  laneHeadSha: "2".repeat(40),
  taskId,
});

describe("acceptance reconciliation", () => {
  it("keeps the Fabro workflow deterministic and host-slotted", () => {
    const workflow = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-reconcile-acceptance/workflow.fabro",
      ),
      "utf8",
    );
    expect(workflow).toContain("integration-broad-gate.mts");
    expect(workflow).toContain("reconcile-acceptance.mts");
    expect(workflow).toContain("--integration-id acceptance-program");
    expect(workflow).not.toContain('prompt="');
  });

  it("expands task, stage, complete, and all-prior prerequisites", () => {
    const tasks = [
      task("S00-T01", "none", "external"),
      task("S00-T02", "S00-T01"),
      task("S01-T01", "S00 complete"),
      task("S02-T01", "S00, S01"),
      task("S03-T01", "all prior tasks"),
    ];
    expect(acceptancePrerequisiteIds(requiredTask(tasks[1]), tasks)).toEqual([
      "S00-T01",
    ]);
    expect(acceptancePrerequisiteIds(requiredTask(tasks[2]), tasks)).toEqual([
      "S00-T01",
      "S00-T02",
    ]);
    expect(acceptancePrerequisiteIds(requiredTask(tasks[3]), tasks)).toEqual([
      "S00-T01",
      "S00-T02",
      "S01-T01",
    ]);
    expect(acceptancePrerequisiteIds(requiredTask(tasks[4]), tasks)).toEqual([
      "S00-T01",
      "S00-T02",
      "S01-T01",
      "S02-T01",
    ]);
  });

  it("accepts the complete prerequisite closure but not orphaned tasks", () => {
    const tasks = [
      task("S00-T01", "none", "external"),
      task("S00-T02", "S00-T01"),
      task("S01-T01", "S00 complete"),
      task("S02-T01", "S01 complete"),
    ];
    const anchors = new Map([
      ["S00-T01", anchor("S00-T01")],
      ["S00-T02", anchor("S00-T02")],
      ["S02-T01", anchor("S02-T01")],
    ]);
    const receipt = planAcceptanceReceipt({
      anchors,
      broadGateReceiptSha256: "e".repeat(64),
      controlHead: "f".repeat(40),
      manifest: manifest(tasks),
    });
    expect(receipt.acceptedTasks.map(({ taskId }) => taskId)).toEqual([
      "S00-T01",
      "S00-T02",
    ]);
  });

  it("writes one replay-safe content-addressed receipt bound to archive and gate", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-acceptance-"));
    roots.push(root);
    const evidence = resolve(root, "evidence");
    const integrationId = "wave-000001";
    const taskId = "S00-T02";
    const laneHeadSha = "2".repeat(40);
    const integrationHeadSha = "1".repeat(40);
    const laneResult = {
      acceptanceBlocker: "awaiting original acceptance prerequisites",
      accepted: false,
      headSha: laneHeadSha,
      integrationHeadSha,
      integrationId,
      schemaVersion: "maestro-brain-lane-result/v1",
      status: "integrated",
      taskId,
    };
    const integrationBroadGate = {
      command: "rtk host-test-slot --class full pnpm verify",
      headSha: integrationHeadSha,
      status: "passed",
    };
    const archive = {
      integrationId,
      integrationResult: {
        broadGate: integrationBroadGate,
        headSha: integrationHeadSha,
        integrationId,
        planSha256: "b".repeat(64),
        remainingFindings: [],
        reviewVerdict: "pass",
        selectedTasks: [{ taskBlockHash: "a".repeat(64), taskId }],
        status: "passed",
      },
      laneEvidence: [{ result: laneResult, taskId }],
      schemaVersion: "maestro-brain-evidence-archive/v1",
    };
    const archiveContent = `${JSON.stringify(archive, null, 2)}\n`;
    const archiveHash = hash(archiveContent);
    const archiveDirectory = resolve(evidence, "archive", integrationId);
    const laneDirectory = resolve(evidence, "lane-results", taskId);
    mkdirSync(archiveDirectory, { recursive: true });
    mkdirSync(laneDirectory, { recursive: true });
    writeFileSync(
      resolve(archiveDirectory, `${archiveHash}.json`),
      archiveContent,
    );
    writeFileSync(
      resolve(archiveDirectory, "archive-manifest.json"),
      `${JSON.stringify(
        {
          artifactFile: `${archiveHash}.json`,
          contentSha256: archiveHash,
          integrationId,
          schemaVersion: "maestro-brain-evidence-archive-manifest/v1",
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      resolve(laneDirectory, "lane-result.json"),
      `${JSON.stringify(laneResult, null, 2)}\n`,
    );
    const broadGate = {
      attempts: [
        {
          attempt: 1,
          command: "rtk host-test-slot --class full pnpm verify",
          headSha: integrationHeadSha,
          outputSha256: "9".repeat(64),
          status: "passed",
          transientVitestWorkerRpcTimeout: false,
        },
      ],
      command: "rtk host-test-slot --class full pnpm verify",
      headSha: integrationHeadSha,
      schemaVersion: "maestro-brain-broad-gate-receipt/v1",
      status: "passed",
    };
    const broadGatePath = resolve(root, "broad-gate.json");
    writeFileSync(broadGatePath, `${JSON.stringify(broadGate, null, 2)}\n`);
    const value = {
      broadGatePath,
      controlHead: integrationHeadSha,
      evidenceDirectory: evidence,
      isAncestor: () => true,
      manifest: manifest([task(taskId, "none")]),
    };
    const first = reconcileAcceptanceEvidence(value);
    const replay = reconcileAcceptanceEvidence(value);
    expect(replay).toEqual(first);
    expect(first.path).toContain(first.contentSha256);
    const receipt = JSON.parse(readFileSync(first.path, "utf8"));
    expect(receipt.acceptedTasks[0]).toMatchObject({
      archiveContentSha256: archiveHash,
      evidenceKind: "integration-archive",
      integrationHeadSha,
      taskId,
    });

    const staleTask = {
      ...task(taskId, "none"),
      taskBlockHash: "8".repeat(64),
    };
    expect(() =>
      reconcileAcceptanceEvidence({
        ...value,
        manifest: manifest([staleTask]),
      }),
    ).toThrow("archived task contract is stale");

    writeFileSync(
      resolve(archiveDirectory, `${archiveHash}.json`),
      `${archiveContent} `,
    );
    expect(() => reconcileAcceptanceEvidence(value)).toThrow(
      "archive artifact hash mismatch",
    );
  });
});
