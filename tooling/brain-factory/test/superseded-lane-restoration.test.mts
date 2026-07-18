import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  applySupersededLaneRestoration,
  planSupersededLaneRestoration,
} from "../src/superseded-lane-restoration.js";
import { validateAppliedSupersededLaneRestoration } from "../src/superseded-lane-restoration-receipt.js";
import { buildIntegrationWaveSupersessionReceipt } from "../src/integration-wave-supersession.js";
import {
  planIntegrationWave,
  type IntegrationWaveCandidate,
} from "../src/integration-wave.js";
import type { BrainTaskContract } from "../src/manifest.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const task = (taskId = "S02-T04"): BrainTaskContract => ({
  acceptanceAfter: "none",
  classification: "pattern-instance",
  codeStartAfter: [],
  estimatedSourceLines: 20,
  fileInventoryIssues: [],
  fileInventoryStatus: "ready",
  fileLocks: [`${taskId}.ts`],
  gateProfiles: ["tooling"],
  kind: "product",
  lane: "test",
  requirements: [],
  sourceSliceBudget: 300,
  taskBlockHash: `${taskId}-block`,
  taskId,
  title: taskId,
  tranche: "D2-domain-bodies",
});

const laneGreen = (taskId = "S02-T04") => ({
  schemaVersion: "maestro-brain-lane-result/v1",
  taskId,
  headSha: "1".repeat(40),
  tranche: "D2-domain-bodies",
  status: "lane_green",
  proofHeadSha: "1".repeat(40),
  gateHeadSha: "1".repeat(40),
  proofSha256: "2".repeat(64),
  gateSha256: "3".repeat(64),
  taskBlockHash: `${taskId}-block`,
});

const waveEvidence = (input: {
  compactSelection?: boolean;
  integrationId: string;
  integrationHeadSha: string;
  laneResultSha256: string;
  taskId?: string;
}) => {
  const root = mkdtempSync(resolve(tmpdir(), "brain-lane-restoration-wave-"));
  const value = task(input.taskId);
  const baseSha = "a".repeat(40);
  const planSha256 = "b".repeat(64);
  const candidate: IntegrationWaveCandidate = {
    changedFiles: [...value.fileLocks],
    gateHeadSha: "1".repeat(40),
    gateSha256: "3".repeat(64),
    headSha: "1".repeat(40),
    laneResultSha256: input.laneResultSha256,
    planSha256,
    proofHeadSha: "1".repeat(40),
    proofSha256: "2".repeat(64),
    taskBlockHash: value.taskBlockHash,
    taskId: value.taskId,
    tranche: value.tranche,
  };
  const plannedSelection = planIntegrationWave({
    baseSha,
    candidates: [candidate],
    completedTaskIds: new Set(),
    integrationId: input.integrationId,
    planSha256,
    tasks: [value],
  });
  const legacyPayload = {
    baseSha: plannedSelection.baseSha,
    deferredTaskIds: plannedSelection.deferredTaskIds,
    integrationId: plannedSelection.integrationId,
    planSha256: plannedSelection.planSha256,
    ...(plannedSelection.requestedTaskIds === undefined
      ? {}
      : { requestedTaskIds: plannedSelection.requestedTaskIds }),
    schemaVersion: "maestro-brain-integration-wave-selection/v2" as const,
    selectedTasks: plannedSelection.selectedTasks,
  };
  const selection = {
    ...legacyPayload,
    selectionSha256: sha256(JSON.stringify(legacyPayload)),
  };
  const selectionPath = resolve(root, "selection.json");
  const selectionContent = input.compactSelection
    ? JSON.stringify(selection)
    : json(selection);
  const runId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const reservationToken = ["lane", "restoration", "fixture"].join("-");
  const workdir = resolve(root, "workdir");
  const runRecordContent = json({
    attempt: 1,
    baseSha,
    integrationId: input.integrationId,
    reservationToken,
    runId,
    runIds: [runId],
    schemaVersion: "maestro-brain-integration-wave-run/v2",
    selection,
    selectionPath,
    selectionSha256: selection.selectionSha256,
    status: "launched",
    workdir,
  });
  const runInspection = {
    run_id: runId,
    status: { kind: "failed" },
    run_spec: {
      settings: {
        run: {
          inputs: {
            attempt: 1,
            base_sha: baseSha,
            integration_id: input.integrationId,
            mode: "integrate",
            reservation_token: reservationToken,
            selection_path: selectionPath,
            selection_sha256: selection.selectionSha256,
            workdir,
          },
          metadata: {
            attempt: 1,
            integration: input.integrationId,
            "integration-mode": "wave-v2",
            reservation: reservationToken,
          },
        },
      },
    },
  };
  const controlHeadSha = "c".repeat(40);
  const supersessionReceipt = buildIntegrationWaveSupersessionReceipt({
    controlHeadSha,
    createdAt: "2026-07-17T05:00:00.000Z",
    evidence: ["deterministic restoration fixture"],
    expectedIntegrationId: input.integrationId,
    reason: "The immutable integration wave was superseded",
    runInspections: [runInspection],
    runRecordContent,
    selectionContent,
    selectionPath,
  });
  return {
    controlHeadSha,
    integrationId: input.integrationId,
    integrationResult: {
      schemaVersion: "maestro-brain-integration-result/v2",
      integrationId: input.integrationId,
      status: "passed",
      reviewVerdict: "pass",
      baseSha,
      headSha: input.integrationHeadSha,
      integrationHeadSha: input.integrationHeadSha,
      selectionSha256: selection.selectionSha256,
      remainingFindings: [],
      includedTasks: [
        {
          taskId: value.taskId,
          tranche: value.tranche,
          laneHeadSha: candidate.headSha,
          laneResultSha256: input.laneResultSha256,
        },
      ],
    },
    promotionExists: false,
    root,
    runRecordContent,
    selectionContent,
    selectionPayloadSha256: selection.selectionSha256,
    selectionPath,
    supersessionReceipt,
  };
};

