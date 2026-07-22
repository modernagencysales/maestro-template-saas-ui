import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { admitContractReproof } from "../src/contract-reproof-admission.js";
import {
  buildContractReproofFindingsRequest,
  buildContractReproofRequest,
} from "../src/contract-reproof.js";
import { validateFailedIntegrationReworkArchive } from "../src/failed-integration-rework-archive.js";
import { planFailedIntegrationRework } from "../src/failed-integration-rework.js";
import {
  failedWaveSelectsTask,
  integrationResultBindsBroadGate,
  supersessionBindsFailedAttempt,
} from "../src/failed-integration-rework-validation.js";
import {
  selectionFileSha256,
  selectionPayload,
  selectionPayloadSha256,
} from "../src/integration-wave.js";
import { buildIntegrationWaveSupersessionReceipt } from "../src/integration-wave-supersession.js";
import { planIntegrationOwnerReworkRoute } from "../src/route-integration-rework.js";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

const fixture = () => {
  const taskId = "S11-T02";
  const baseSha = "1".repeat(40);
  const controlHeadSha = "2".repeat(40);
  const laneHeadSha = "3".repeat(40);
  const candidateHeadSha = "4".repeat(40);
  const taskBlockHash = "5".repeat(64);
  const planSha256 = "6".repeat(64);
  const lane = {
    schemaVersion: "maestro-brain-lane-result/v1",
    taskId,
    headSha: laneHeadSha,
    treeSha: "7".repeat(40),
    tranche: "D2-domain-bodies",
    status: "lane_green",
  };
  const proof = {
    schemaVersion: "maestro-brain-ci-proof/v1",
    taskId,
    taskBlockHash,
    planSha256: "8".repeat(64),
    baseSha: "9".repeat(40),
    headSha: laneHeadSha,
    reviewHeadSha: laneHeadSha,
    reviewVerdict: "pass",
    reviewFindings: [],
  };
  const gate = {
    schemaVersion: "maestro-brain-lane-gate/v1",
    taskId,
    taskBlockHash,
    planSha256: proof.planSha256,
    currentHeadSha: laneHeadSha,
    currentTreeSha: lane.treeSha,
    headSha: laneHeadSha,
    stage: "final",
    status: "passed",
  };
  const laneContent = json(lane);
  const proofContent = json(proof);
  const gateContent = json(gate);
  const payload = selectionPayload({
    baseSha,
    deferredTaskIds: [],
    integrationId: "wave-000052",
    planSha256,
    requestedTaskIds: [taskId],
    selectedTasks: [
      {
        changedFiles: ["packages/example.ts"],
        codeStartAfter: ["S11-T01"],
        fileLocks: ["packages/example.ts"],
        gateHeadSha: laneHeadSha,
        gateSha256: sha256(gateContent),
        headSha: laneHeadSha,
        laneResultSha256: sha256(laneContent),
        planSha256: proof.planSha256,
        proofHeadSha: laneHeadSha,
        proofSha256: sha256(proofContent),
        taskBlockHash,
        taskId,
        tranche: lane.tranche,
      },
    ],
  });
  const selection = {
    ...payload,
    selectionPayloadSha256: selectionPayloadSha256(payload),
  };
  const selectionContent = json(selection);
  const selectionPath = "/tmp/maestro-wave-000052-selection.json";
  const runId = "01KY0MHH810PNR2MDZ8MBF3AEB";
  const runRecordContent = json({
    attempt: 1,
    baseSha,
    integrationId: selection.integrationId,
    reservationToken: "wave-reservation",
    runId,
    runIds: [runId],
    schemaVersion: "maestro-brain-integration-wave-run/v3",
    selection,
    selectionFileSha256: selectionFileSha256(selectionContent),
    selectionPath,
    selectionPayloadSha256: selection.selectionPayloadSha256,
    status: "launched",
    workdir: "/tmp/maestro-wave-000052",
  });
  const broadGate = {
    schemaVersion: "maestro-brain-broad-gate-receipt/v1",
    command: "rtk host-test-slot --class full pnpm verify",
    headSha: candidateHeadSha,
    status: "failed",
    attempts: [
      {
        attempt: 1,
        command: "rtk host-test-slot --class full pnpm verify",
        headSha: candidateHeadSha,
        outputSha256: "a".repeat(64),
        status: "failed",
        transientVitestWorkerRpcTimeout: false,
      },
    ],
  };
  const broadGateContent = json(broadGate);
  const integrationResult = {
    schemaVersion: "maestro-brain-integration-result/v3",
    integrationId: selection.integrationId,
    baseSha,
    headSha: candidateHeadSha,
    selectionFileSha256: selectionFileSha256(selectionContent),
    selectionPayloadSha256: selection.selectionPayloadSha256,
    status: "rework",
    reviewVerdict: "rework",
    remainingFindings: [
      {
        id: "type-coverage-below-threshold",
        severity: "high",
        summary: "Type coverage was 99.63%, below 99.7%.",
        details: "The selected lane lowers the repository type coverage gate.",
        affectedPaths: ["packages/example.ts"],
        expectedBehavior: "The candidate preserves required type coverage.",
        requiredRegressionProof: "The full type coverage command passes.",
        changeExpectation: "source_or_test_delta",
        taskId,
      },
    ],
    broadGate,
  };
  const integrationResultContent = json(integrationResult);
  const supersession = buildIntegrationWaveSupersessionReceipt({
    controlHeadSha: baseSha,
    createdAt: "2026-07-20T21:14:57.387Z",
    evidence: [
      `broad-gate-sha256:${sha256(broadGateContent)}`,
      `integration-result-sha256:${sha256(integrationResultContent)}`,
      `run:${runId}:failed`,
    ],
    expectedIntegrationId: selection.integrationId,
    reason: "s11-type-coverage-below-99.7",
    runInspections: [
      {
        run_id: runId,
        status: { kind: "failed" },
        run_spec: {
          settings: {
            run: {
              inputs: {
                attempt: 1,
                base_sha: baseSha,
                integration_id: selection.integrationId,
                mode: "integrate",
                reservation_token: "wave-reservation",
                selection_file_sha256: selectionFileSha256(selectionContent),
                selection_path: selectionPath,
                selection_payload_sha256: selection.selectionPayloadSha256,
                workdir: "/tmp/maestro-wave-000052",
              },
              metadata: {
                attempt: 1,
                integration: selection.integrationId,
                "integration-mode": "wave-v3",
                reservation: "wave-reservation",
              },
            },
          },
        },
      },
    ],
    runRecordContent,
    selectionContent,
    selectionPath,
  });
  const typeCoverageRegressionContent = json({
    schemaVersion: "maestro-brain-type-coverage-regression/v1",
    taskId,
    command: "rtk pnpm check:types-coverage",
    base: {
      headSha: baseSha,
      exitCode: 0,
      output: "(205510 / 206120) 99.70%\ntype-coverage success.\n",
    },
    candidate: {
      headSha: candidateHeadSha,
      exitCode: 1,
      output:
        "(205495 / 206150) 99.68%\ntype-coverage failed: expected 99.7%.\n",
    },
  });
  const input = {
    broadGateContent,
    controlClean: true,
    controlHeadSha,
    dependenciesIntegrated: true,
    expectedSourceBranch: "fabro/review-s11-t02",
    integrationResultContent,
    isAncestor: (ancestor: string, descendant: string) =>
      ancestor === baseSha && descendant === controlHeadSha,
    laneContent,
    manifestTaskBlockHash: taskBlockHash,
    planSha256,
    priorEvidencePath: "/tmp/evidence/archive/wave-000052/pending.json",
    proofContent,
    gateContent,
    promotionExists: false,
    reason: "repair deterministic broad verification failure",
    runRecordContent,
    selectionContent,
    selectionPath,
    sourceBranch: "fabro/review-s11-t02",
    sourceBranchHeadSha: laneHeadSha,
    sourceClean: true,
    sourceWorktreeHeadSha: laneHeadSha,
    supersessionContent: json(supersession),
    taskId,
    typeCoverageRegressionContent,
  };
  return {
    input,
    values: {
      broadGate,
      integrationResult,
      runId,
      runRecordContent,
      selection,
      selectionPath,
      supersession,
      typeCoverageRegressionContent,
    },
  };
};

