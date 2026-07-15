import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  integrationWaveId,
  planIntegrationWave,
  validateIntegrationWaveSelection,
  type IntegrationWaveCandidate,
} from "../src/integration-wave.js";
import type { BrainTaskContract } from "../src/manifest.js";
import {
  materializeImmutableWaveSelection,
  promotionAction,
  replaceWaveRunRecord,
  verifyPassedWaveRunInspection,
  verifyWaveRunInspection,
  waveModeForWorktree,
  waveWorktreeRecoveryAction,
} from "../src/integration-wave-launch.js";

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

  it("fails closed on control divergence and recovers a post-merge crash", () => {
    expect(promotionAction("base", "base", "head")).toBe("fast-forward");
    expect(promotionAction("head", "base", "head")).toBe("record-after-crash");
    expect(() => promotionAction("other", "base", "head")).toThrow(
      "rebuild the wave and rerun full verify",
    );
    expect(waveModeForWorktree("base", "base")).toBe("integrate");
    expect(waveModeForWorktree("base", "partial")).toBe("recover");
    expect(
      waveWorktreeRecoveryAction({
        branchExists: false,
        worktreeExists: false,
      }),
    ).toBe("create-branch");
    expect(
      waveWorktreeRecoveryAction({ branchExists: true, worktreeExists: false }),
    ).toBe("attach-branch");
    expect(
      waveWorktreeRecoveryAction({ branchExists: true, worktreeExists: true }),
    ).toBe("reuse");
  });

  it("atomically replaces only the exact durable run record", () => {
    const root = mkdtempSync(resolve(tmpdir(), "brain-wave-record-"));
    const path = resolve(root, "run.json");
    const current = '{"status":"preparing"}\n';
    writeFileSync(path, current);
    replaceWaveRunRecord(path, current, { status: "launched" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      status: "launched",
    });
    expect(() =>
      replaceWaveRunRecord(path, current, { status: "drifted" }),
    ).toThrow("wave run record changed");
    const selectionPath = resolve(root, "selection.json");
    materializeImmutableWaveSelection(selectionPath, { exact: true });
    materializeImmutableWaveSelection(selectionPath, { exact: true });
    expect(() =>
      materializeImmutableWaveSelection(selectionPath, { exact: false }),
    ).toThrow("conflicts with reservation");
    rmSync(root, { recursive: true });
  });

  it("binds recovery to exact Fabro labels and inputs", () => {
    const identity = {
      attempt: 2,
      baseSha: "a".repeat(40),
      integrationId: "wave-000001",
      mode: "recover" as const,
      reservationToken: "123e4567-e89b-42d3-a456-426614174000",
      runId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      selectionPath: "/tmp/wave-selection.json",
      selectionSha256: "b".repeat(64),
      workdir: "/tmp/wave-workdir",
    };
    const inspection = {
      run_id: identity.runId,
      run_spec: {
        settings: {
          run: {
            inputs: {
              attempt: identity.attempt,
              base_sha: identity.baseSha,
              integration_id: identity.integrationId,
              mode: identity.mode,
              reservation_token: identity.reservationToken,
              selection_path: identity.selectionPath,
              selection_sha256: identity.selectionSha256,
              workdir: identity.workdir,
            },
            metadata: {
              attempt: identity.attempt,
              integration: identity.integrationId,
              "integration-mode": "wave-v2",
              reservation: identity.reservationToken,
            },
          },
        },
      },
    };
    expect(() => verifyWaveRunInspection(inspection, identity)).not.toThrow();
    expect(() =>
      verifyPassedWaveRunInspection(
        { ...inspection, status: { kind: "failed" } },
        identity,
      ),
    ).toThrow("is not succeeded");
    expect(() =>
      verifyPassedWaveRunInspection(
        { ...inspection, status: { kind: "succeeded" } },
        identity,
      ),
    ).not.toThrow();
    expect(() =>
      verifyWaveRunInspection(
        {
          ...inspection,
          run_spec: {
            settings: {
              run: {
                ...inspection.run_spec.settings.run,
                inputs: {
                  ...inspection.run_spec.settings.run.inputs,
                  selection_sha256: "c".repeat(64),
                },
              },
            },
          },
        },
        identity,
      ),
    ).toThrow("identity mismatch");
  });
});