const fixture = () => {
  const prior = laneGreen();
  const priorContent = json(prior);
  const currentWave = waveEvidence({
    integrationHeadSha: "4".repeat(40),
    integrationId: "wave-000014",
    laneResultSha256: sha256(priorContent),
  });
  const currentLane = {
    ...prior,
    status: "integrated",
    laneResultSha256: sha256(priorContent),
    preIntegrationLaneResultSha256: sha256(priorContent),
    integrationId: currentWave.integrationId,
    integrationHeadSha: currentWave.integrationResult.headSha,
    accepted: false,
    acceptanceBlocker:
      "Integrated in immutable wave wave-000014, but no acceptanceAfter evidence proves accepted:true for this lane result.",
  };
  return { currentLane, currentWave, prior, priorContent };
};

describe("superseded lane restoration", () => {
  it("restores an exact pre-integration lane and emits an immutable receipt", () => {
    const value = fixture();
    const planned = planSupersededLaneRestoration({
      currentControlHead: value.currentWave.controlHeadSha,
      isAncestor: () => true,
      lanes: [{ content: json(value.currentLane), taskId: "S02-T04" }],
      wave: value.currentWave,
    });
    expect(planned.lanes[0]?.restoredContent).toBe(value.priorContent);
    expect(planned.receipt.tasks).toEqual([
      expect.objectContaining({
        restoredLaneResultSha256: sha256(value.priorContent),
        taskId: "S02-T04",
      }),
    ]);
    expect(value.currentWave.supersessionReceipt).toEqual(
      expect.objectContaining({
        schemaVersion: "maestro-brain-integration-wave-supersession/v2",
        selectionFileSha256: sha256(value.currentWave.selectionContent),
        selectionPayloadSha256: value.currentWave.selectionPayloadSha256,
      }),
    );
    expect(value.currentWave.supersessionReceipt).not.toHaveProperty(
      "selectionSha256",
    );
    expect(planned.receipt).toEqual(
      expect.objectContaining({
        schemaVersion: "maestro-brain-superseded-lane-restoration/v2",
        selectionFileSha256: sha256(value.currentWave.selectionContent),
        selectionPayloadSha256: value.currentWave.selectionPayloadSha256,
      }),
    );
    expect(planned.receipt).not.toHaveProperty("selectionSha256");
    expect(planned.receipt.receiptSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(
      validateAppliedSupersededLaneRestoration({
        currentControlHead: value.currentWave.controlHeadSha,
        isAncestor: () => true,
        lanes: [{ content: value.priorContent, taskId: "S02-T04" }],
        receipt: planned.receipt,
        wave: value.currentWave,
      }),
    ).toEqual(planned.receipt);
    expect(() =>
      validateAppliedSupersededLaneRestoration({
        currentControlHead: value.currentWave.controlHeadSha,
        isAncestor: () => true,
        lanes: [{ content: value.priorContent, taskId: "S02-T04" }],
        receipt: {
          ...planned.receipt,
          selectionFileSha256: "f".repeat(64),
        },
        wave: value.currentWave,
      }),
    ).toThrow("identity or digest mismatch");
    rmSync(value.currentWave.root, { recursive: true });
  });

  it("normalizes v2 payload identity while preserving exact file bytes", () => {
    const pretty = waveEvidence({
      integrationHeadSha: "4".repeat(40),
      integrationId: "wave-000014",
      laneResultSha256: "5".repeat(64),
    });
    const compact = waveEvidence({
      compactSelection: true,
      integrationHeadSha: "4".repeat(40),
      integrationId: "wave-000014",
      laneResultSha256: "5".repeat(64),
    });
    expect(pretty.supersessionReceipt.selectionPayloadSha256).toBe(
      compact.supersessionReceipt.selectionPayloadSha256,
    );
    expect(pretty.supersessionReceipt.selectionFileSha256).toBe(
      sha256(pretty.selectionContent),
    );
    expect(compact.supersessionReceipt.selectionFileSha256).toBe(
      sha256(compact.selectionContent),
    );
    expect(pretty.supersessionReceipt.selectionFileSha256).not.toBe(
      compact.supersessionReceipt.selectionFileSha256,
    );
    rmSync(pretty.root, { recursive: true });
    rmSync(compact.root, { recursive: true });
  });

  it("reconstructs an exact prior superseded-wave overlay from lineage", () => {
    const clean = laneGreen();
    const cleanContent = json(clean);
    const priorWave = waveEvidence({
      integrationHeadSha: "5".repeat(40),
      integrationId: "wave-000013",
      laneResultSha256: sha256(cleanContent),
    });
    const priorOverlay = {
      ...clean,
      status: "lane_green",
      laneResultSha256: sha256(cleanContent),
      preIntegrationLaneResultSha256: sha256(cleanContent),
      integrationId: priorWave.integrationId,
      integrationHeadSha: priorWave.integrationResult.headSha,
      accepted: false,
      acceptanceBlocker:
        "Integrated in immutable wave wave-000013, but no acceptanceAfter evidence proves accepted:true for this lane result.",
    };
    const priorOverlayContent = json(priorOverlay);
    const currentWave = waveEvidence({
      integrationHeadSha: "6".repeat(40),
      integrationId: "wave-000014",
      laneResultSha256: sha256(priorOverlayContent),
    });
    const currentLane = {
      ...priorOverlay,
      status: "integrated",
      preIntegrationLaneResultSha256: sha256(priorOverlayContent),
      integrationId: currentWave.integrationId,
      integrationHeadSha: currentWave.integrationResult.headSha,
      acceptanceBlocker:
        "Integrated in immutable wave wave-000014, but no acceptanceAfter evidence proves accepted:true for this lane result.",
    };
    const planned = planSupersededLaneRestoration({
      currentControlHead: currentWave.controlHeadSha,
      isAncestor: () => true,
      lanes: [{ content: json(currentLane), taskId: "S02-T04" }],
      priorWave,
      wave: currentWave,
    });
    expect(planned.lanes[0]?.restoredContent).toBe(priorOverlayContent);
    expect(planned.receipt.tasks[0]?.priorIntegrationId).toBe("wave-000013");
    rmSync(priorWave.root, { recursive: true });
    rmSync(currentWave.root, { recursive: true });
  });

  it("fails closed on hash mismatch, promotion, or task/head drift", () => {
    const value = fixture();
    const plan = (overrides = {}) =>
      planSupersededLaneRestoration({
        currentControlHead: value.currentWave.controlHeadSha,
        isAncestor: () => true,
        lanes: [{ content: json(value.currentLane), taskId: "S02-T04" }],
        wave: value.currentWave,
        ...overrides,
      });
    expect(() =>
      plan({
        lanes: [
          {
            content: json({
              ...value.currentLane,
              preIntegrationLaneResultSha256: "f".repeat(64),
            }),
            taskId: "S02-T04",
          },
        ],
      }),
    ).toThrow("pre-integration lane hash");
    expect(() =>
      plan({ wave: { ...value.currentWave, promotionExists: true } }),
    ).toThrow("promoted");
    expect(() =>
      plan({
        lanes: [{ content: json(value.currentLane), taskId: "S99-T99" }],
      }),
    ).toThrow("task binding");
    expect(() =>
      plan({
        lanes: [
          {
            content: json({
              ...value.currentLane,
              integrationHeadSha: "9".repeat(40),
            }),
            taskId: "S02-T04",
          },
        ],
      }),
    ).toThrow("integration head");
    rmSync(value.currentWave.root, { recursive: true });
  });

  it("atomically applies once and treats an exact repeat as a no-op", () => {
    const value = fixture();
    const planned = planSupersededLaneRestoration({
      currentControlHead: value.currentWave.controlHeadSha,
      isAncestor: () => true,
      lanes: [{ content: json(value.currentLane), taskId: "S02-T04" }],
      wave: value.currentWave,
    });
    const lanePath = resolve(value.currentWave.root, "lane-result.json");
    const receiptPath = resolve(value.currentWave.root, "restoration.json");
    writeFileSync(lanePath, json(value.currentLane));
    expect(
      applySupersededLaneRestoration({
        lanePaths: new Map([["S02-T04", lanePath]]),
        plan: planned,
        receiptPath,
      }),
    ).toBe("applied");
    expect(readFileSync(lanePath, "utf8")).toBe(value.priorContent);
    const receiptContent = readFileSync(receiptPath, "utf8");
    expect(
      applySupersededLaneRestoration({
        lanePaths: new Map([["S02-T04", lanePath]]),
        plan: planned,
        receiptPath,
      }),
    ).toBe("already-applied");
    expect(readFileSync(receiptPath, "utf8")).toBe(receiptContent);
    rmSync(value.currentWave.root, { recursive: true });
  });
});