describe("failed integration rework admission", () => {
  it("plans one supersession followed by sorted normal owner reopen commands", () => {
    const value = fixture();
    const taskFinding = {
      ...value.values.integrationResult.remainingFindings[0],
      candidateHeadSha: value.values.integrationResult.headSha,
      ownerKind: "task" as const,
      priorEvidenceSha256: [sha256(value.input.selectionContent)],
    };
    const integrationResultContent = json({
      ...value.values.integrationResult,
      broadGate: null,
      remainingFindings: [taskFinding],
      status: "ready_for_review",
    });
    const planned = planIntegrationOwnerReworkRoute({
      expectedIntegrationId: value.values.selection.integrationId,
      expectedResultSha256: sha256(integrationResultContent),
      expectedSelectionFileSha256: selectionFileSha256(
        value.input.selectionContent,
      ),
      expectedSelectionPayloadSha256:
        value.values.selection.selectionPayloadSha256,
      integrationOwnedPaths: [],
      integrationResultContent,
      selectionContent: value.input.selectionContent,
      stateRoot: "/tmp/state",
    });

    expect(planned.ownerTaskIds).toEqual([value.input.taskId]);
    expect(planned.commands).toHaveLength(2);
    expect(planned.commands[0]).toEqual(
      expect.arrayContaining([
        "brain:factory:supersede-wave",
        "--owner-rework-result-sha256",
        sha256(integrationResultContent),
      ]),
    );
    expect(planned.commands[1]).toEqual(
      expect.arrayContaining([
        "brain:factory:reopen",
        "--task",
        value.input.taskId,
        "--failed-integration",
        value.values.selection.integrationId,
        "--launch",
      ]),
    );
  });
  it("ignores an unbound stale broad-gate sidecar", () => {
    expect(integrationResultBindsBroadGate({ broadGate: null })).toBe(false);
    expect(
      integrationResultBindsBroadGate({ broadGate: { status: "failed" } }),
    ).toBe(true);
  });

  it("scopes a multi-task failed wave to its finding owner", () => {
    expect(failedWaveSelectsTask(["S03-T03", "S04-T04"], "S04-T04")).toBe(true);
  });

  it("accepts a terminal supersession bound to its latest failed attempt", () => {
    expect(
      supersessionBindsFailedAttempt(
        [
          { runId: "run-1", status: "failed" },
          { runId: "run-2", status: "failed" },
        ],
        ["run:run-2:failed"],
      ),
    ).toBe(true);
    expect(
      supersessionBindsFailedAttempt(
        [{ runId: "run-owner", status: "owner_rework" }],
        ["run:run-owner:owner_rework"],
      ),
    ).toBe(true);
  });

  it("admits a failed broad gate after semantic review passed", () => {
    const value = fixture();
    const integrationResult = {
      ...value.values.integrationResult,
      status: "ready_for_review",
      reviewVerdict: "pass",
      remainingFindings: [],
    };
    const integrationResultContent = json(integrationResult);
    const broadGate = {
      ...value.values.broadGate,
      attempts: [
        ...value.values.broadGate.attempts,
        {
          ...value.values.broadGate.attempts[0],
          attempt: 2,
          outputSha256: "b".repeat(64),
        },
      ],
    };
    const broadGateContent = json(broadGate);
    const supersession = buildIntegrationWaveSupersessionReceipt({
      controlHeadSha: value.values.selection.baseSha,
      createdAt: "2026-07-20T21:14:57.387Z",
      evidence: [`run:${value.values.runId}:failed`],
      expectedIntegrationId: value.values.selection.integrationId,
      reason: "broad-gate-only-failure",
      runInspections: [
        {
          run_id: value.values.runId,
          status: { kind: "failed" },
          run_spec: {
            settings: {
              run: {
                inputs: {
                  attempt: 1,
                  base_sha: value.values.selection.baseSha,
                  integration_id: value.values.selection.integrationId,
                  mode: "integrate",
                  reservation_token: "wave-reservation",
                  selection_file_sha256: selectionFileSha256(
                    value.input.selectionContent,
                  ),
                  selection_path: value.values.selectionPath,
                  selection_payload_sha256:
                    value.values.selection.selectionPayloadSha256,
                  workdir: "/tmp/maestro-wave-000052",
                },
                metadata: {
                  attempt: 1,
                  integration: value.values.selection.integrationId,
                  "integration-mode": "wave-v3",
                  reservation: "wave-reservation",
                },
              },
            },
          },
        },
      ],
      runRecordContent: value.values.runRecordContent,
      selectionContent: value.input.selectionContent,
      selectionPath: value.values.selectionPath,
    });
    const { typeCoverageRegressionContent: _typeCoverage, ...input } =
      value.input;
    void _typeCoverage;
    const planned = planFailedIntegrationRework({
      ...input,
      broadGateContent,
      integrationResultContent,
      supersessionContent: json(supersession),
    });
    expect(() =>
      validateFailedIntegrationReworkArchive({
        archiveContent: planned.archiveContent,
        currentControlHead: input.controlHeadSha,
        integrationResultContent,
        isAncestor: input.isAncestor,
        request: planned.request,
      }),
    ).not.toThrow();
  });

  it("builds an immutable archive and normal reproof request for one failed owner", () => {
    const value = fixture();
    const planned = planFailedIntegrationRework(value.input);
    expect(planned.archive).toMatchObject({
      schemaVersion: "maestro-brain-failed-integration-rework-archive/v1",
      taskId: value.input.taskId,
      integrationId: value.values.selection.integrationId,
      candidateHeadSha: value.values.integrationResult.headSha,
    });
    expect(planned.request).toEqual(
      buildContractReproofFindingsRequest({
        controlHeadSha: value.input.controlHeadSha,
        planSha256: value.input.planSha256,
        priorArchiveSha256: sha256(planned.archiveContent),
        priorEvidencePath: value.input.priorEvidencePath,
        priorIntegrationHeadSha: value.values.selection.baseSha,
        priorIntegrationId: value.values.selection.integrationId,
        priorIntegrationResultSha256: sha256(
          value.input.integrationResultContent,
        ),
        priorLaneResultSha256: sha256(value.input.laneContent),
        reason: value.input.reason,
        taskBlockHash: value.input.manifestTaskBlockHash,
        taskId: value.input.taskId,
        findings: planned.request.findings ?? [],
      }),
    );
    expect(planned.request).toMatchObject({
      schemaVersion: "maestro-brain-contract-reproof/v2",
      findings: [
        {
          id: "type-coverage-below-threshold",
          candidateHeadSha: value.values.integrationResult.headSha,
          affectedPaths: ["packages/example.ts"],
        },
      ],
    });
    expect(planned.request.findings?.[0]?.priorEvidenceSha256).toEqual(
      expect.arrayContaining([
        sha256(value.input.integrationResultContent),
        sha256(value.input.proofContent),
      ]),
    );
  });

  it("admits the archived failed-wave request through normal reproof tooling", () => {
    const value = fixture();
    const currentPlanSha256 = "c".repeat(64);
    const currentInput = {
      ...value.input,
      planSha256: currentPlanSha256,
    };
    const root = mkdtempSync(resolve(tmpdir(), "brain-failed-rework-"));
    roots.push(root);
    const evidence = resolve(root, "evidence");
    const provisional = planFailedIntegrationRework(currentInput);
    const archivePath = resolve(
      evidence,
      "archive",
      value.values.selection.integrationId,
      `${sha256(provisional.archiveContent)}.json`,
    );
    const planned = planFailedIntegrationRework({
      ...currentInput,
      priorEvidencePath: archivePath,
    });
    const resultPath = resolve(
      evidence,
      "integration",
      value.values.selection.integrationId,
      "integration-result.json",
    );
    const requestPath = resolve(
      evidence,
      "reproofs",
      value.input.taskId,
      "request.json",
    );
    mkdirSync(resolve(archivePath, ".."), { recursive: true });
    mkdirSync(resolve(resultPath, ".."), { recursive: true });
    mkdirSync(resolve(requestPath, ".."), { recursive: true });
    writeFileSync(archivePath, planned.archiveContent);
    writeFileSync(resultPath, value.input.integrationResultContent);
    writeFileSync(requestPath, json(planned.request));
    const selectedTask = value.values.selection.selectedTasks[0];
    if (!selectedTask) throw new Error("fixture selected task is missing");
    expect(
      admitContractReproof({
        changedFilesBetween: () => [],
        currentControlHead: value.input.controlHeadSha,
        evidenceDirectory: evidence,
        fileLocks: selectedTask.fileLocks,
        isAncestor: (ancestor, descendant) =>
          ancestor === descendant ||
          value.input.isAncestor(ancestor, descendant),
        lanePriorIntegrationHeadSha: planned.request.priorIntegrationHeadSha,
        lanePriorIntegrationId: planned.request.priorIntegrationId,
        laneRequestSha256: planned.request.requestSha256,
        planSha256: currentPlanSha256,
        proofBaseSha: value.input.controlHeadSha,
        requestPath,
        taskBlockHash: value.input.manifestTaskBlockHash,
        taskId: value.input.taskId,
      }).request,
    ).toEqual(planned.request);
  });

  it("uses current plan authority while retaining historical wave evidence", () => {
    const value = fixture();
    const currentPlanSha256 = "c".repeat(64);
    const planned = planFailedIntegrationRework({
      ...value.input,
      planSha256: currentPlanSha256,
    });
    expect(planned.request.planSha256).toBe(currentPlanSha256);
    expect(value.values.selection.planSha256).not.toBe(currentPlanSha256);
  });

  it("rejects supersession evidence detached from its durable run record", () => {
    const value = fixture();
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        runRecordContent: json({
          ...JSON.parse(value.values.runRecordContent),
          runIds: ["01ARZ3NDEKTSV4RRFFQ69G5FAV"],
        }),
      }),
    ).toThrow(/run record|supersession|durable wave attempts/);
  });

  it("requires an exact base-to-candidate type-coverage regression", () => {
    const value = fixture();
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        typeCoverageRegressionContent: json({
          ...JSON.parse(value.values.typeCoverageRegressionContent),
          candidate: {
            headSha: value.values.integrationResult.headSha,
            exitCode: 0,
            output: "(205510 / 206120) 99.70%\ntype-coverage success.\n",
          },
        }),
      }),
    ).toThrow(/type coverage.*regress|candidate.*failed/i);
  });

  it("does not route type-coverage rework around its failed broad gate", () => {
    const value = fixture();
    const { broadGateContent: _broadGate, ...withoutBroadGate } = value.input;
    expect(_broadGate).toBeDefined();
    expect(() =>
      planFailedIntegrationRework({
        ...withoutBroadGate,
        integrationResultContent: json({
          ...value.values.integrationResult,
          broadGate: null,
          status: "ready_for_review",
        }),
      }),
    ).toThrow("type coverage rework requires a failed broad gate");
  });

  it("requires integration-result v3 for review rework", () => {
    const value = fixture();
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        integrationResultContent: json({
          ...value.values.integrationResult,
          schemaVersion: "maestro-brain-integration-result/v2",
        }),
      }),
    ).toThrow("failed integration result status is invalid");
  });

  it("admits review rework before a broad gate exists", () => {
    const value = fixture();
    const integrationResultContent = json({
      ...value.values.integrationResult,
      broadGate: null,
      status: "ready_for_review",
      remainingFindings: [
        {
          id: "deterministic-build-failure",
          severity: "high",
          summary: "The deterministic build failed.",
          details: "The candidate does not satisfy the deterministic build.",
          affectedPaths: ["packages/example.ts"],
          expectedBehavior: "The deterministic build passes.",
          requiredRegressionProof: "The focused build regression passes.",
          changeExpectation: "source_or_test_delta",
          taskId: value.input.taskId,
        },
      ],
    });
    const supersession = buildIntegrationWaveSupersessionReceipt({
      controlHeadSha: value.values.selection.baseSha,
      createdAt: "2026-07-20T21:14:57.387Z",
      evidence: [
        `integration-result-sha256:${sha256(integrationResultContent)}`,
        `run:${value.values.runId}:failed`,
      ],
      expectedIntegrationId: value.values.selection.integrationId,
      reason: "s11-deterministic-build-failure",
      runInspections: [
        {
          run_id: value.values.runId,
          status: { kind: "failed" },
          run_spec: {
            settings: {
              run: {
                inputs: {
                  attempt: 1,
                  base_sha: value.values.selection.baseSha,
                  integration_id: value.values.selection.integrationId,
                  mode: "integrate",
                  reservation_token: "wave-reservation",
                  selection_file_sha256: selectionFileSha256(
                    value.input.selectionContent,
                  ),
                  selection_path: value.values.selectionPath,
                  selection_payload_sha256:
                    value.values.selection.selectionPayloadSha256,
                  workdir: "/tmp/maestro-wave-000052",
                },
                metadata: {
                  attempt: 1,
                  integration: value.values.selection.integrationId,
                  "integration-mode": "wave-v3",
                  reservation: "wave-reservation",
                },
              },
            },
          },
        },
      ],
      runRecordContent: value.values.runRecordContent,
      selectionContent: value.input.selectionContent,
      selectionPath: value.values.selectionPath,
    });
    const {
      broadGateContent: _broadGate,
      typeCoverageRegressionContent: _ignored,
      ...withoutCoverage
    } = value.input;
    expect(_broadGate).toBeDefined();
    expect(_ignored).toBeDefined();
    const planned = planFailedIntegrationRework({
      ...withoutCoverage,
      integrationResultContent,
      supersessionContent: json(supersession),
    });
    expect(() =>
      validateFailedIntegrationReworkArchive({
        archiveContent: planned.archiveContent,
        currentControlHead: value.input.controlHeadSha,
        integrationResultContent,
        isAncestor: value.input.isAncestor,
        request: planned.request,
      }),
    ).not.toThrow();
  });

  it("rejects a self-rehashed archive with mutated proof evidence", () => {
    const value = fixture();
    const planned = planFailedIntegrationRework(value.input);
    const archive = {
      ...planned.archive,
      proofContent: `${planned.archive.proofContent} `,
    };
    const archiveContent = json(archive);
    const request = buildContractReproofRequest({
      ...planned.request,
      priorArchiveSha256: sha256(archiveContent),
    });
    expect(() =>
      validateFailedIntegrationReworkArchive({
        archiveContent,
        currentControlHead: value.input.controlHeadSha,
        integrationResultContent: value.input.integrationResultContent,
        isAncestor: value.input.isAncestor,
        request,
      }),
    ).toThrow(/proof digest drift/);
  });

  it.each([
    [
      "pass wave",
      {
        integrationResultContent: json({
          ...fixture().values.integrationResult,
          status: "passed",
        }),
      },
      /status is invalid/,
    ],
    ["promoted wave", { promotionExists: true }, /already promoted/],
    ["wrong owner", { taskId: "S11-T03" }, /task owner mismatch/],
    [
      "stale task hash",
      { manifestTaskBlockHash: "c".repeat(64) },
      /task-block drift/,
    ],
    ["dirty source", { sourceClean: false }, /source worktree is not clean/],
    ["dirty control", { controlClean: false }, /control worktree is not clean/],
    ["wrong branch", { sourceBranch: "fabro/other" }, /source branch drift/],
    [
      "missing dependency",
      { dependenciesIntegrated: false },
      /dependencies are not integrated/,
    ],
    [
      "promoted base not on control",
      { isAncestor: () => false },
      /wave base is not an ancestor/,
    ],
  ])("rejects %s", (_label, overrides, expected) => {
    const value = fixture();
    expect(() =>
      planFailedIntegrationRework({ ...value.input, ...overrides }),
    ).toThrow(expected);
  });

  it("rejects a pass broad receipt", () => {
    const value = fixture();
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        broadGateContent: json({ ...value.values.broadGate, status: "passed" }),
      }),
    ).toThrow(/broad gate is not failed/);
  });

  it("rejects a multi-task fixture with stale selection identity", () => {
    const value = fixture();
    const selectedTask = value.values.selection.selectedTasks[0];
    if (!selectedTask) throw new Error("fixture selected task is missing");
    const selectedTasks = [
      selectedTask,
      {
        ...selectedTask,
        changedFiles: ["packages/other.ts"],
        fileLocks: ["packages/other.ts"],
        taskId: "S11-T03",
      },
    ];
    const payload = selectionPayload({
      ...value.values.selection,
      requestedTaskIds: ["S11-T02", "S11-T03"],
      selectedTasks,
    });
    const selection = {
      ...payload,
      selectionPayloadSha256: selectionPayloadSha256(payload),
    };
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        selectionContent: json(selection),
      }),
    ).toThrow(/selection identity drift/);
  });

  it("rejects a finding not owned by the selected task", () => {
    const value = fixture();
    const integrationResult = {
      ...value.values.integrationResult,
      remainingFindings: [
        { id: "coverage", severity: "high", taskId: "S11-T03" },
      ],
    };
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        integrationResultContent: json(integrationResult),
      }),
    ).toThrow(/finding owner mismatch/);
  });

  it("rejects a finding path outside the selected owner lane locks", () => {
    const value = fixture();
    const finding = value.values.integrationResult.remainingFindings[0];
    if (!finding) throw new Error("fixture finding missing");
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        integrationResultContent: json({
          ...value.values.integrationResult,
          remainingFindings: [
            { ...finding, affectedPaths: ["packages/other.ts"] },
          ],
        }),
      }),
    ).toThrow(/outside selected owner locks/);
  });

  it("rejects incomplete semantic finding evidence", () => {
    const value = fixture();
    const finding = value.values.integrationResult.remainingFindings[0];
    if (!finding) throw new Error("fixture finding missing");
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        integrationResultContent: json({
          ...value.values.integrationResult,
          remainingFindings: [{ ...finding, expectedBehavior: "" }],
        }),
      }),
    ).toThrow(/expectedBehavior/);
  });

  it("rejects missing or drifted broad-gate evidence", () => {
    const value = fixture();
    expect(() =>
      planFailedIntegrationRework({ ...value.input, broadGateContent: "" }),
    ).toThrow(/broad gate receipt is missing/);
    const broadGate = { ...value.values.broadGate, headSha: "d".repeat(40) };
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        broadGateContent: json(broadGate),
      }),
    ).toThrow(/broad gate candidate head drift/);
  });

  it("rejects selection proof, gate, lane, and source-head drift", () => {
    const value = fixture();
    for (const [field, content, expected] of [
      [
        "laneContent",
        `${value.input.laneContent} `,
        /lane result digest drift/,
      ],
      ["proofContent", `${value.input.proofContent} `, /proof digest drift/],
      ["gateContent", `${value.input.gateContent} `, /gate digest drift/],
      ["sourceBranchHeadSha", "e".repeat(40), /source head drift/],
    ] as const) {
      expect(() =>
        planFailedIntegrationRework({ ...value.input, [field]: content }),
      ).toThrow(expected);
    }
  });

  it("rejects non-failed or digest-drifted supersession evidence", () => {
    const value = fixture();
    const passAttempt = {
      ...value.values.supersession,
      runAttempts: [
        { ...value.values.supersession.runAttempts[0], status: "cancelled" },
      ],
    };
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        supersessionContent: json(passAttempt),
      }),
    ).toThrow(/supersession identity or digest mismatch|terminal failed/);
    const drifted = {
      ...value.values.supersession,
      receiptSha256: "f".repeat(64),
    };
    expect(() =>
      planFailedIntegrationRework({
        ...value.input,
        supersessionContent: json(drifted),
      }),
    ).toThrow(/supersession identity or digest mismatch/);
  });
});
