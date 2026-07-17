import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  integrationWaveId,
  laneTrancheMatchesManifest,
  planIntegrationWave,
  validateIntegrationWaveSelection,
  type IntegrationWaveCandidate,
} from "../src/integration-wave.js";
import {
  integrationTasksForRequest,
  parseIntegrationWaveRequest,
  previewOrLaunchIntegrationWave,
  requireRequestedCandidates,
} from "../src/integration-wave-request.js";
import type { BrainTaskContract } from "../src/manifest.js";
import {
  buildIntegrationWaveSupersessionReceipt,
  materializeImmutableWaveSupersession,
  nextIntegrationWaveId,
  priorIntegrationWaveResolution,
  validateIntegrationWaveSupersessionReceipt,
} from "../src/integration-wave-supersession.js";
import {
  materializeImmutableWaveSelection,
  promotionAction,
  replaceWaveRunRecord,
  verifyPassedWaveRunInspection,
  verifyWaveRunInspection,
  waveModeForWorktree,
  waveWorktreeRecoveryAction,
} from "../src/integration-wave-launch.js";
import { taskIsAvailableIntegrationCandidate } from "../src/dispatch-ownership.js";

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

const supersessionFixture = (
  statuses: readonly ("cancelled" | "failed" | "running" | "succeeded")[] = [
    "failed",
    "cancelled",
  ],
) => {
  const root = mkdtempSync(resolve(tmpdir(), "brain-wave-supersession-"));
  const baseSha = "a".repeat(40);
  const controlHeadSha = "b".repeat(40);
  const planSha256 = "c".repeat(64);
  const integrationId = "wave-000002";
  const selectionPath = resolve(root, "selection.json");
  const workdir = resolve(root, "workdir");
  const value = task("S01-T03", "D2-domain-bodies");
  const selection = planIntegrationWave({
    baseSha,
    candidates: [{ ...candidate(value), planSha256 }],
    completedTaskIds: new Set(),
    integrationId,
    planSha256,
    tasks: [value],
  });
  const selectionContent = `${JSON.stringify(selection, null, 2)}\n`;
  const runIds = [
    "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "01BX5ZZKBKACTAV9WEVGEMMVRZ",
  ].slice(0, statuses.length);
  const reservationToken = "wave-reservation";
  const runRecordContent = `${JSON.stringify(
    {
      attempt: runIds.length,
      baseSha,
      integrationId,
      reservationToken,
      runId: runIds.at(-1),
      runIds,
      schemaVersion: "maestro-brain-integration-wave-run/v2",
      selection,
      selectionPath,
      selectionSha256: selection.selectionSha256,
      status: "launched",
      workdir,
    },
    null,
    2,
  )}\n`;
  const runInspections = runIds.map((runId, index) => ({
    run_id: runId,
    status: { kind: statuses[index] },
    run_spec: {
      settings: {
        run: {
          inputs: {
            attempt: index + 1,
            base_sha: baseSha,
            integration_id: integrationId,
            mode: index === 0 ? "integrate" : "recover",
            reservation_token: reservationToken,
            selection_path: selectionPath,
            selection_sha256: selection.selectionSha256,
            workdir,
          },
          metadata: {
            attempt: index + 1,
            integration: integrationId,
            "integration-mode": "wave-v2",
            reservation: reservationToken,
          },
        },
      },
    },
  }));
  return {
    baseSha,
    controlHeadSha,
    integrationId,
    root,
    runInspections,
    runRecordContent,
    selectionContent,
    selectionPath,
  };
};

