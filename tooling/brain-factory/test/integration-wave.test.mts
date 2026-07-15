import { describe, expect, it } from "vitest";

import {
  integrationWaveId,
  planIntegrationWave,
  validateIntegrationWaveSelection,
  type IntegrationWaveCandidate,
} from "../src/integration-wave.js";
import type { BrainTaskContract } from "../src/manifest.js";

const task = (
  taskId: string,
  tranche: string,
  codeStartAfter: readonly string[] = [],
  fileLocks: readonly string[] = [`${taskId}.ts`],
): BrainTaskContract => ({
  acceptanceAfter: "none",
  classification: "pattern-instance",
  codeStartAfter,
  estimatedSourceLines: 100,
  fileInventoryIssues: [],
  fileInventoryStatus: "ready",
  fileLocks,
  gateProfiles: ["tooling"],
  kind: "product",
  lane: "test",
  requirements: [],
  sourceSliceBudget: 300,
  taskBlockHash: `${taskId}-block`,
  taskId,
  title: taskId,
  tranche,
});

const candidate = (value: BrainTaskContract): IntegrationWaveCandidate => ({
  changedFiles: [value.fileLocks[0] ?? `${value.taskId}.ts`],
  gateHeadSha: `${value.taskId}-head`,
  gateSha256: `${value.taskId}-gate`,
  headSha: `${value.taskId}-head`,
  laneResultSha256: `${value.taskId}-lane`,
  planSha256: "plan",
  proofHeadSha: `${value.taskId}-head`,
  proofSha256: `${value.taskId}-proof`,
  taskBlockHash: value.taskBlockHash,
  taskId: value.taskId,
  tranche: value.tranche,
});

describe("integration wave planner", () => {
  it("selects independent mixed-tranche tasks and binds an immutable hash", () => {
    const tasks = [
      task("S01-T03", "D2-domain-bodies", ["S01-T02"]),
      task("S04-T01", "C1-contract-spine", ["S01-T02"]),
    ];
    const selection = planIntegrationWave({
      baseSha: "base",
      candidates: tasks.map(candidate),
      completedTaskIds: new Set(["S01-T02"]),
      integrationId: integrationWaveId(1),
      planSha256: "plan",
      tasks,
    });
    expect(selection.selectedTasks.map((value) => value.taskId)).toEqual([
      "S01-T03",
      "S04-T01",
    ]);
    expect(selection.selectionSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(() => validateIntegrationWaveSelection(selection)).not.toThrow();
    expect(() =>
      validateIntegrationWaveSelection({
        ...selection,
        baseSha: "drifted",
      }),
    ).toThrow("selection hash mismatch");
  });

  it("forbids dependencies that are absent from the exact base", () => {
    const parent = task("S01-T02", "C1-contract-spine");
    const child = task("S01-T03", "D2-domain-bodies", [parent.taskId]);
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [candidate(child)],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(2),
        planSha256: "plan",
        tasks: [parent, child],
      }),
    ).toThrow("absent from the exact base");
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [candidate(parent), candidate(child)],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(2),
        planSha256: "plan",
        tasks: [parent, child],
      }),
    ).toThrow("same-wave dependency");
  });

  it("chooses the maximum deterministic conflict-free task set", () => {
    const tasks = [
      task("S01-T03", "D2-domain-bodies", [], ["shared.ts"]),
      task("S01-T04", "D2-domain-bodies", [], ["shared.ts", "extra.ts"]),
      task("S04-T01", "C1-contract-spine", [], ["slack.ts"]),
    ];
    const selection = planIntegrationWave({
      baseSha: "base",
      candidates: tasks.map(candidate),
      completedTaskIds: new Set(),
      integrationId: integrationWaveId(3),
      planSha256: "plan",
      tasks,
    });
    expect(selection.selectedTasks.map((value) => value.taskId)).toEqual([
      "S01-T03",
      "S04-T01",
    ]);
    expect(selection.deferredTaskIds).toEqual(["S01-T04"]);
  });

  it("rejects task identity and proof drift", () => {
    const value = task("S01-T03", "D2-domain-bodies");
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [{ ...candidate(value), tranche: "C1-contract-spine" }],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(4),
        planSha256: "plan",
        tasks: [value],
      }),
    ).toThrow("tranche mismatch");
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [{ ...candidate(value), gateHeadSha: "other" }],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(4),
        planSha256: "plan",
        tasks: [value],
      }),
    ).toThrow("proof/gate head mismatch");
  });
});