describe("integration wave planner", () => {
  it("strictly parses exact requested task filters and rejects unknown input", () => {
    const known = new Set(["S02-T04", "S03-T03"]);
    expect(
      parseIntegrationWaveRequest(
        ["--", "--tasks", "S03-T03,S02-T04", "--preview"],
        known,
      ),
    ).toEqual({
      preview: true,
      requestedTaskIds: ["S02-T04", "S03-T03"],
    });
    expect(() =>
      parseIntegrationWaveRequest(["--task", "S02-T04"], known),
    ).toThrow("unknown integrate-wave argument");
    expect(() =>
      parseIntegrationWaveRequest(["--tasks", "S99-T99"], known),
    ).toThrow("unknown task IDs");
    expect(() =>
      parseIntegrationWaveRequest(["--tasks", "S02-T04,S02-T04"], known),
    ).toThrow("duplicate task IDs");
    expect(() =>
      parseIntegrationWaveRequest(["--tasks", "S02-T04,"], known),
    ).toThrow("exact task IDs");
  });

  it("ignores stale unrequested tasks and rejects missing requested candidates", () => {
    const target = task("S02-T04", "D2-domain-bodies");
    const stale = task("S11-T02", "D2-domain-bodies");
    expect(
      integrationTasksForRequest([target, stale], [target.taskId]).map(
        ({ taskId }) => taskId,
      ),
    ).toEqual(["S02-T04"]);
    expect(() => requireRequestedCandidates([target.taskId], [])).toThrow(
      "not integration-ready",
    );
    expect(() =>
      requireRequestedCandidates([target.taskId], [target.taskId]),
    ).not.toThrow();
    const selection = planIntegrationWave({
      baseSha: "base",
      candidates: [candidate(target)],
      completedTaskIds: new Set(),
      integrationId: integrationWaveId(13),
      planSha256: "plan",
      requestedTaskIds: [target.taskId],
      tasks: [target, stale],
    });
    expect(selection.selectedTasks.map(({ taskId }) => taskId)).toEqual([
      "S02-T04",
    ]);
  });

  it("binds an exact requested filter into deterministic selection v2", () => {
    const tasks = [
      task("S02-T04", "D2-domain-bodies"),
      task("S03-T03", "D2-domain-bodies"),
    ];
    const input = {
      baseSha: "base",
      candidates: [...tasks].reverse().map(candidate),
      completedTaskIds: new Set<string>(),
      integrationId: integrationWaveId(13),
      planSha256: "plan",
      requestedTaskIds: ["S03-T03", "S02-T04"],
      tasks,
    };
    const first = planIntegrationWave(input);
    const second = planIntegrationWave({
      ...input,
      candidates: tasks.map(candidate),
      requestedTaskIds: ["S02-T04", "S03-T03"],
    });
    expect(first).toEqual(second);
    expect(first.requestedTaskIds).toEqual(["S02-T04", "S03-T03"]);
    expect(first.selectedTasks.map(({ taskId }) => taskId)).toEqual([
      "S02-T04",
      "S03-T03",
    ]);
    expect(() => validateIntegrationWaveSelection(first)).not.toThrow();
    const unfiltered = planIntegrationWave({
      ...input,
      requestedTaskIds: [],
    });
    expect(unfiltered.requestedTaskIds).toEqual([]);
    expect(unfiltered.selectedTasks.map(({ taskId }) => taskId)).toEqual([
      "S02-T04",
      "S03-T03",
    ]);
    expect(() =>
      validateIntegrationWaveSelection({
        ...first,
        requestedTaskIds: ["S02-T04"],
      }),
    ).toThrow("selection hash mismatch");
  });

  it("rejects requested proof drift and requested lock conflicts", () => {
    const first = task("S02-T04", "D2-domain-bodies", [], ["shared.ts"]);
    const second = task("S03-T03", "D2-domain-bodies", [], ["shared.ts"]);
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [
          { ...candidate(first), gateHeadSha: "drifted" },
          candidate(second),
        ],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(13),
        planSha256: "plan",
        requestedTaskIds: [first.taskId, second.taskId],
        tasks: [first, second],
      }),
    ).toThrow("proof/gate head mismatch");
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [candidate(first), candidate(second)],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(13),
        planSha256: "plan",
        requestedTaskIds: [first.taskId, second.taskId],
        tasks: [first, second],
      }),
    ).toThrow("not conflict-free");
  });

  it("returns preview without invoking mutation and launches by default", () => {
    const launch = vi.fn(() => ({ launched: true }));
    expect(
      previewOrLaunchIntegrationWave({
        launch,
        preview: true,
        previewValue: { launched: false },
      }),
    ).toEqual({ launched: false });
    expect(launch).not.toHaveBeenCalled();
    expect(
      previewOrLaunchIntegrationWave({
        launch,
        preview: false,
        previewValue: { launched: false },
      }),
    ).toEqual({ launched: true });
    expect(launch).toHaveBeenCalledOnce();
  });

  it("accepts legacy absent lane tranches but rejects contradictory identity", () => {
    expect(laneTrancheMatchesManifest(undefined, "C1-contract-spine")).toBe(
      true,
    );
    expect(
      laneTrancheMatchesManifest("C1-contract-spine", "C1-contract-spine"),
    ).toBe(true);
    expect(laneTrancheMatchesManifest(null, "C1-contract-spine")).toBe(false);
    expect(
      laneTrancheMatchesManifest("D2-domain-bodies", "C1-contract-spine"),
    ).toBe(false);
  });

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

  it("ignores completed legacy records and selects T03 around active T04", () => {
    const s00t02 = task("S00-T02", "C1-contract-spine");
    const s01t03 = task("S01-T03", "D2-domain-bodies");
    const s01t04 = task("S01-T04", "D2-domain-bodies");
    const completedTaskIds = new Set([s00t02.taskId]);
    const reservations = new Map<string, unknown>([
      [s00t02.taskId, { status: "integrated", taskId: s00t02.taskId }],
      [
        s01t04.taskId,
        {
          branch: "fabro/review-s01-t04",
          runId: "01KXKWXJVX88C8HCM9YPP21VZR",
          status: "launched",
          taskId: "S01-T04",
          workdir: "/tmp/resume-s01-t04",
        },
      ],
    ]);
    const candidates = [s00t02, s01t03, s01t04]
      .filter((value) =>
        taskIsAvailableIntegrationCandidate({
          completed: completedTaskIds.has(value.taskId),
          inspect: () => "running",
          reservation: reservations.get(value.taskId),
          taskId: value.taskId,
        }),
      )
      .map(candidate);
    expect(candidates.map((value) => value.taskId)).toEqual(["S01-T03"]);
    expect(() =>
      taskIsAvailableIntegrationCandidate({
        completed: false,
        inspect: () => "running",
        reservation: {
          branch: "fabro/legacy-s99-t99",
          status: "integrated",
          taskId: "S99-T99",
          workdir: "/tmp/legacy-s99-t99",
        },
        taskId: "S99-T99",
      }),
    ).toThrow("task reservation status is invalid");
    const selection = planIntegrationWave({
      baseSha: "base",
      candidates,
      completedTaskIds,
      integrationId: integrationWaveId(5),
      planSha256: "plan",
      tasks: [s00t02, s01t03, s01t04],
    });
    expect(selection.selectedTasks.map((value) => value.taskId)).toEqual([
      "S01-T03",
    ]);
  });

  it("still rejects an unreserved stale green candidate", () => {
    const value = task("S01-T04", "D2-domain-bodies");
    expect(() =>
      planIntegrationWave({
        baseSha: "base",
        candidates: [{ ...candidate(value), taskBlockHash: "stale" }],
        completedTaskIds: new Set(),
        integrationId: integrationWaveId(6),
        planSha256: "plan",
        tasks: [value],
      }),
    ).toThrow("candidate plan or task-block drift");
  });

  it("SHA-binds optional contract reproof lineage", () => {
    const value = task("S01-T04", "D2-domain-bodies");
    const selection = planIntegrationWave({
      baseSha: "base",
      candidates: [
        { ...candidate(value), reproofRequestSha256: "a".repeat(64) },
      ],
      completedTaskIds: new Set(),
      integrationId: integrationWaveId(7),
      planSha256: "plan",
      tasks: [value],
    });
    expect(selection.selectedTasks[0]?.reproofRequestSha256).toBe(
      "a".repeat(64),
    );
    expect(() =>
      validateIntegrationWaveSelection({
        ...selection,
        selectedTasks: selection.selectedTasks.map((task) => ({
          ...task,
          reproofRequestSha256: "b".repeat(64),
        })),
      }),
    ).toThrow("selection hash mismatch");
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
      reservationToken: "fixture",
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

describe("integration wave supersession", () => {
  it("requires an explicit resolution and rejects ambiguous promotion state", () => {
    const validatePromotion = vi.fn();
    const validateSupersession = vi.fn();
    expect(() =>
      priorIntegrationWaveResolution({
        integrationId: "wave-000002",
        promotionExists: false,
        supersessionExists: false,
        validatePromotion,
        validateSupersession,
      }),
    ).toThrow("unresolved global integration wave");
    expect(() =>
      priorIntegrationWaveResolution({
        integrationId: "wave-000002",
        promotionExists: true,
        supersessionExists: true,
        validatePromotion,
        validateSupersession,
      }),
    ).toThrow("promotion and supersession both exist");
    expect(validatePromotion).not.toHaveBeenCalled();
    expect(validateSupersession).not.toHaveBeenCalled();
  });

  it("keeps supersession distinct from promotion and advances the sequence", () => {
    const resolution = priorIntegrationWaveResolution({
      integrationId: "wave-000002",
      promotionExists: false,
      supersessionExists: true,
      validatePromotion: () => {
        throw new Error("promotion must not be consulted");
      },
      validateSupersession: () => undefined,
    });
    expect(resolution).toBe("superseded");
    expect(nextIntegrationWaveId(["wave-000001", "wave-000002"])).toBe(
      "wave-000003",
    );
    expect(() => nextIntegrationWaveId(["deleted-wave"])).toThrow(
      "invalid wave identity",
    );
  });

  it("binds a receipt to exact control, selection, run record, and task identity", () => {
    const fixture = supersessionFixture();
    const receipt = buildIntegrationWaveSupersessionReceipt({
      ...fixture,
      createdAt: "2026-07-15T12:00:00.000Z",
      evidence: ["wave-000002-non-lane-hand-authored-files"],
      expectedIntegrationId: fixture.integrationId,
      reason: "Immutable selection ownership was violated",
    });
    expect(receipt.status).toBe("superseded");
    expect(receipt.selectedTaskIds).toEqual(["S01-T03"]);
    expect(receipt.runAttempts.map((attempt) => attempt.status)).toEqual([
      "failed",
      "cancelled",
    ]);
    expect(() =>
      validateIntegrationWaveSupersessionReceipt({
        currentControlHead: fixture.controlHeadSha,
        expectedIntegrationId: fixture.integrationId,
        isAncestor: (ancestor, descendant) =>
          ancestor === fixture.controlHeadSha && descendant === ancestor,
        receipt,
        runRecordContent: fixture.runRecordContent,
        selectionContent: fixture.selectionContent,
        selectionPath: fixture.selectionPath,
      }),
    ).not.toThrow();
    expect(() =>
      validateIntegrationWaveSupersessionReceipt({
        currentControlHead: fixture.controlHeadSha,
        expectedIntegrationId: "wave-000003",
        isAncestor: () => true,
        receipt,
        runRecordContent: fixture.runRecordContent,
        selectionContent: fixture.selectionContent,
        selectionPath: fixture.selectionPath,
      }),
    ).toThrow("run/selection identity mismatch");
    rmSync(fixture.root, { recursive: true });
  });

  it.each(["running", "succeeded"] as const)(
    "refuses to supersede a %s Fabro attempt",
    (status) => {
      const fixture = supersessionFixture([status]);
      expect(() =>
        buildIntegrationWaveSupersessionReceipt({
          ...fixture,
          createdAt: "2026-07-15T12:00:00.000Z",
          evidence: ["terminal review finding"],
          expectedIntegrationId: fixture.integrationId,
          reason: "The prior immutable wave is abandoned",
        }),
      ).toThrow("is not terminal failed/cancelled");
      rmSync(fixture.root, { recursive: true });
    },
  );

  it("rejects stale or tampered run records and selections", () => {
    const fixture = supersessionFixture();
    const receipt = buildIntegrationWaveSupersessionReceipt({
      ...fixture,
      createdAt: "2026-07-15T12:00:00.000Z",
      evidence: ["terminal review finding"],
      expectedIntegrationId: fixture.integrationId,
      reason: "The prior immutable wave is abandoned",
    });
    const validate = (overrides: {
      runRecordContent?: string;
      selectionContent?: string;
    }) =>
      validateIntegrationWaveSupersessionReceipt({
        currentControlHead: fixture.controlHeadSha,
        expectedIntegrationId: fixture.integrationId,
        isAncestor: () => true,
        receipt,
        runRecordContent:
          overrides.runRecordContent ?? fixture.runRecordContent,
        selectionContent:
          overrides.selectionContent ?? fixture.selectionContent,
        selectionPath: fixture.selectionPath,
      });
    expect(() =>
      validate({
        runRecordContent: fixture.runRecordContent.replace(
          '"status": "launched"',
          '"status": "changed"',
        ),
      }),
    ).toThrow();
    expect(() =>
      validate({
        selectionContent: fixture.selectionContent.replace(
          fixture.baseSha,
          "d".repeat(40),
        ),
      }),
    ).toThrow();
    expect(() =>
      validate({
        runRecordContent: `${fixture.runRecordContent} `,
      }),
    ).toThrow("identity or digest mismatch");
    rmSync(fixture.root, { recursive: true });
  });

  it("requires the supersession control identity to be on current HEAD", () => {
    const fixture = supersessionFixture();
    const receipt = buildIntegrationWaveSupersessionReceipt({
      ...fixture,
      createdAt: "2026-07-15T12:00:00.000Z",
      evidence: ["terminal review finding"],
      expectedIntegrationId: fixture.integrationId,
      reason: "The prior immutable wave is abandoned",
    });
    expect(() =>
      validateIntegrationWaveSupersessionReceipt({
        currentControlHead: "d".repeat(40),
        expectedIntegrationId: fixture.integrationId,
        isAncestor: () => false,
        receipt,
        runRecordContent: fixture.runRecordContent,
        selectionContent: fixture.selectionContent,
        selectionPath: fixture.selectionPath,
      }),
    ).toThrow("receipt is not on control HEAD");
    rmSync(fixture.root, { recursive: true });
  });

  it("materializes only a byte-identical immutable receipt", () => {
    const fixture = supersessionFixture();
    const receipt = buildIntegrationWaveSupersessionReceipt({
      ...fixture,
      createdAt: "2026-07-15T12:00:00.000Z",
      evidence: ["terminal review finding"],
      expectedIntegrationId: fixture.integrationId,
      reason: "The prior immutable wave is abandoned",
    });
    const path = resolve(fixture.root, "supersession.json");
    materializeImmutableWaveSupersession(path, receipt);
    materializeImmutableWaveSupersession(path, receipt);
    expect(() =>
      materializeImmutableWaveSupersession(path, {
        ...receipt,
        reason: "A different reason is forbidden",
      }),
    ).toThrow("conflicts with existing receipt");
    rmSync(fixture.root, { recursive: true });
  });
});
