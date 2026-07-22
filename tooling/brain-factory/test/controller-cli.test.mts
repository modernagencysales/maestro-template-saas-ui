import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acquireControllerLock,
  installControllerSignalHandlers,
  parseControllerCliArgs,
  reconcileControllerAction,
  runControllerCli,
  type ControllerCliRuntime,
} from "../src/controller.mjs";
import {
  planControllerTick,
  type ControllerActionReceipt,
} from "../src/controller.js";
import { observeControllerSnapshot } from "../src/controller-observation.js";
import { normalizeControllerSnapshot } from "../src/factory-state.js";
import {
  selectionFileSha256,
  selectionPayloadSha256,
} from "../src/integration-wave.js";
import { buildManifest } from "../src/manifest.js";

const manifest = buildManifest();
const stateRoot = "/tmp/maestro-controller-state";
const snapshot = normalizeControllerSnapshot({
  controlHeadSha: "a".repeat(40),
  gateQueue: { capacity: 2, inUse: 0, waiting: 0 },
  manifestSha256: "b".repeat(64),
  planSha256: manifest.planSha256,
  providerErrors: [],
  tasks: [],
  waves: [],
});

const writeJson = (path: string, value: unknown): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const exactWaveFixture = (root: string) => {
  const task = manifest.tasks.find(({ kind }) => kind === "product");
  if (!task) throw new Error("wave task fixture missing");
  const baseSha = "a".repeat(40);
  const taskHeadSha = "c".repeat(40);
  const waveHeadSha = "d".repeat(40);
  const integrationId = "wave-000001";
  const selectionPayload = {
    baseSha,
    deferredTaskIds: [],
    integrationId,
    planSha256: manifest.planSha256,
    requestedTaskIds: [task.taskId],
    schemaVersion: "maestro-brain-integration-wave-selection/v3" as const,
    selectedTasks: [
      {
        changedFiles: task.fileLocks.slice(0, 1),
        codeStartAfter: task.codeStartAfter,
        fileLocks: task.fileLocks,
        gateHeadSha: taskHeadSha,
        gateSha256: "1".repeat(64),
        headSha: taskHeadSha,
        laneResultSha256: "2".repeat(64),
        planSha256: manifest.planSha256,
        proofHeadSha: taskHeadSha,
        proofSha256: "3".repeat(64),
        taskBlockHash: task.taskBlockHash,
        taskId: task.taskId,
        tranche: task.tranche,
      },
    ],
  };
  const selection = {
    ...selectionPayload,
    selectionPayloadSha256: selectionPayloadSha256(selectionPayload),
  };
  const selectionPath = resolve(
    root,
    "runs",
    `integration-${integrationId}-selection.json`,
  );
  const selectionContent = `${JSON.stringify(selection, null, 2)}\n`;
  mkdirSync(join(root, "runs"), { recursive: true });
  writeFileSync(selectionPath, selectionContent);
  const record = {
    activeMode: "integrate",
    attempt: 1,
    baseSha,
    branch: `fabro/brain-${integrationId}`,
    integrationId,
    reservationToken: "wave-owner",
    runId: "wave-run",
    runIds: ["wave-run"],
    schemaVersion: "maestro-brain-integration-wave-run/v3",
    selection,
    selectionFileSha256: selectionFileSha256(selectionContent),
    selectionPath,
    selectionPayloadSha256: selection.selectionPayloadSha256,
    status: "launched",
    workdir: resolve(root, "workdir"),
  };
  const recordPath = resolve(root, "runs", `integration-${integrationId}.json`);
  writeJson(recordPath, record);
  return {
    baseSha,
    integrationId,
    record,
    recordPath,
    selection,
    selectionPath,
    task,
    taskHeadSha,
    waveHeadSha,
  };
};

describe("controller CLI contract", () => {
  it("reconciles owner routing without treating task rework as promotion", () => {
    rmSync(stateRoot, { force: true, recursive: true });
    const ownerWave = {
      findingSha256: "1".repeat(64),
      headSha: "d".repeat(40),
      identity: "exact" as const,
      inspection: "succeeded" as const,
      integrationId: "wave-000042",
      ownerTaskIds: ["S04-T04"],
      ownershipId: "wave-owner",
      resultSha256: "2".repeat(64),
      runId: "wave-run",
      selectionFileSha256: "3".repeat(64),
      selectionPayloadSha256: "4".repeat(64),
    };
    const before = normalizeControllerSnapshot({
      ...snapshot,
      waves: [ownerWave],
    });
    const action = planControllerTick(
      before,
      { maximumBatchSize: 4, minimumBatchSize: 1, totalActiveCapacity: 10 },
      manifest,
    )[0];
    if (!action) throw new Error("owner route action missing");
    expect(
      reconcileControllerAction({ action, observe: () => before, stateRoot }),
    ).toEqual({ kind: "not-started" });

    const after = normalizeControllerSnapshot({
      ...snapshot,
      tasks: [{ runId: "owner-run", status: "running", taskId: "S04-T04" }],
    });
    expect(
      reconcileControllerAction({ action, observe: () => after, stateRoot }),
    ).toEqual({ kind: "unresolved" });
    writeJson(
      join(
        stateRoot,
        "evidence",
        "integration",
        "wave-000042",
        "owner-rework-routing.json",
      ),
      {
        schemaVersion: "maestro-brain-owner-rework-routing/v1",
        findingSha256: "1".repeat(64),
        owners: {
          "S04-T04": {
            findingsSha256: "9".repeat(64),
            requestSha256: "8".repeat(64),
            runId: "owner-run",
            status: "launched",
          },
        },
        resultSha256: "2".repeat(64),
        selectionFileSha256: "3".repeat(64),
        selectionPayloadSha256: "4".repeat(64),
        status: "complete",
      },
    );
    expect(
      reconcileControllerAction({ action, observe: () => after, stateRoot }),
    ).toEqual({ kind: "succeeded" });
    rmSync(stateRoot, { force: true, recursive: true });
  });

  it("maps terminal Fabro state authoritatively and fails inspection closed", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-observe-"));
    const runs = join(root, "runs");
    mkdirSync(runs, { recursive: true });
    writeFileSync(
      join(runs, "S00-T02.json"),
      `${JSON.stringify({
        baseSha: "a".repeat(40),
        branch: "fabro/brain-s00-t02",
        runId: "run-task",
        status: "launched",
        taskId: "S00-T02",
        workdir: "/tmp/s00-t02",
      })}\n`,
    );
    const invalidLaneDirectory = join(
      root,
      "evidence",
      "lane-results",
      "S01-T01",
    );
    mkdirSync(invalidLaneDirectory, { recursive: true });
    writeFileSync(
      join(invalidLaneDirectory, "lane-result.json"),
      `${JSON.stringify({
        headSha: "b".repeat(40),
        status: "lane_green",
        taskId: "S01-T01",
      })}\n`,
    );
    const observed = observeControllerSnapshot({
      controlHeadSha: "a".repeat(40),
      controlRoot: process.cwd(),
      inspect: () => "succeeded",
      manifest,
      stateRoot: root,
    });
    expect(
      observed.tasks.find(({ taskId }) => taskId === "S00-T02")?.stage,
    ).toBe("terminal");
    expect(
      observed.tasks.find(({ taskId }) => taskId === "S01-T01")?.stage,
    ).toBe("false_green");

    const unavailable = observeControllerSnapshot({
      controlHeadSha: "a".repeat(40),
      controlRoot: process.cwd(),
      inspect: () => {
        throw new Error("provider payload secret");
      },
      manifest,
      stateRoot: root,
    });
    expect(
      unavailable.tasks.find(({ taskId }) => taskId === "S00-T02")?.stage,
    ).toBe("unknown");
    expect(unavailable.providerErrors).toEqual([
      { category: "unavailable", provider: "fabro" },
    ]);
    expect(JSON.stringify(unavailable)).not.toContain(
      "provider payload secret",
    );
    rmSync(root, { force: true, recursive: true });
  });

  it("re-observes after archive and dispatches in the same once run", async () => {
    let state = 0;
    const observations = [
      normalizeControllerSnapshot({
        ...snapshot,
        tasks: [
          { runId: "terminal-run", status: "terminal", taskId: "S01-T02" },
        ],
      }),
      normalizeControllerSnapshot({
        ...snapshot,
        tasks: [
          { status: "accepted", taskId: "S00-T01" },
          { status: "pending", taskId: "S00-T02" },
        ],
      }),
      normalizeControllerSnapshot({
        ...snapshot,
        tasks: [
          { status: "accepted", taskId: "S00-T01" },
          { status: "running", taskId: "S00-T02" },
        ],
      }),
    ];
    const runtime: ControllerCliRuntime = {
      acquireLock: () => () => undefined,
      appendTelemetry: () => undefined,
      execute: ({ action, tickId }) => {
        state += 1;
        return {
          actionId: action.actionId,
          kind: action.kind,
          schemaVersion: "maestro-brain-controller-action-receipt/v1",
          status: "succeeded",
          tickId,
        };
      },
      manifest: () => manifest,
      now: () => "2026-07-18T00:00:00.000Z",
      observe: () => {
        const observed = observations[Math.min(state, 2)];
        if (!observed)
          throw new Error("missing controller observation fixture");
        return observed;
      },
      sleep: async () => false,
    };
    const output = await runControllerCli(
      parseControllerCliArgs(["--once", "--state", stateRoot]),
      runtime,
    );
    expect(output.map((line) => JSON.parse(line).kind)).toEqual([
      "archive_terminal",
      "dispatch_tasks",
    ]);
  });

  it("rejects promotion and integration reconciliation without exact durable authority", () => {
    const promotionRoot = mkdtempSync(
      join(tmpdir(), "brain-controller-forged-promotion-"),
    );
    const promotable = normalizeControllerSnapshot({
      ...snapshot,
      waves: [
        {
          headSha: "d".repeat(40),
          identity: "exact",
          inspection: "succeeded",
          integrationId: "wave-000001",
          ownershipId: "wave-owner",
          runId: "wave-run",
        },
      ],
    });
    const promotionAction = planControllerTick(
      promotable,
      {
        maximumBatchSize: 10,
        minimumBatchSize: 5,
        totalActiveCapacity: 12,
      },
      manifest,
    )[0];
    if (!promotionAction) throw new Error("promotion action fixture missing");
    const promotionDirectory = join(
      promotionRoot,
      "evidence",
      "integration",
      "wave-000001",
    );
    mkdirSync(promotionDirectory, { recursive: true });
    writeFileSync(
      join(promotionDirectory, "promotion.json"),
      `${JSON.stringify({
        integrationId: "wave-000001",
        status: "promoted",
      })}\n`,
    );
    expect(
      reconcileControllerAction({
        action: promotionAction,
        observe: () =>
          normalizeControllerSnapshot({
            ...snapshot,
            controlHeadSha: "d".repeat(40),
          }),
        stateRoot: promotionRoot,
      }),
    ).toEqual({ kind: "unresolved" });

    const integrationRoot = mkdtempSync(
      join(tmpdir(), "brain-controller-forged-integration-"),
    );
    const greenTask = manifest.tasks.find(({ kind }) => kind === "product");
    if (!greenTask) throw new Error("green task fixture missing");
    const greenSnapshot = normalizeControllerSnapshot({
      ...snapshot,
      tasks: [
        {
          admission: "admissible",
          headSha: "c".repeat(40),
          status: "lane_green",
          taskId: greenTask.taskId,
        },
      ],
    });
    const integrateAction = planControllerTick(
      greenSnapshot,
      {
        maximumBatchSize: 10,
        minimumBatchSize: 1,
        totalActiveCapacity: 12,
      },
      manifest,
    )[0];
    if (!integrateAction) throw new Error("integration action fixture missing");
    mkdirSync(join(integrationRoot, "runs"), { recursive: true });
    writeFileSync(
      join(integrationRoot, "runs", "integration-wave-000001-selection.json"),
      `${JSON.stringify({
        selectedTasks: [{ taskId: greenTask.taskId }],
      })}\n`,
    );
    expect(
      reconcileControllerAction({
        action: integrateAction,
        observe: () =>
          normalizeControllerSnapshot({
            ...snapshot,
            waves: [
              {
                headSha: "a".repeat(40),
                identity: "exact",
                inspection: "running",
                integrationId: "wave-000001",
                ownershipId: "wave-owner",
                runId: "wave-run",
              },
            ],
          }),
        stateRoot: integrationRoot,
      }),
    ).toEqual({ kind: "unresolved" });
    rmSync(promotionRoot, { force: true, recursive: true });
    rmSync(integrationRoot, { force: true, recursive: true });
  });

  it("reconciles exact wave authority and rejects head, hash, and ownership drift", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-exact-wave-"));
    const fixture = exactWaveFixture(root);
    const policy = {
      maximumBatchSize: 10,
      minimumBatchSize: 1,
      totalActiveCapacity: 12,
    } as const;
    const running = normalizeControllerSnapshot({
      ...snapshot,
      waves: [
        {
          headSha: fixture.baseSha,
          identity: "exact",
          inspection: "running",
          integrationId: fixture.integrationId,
          ownershipId: fixture.record.reservationToken,
          runId: fixture.record.runId,
        },
      ],
    });
    const green = normalizeControllerSnapshot({
      ...snapshot,
      tasks: [
        {
          admission: "admissible",
          headSha: fixture.taskHeadSha,
          status: "lane_green",
          taskId: fixture.task.taskId,
        },
      ],
    });
    const integrateAction = planControllerTick(green, policy, manifest)[0];
    if (!integrateAction) throw new Error("exact integrate action missing");
    expect(
      reconcileControllerAction({
        action: integrateAction,
        observe: () => running,
        stateRoot: root,
      }),
    ).toEqual({ kind: "succeeded" });
    expect(
      reconcileControllerAction({
        action: { ...integrateAction, actionId: "0".repeat(64) },
        observe: () => running,
        stateRoot: root,
      }),
    ).toEqual({ kind: "unresolved" });
    expect(
      reconcileControllerAction({
        action: {
          ...integrateAction,
          sourceHeadShas: ["e".repeat(40)],
        },
        observe: () => running,
        stateRoot: root,
      }),
    ).toEqual({ kind: "unresolved" });
    expect(
      reconcileControllerAction({
        action: integrateAction,
        observe: () =>
          normalizeControllerSnapshot({
            ...snapshot,
            waves: [
              {
                ...running.waves[0],
                identity: "exact",
                inspection: "running",
                integrationId: fixture.integrationId,
                ownershipId: "wrong-owner",
              },
            ],
          }),
        stateRoot: root,
      }),
    ).toEqual({ kind: "unresolved" });

    const evidence = join(
      root,
      "evidence",
      "integration",
      fixture.integrationId,
    );
    writeJson(join(evidence, "integration-result.json"), {
      baseSha: fixture.baseSha,
      headSha: fixture.waveHeadSha,
      integrationId: fixture.integrationId,
      integrationWorkdir: fixture.record.workdir,
      schemaVersion: "maestro-brain-integration-result/v3",
      selectionFileSha256: fixture.record.selectionFileSha256,
      selectionPayloadSha256: fixture.record.selectionPayloadSha256,
      status: "passed",
    });
    const exactPromotion = {
      at: "2026-07-22T00:00:00.000Z",
      baseSha: fixture.baseSha,
      headSha: fixture.waveHeadSha,
      integrationId: fixture.integrationId,
      schemaVersion: "maestro-brain-integration-wave-promotion/v3",
      selectionFileSha256: fixture.record.selectionFileSha256,
      selectionPayloadSha256: fixture.record.selectionPayloadSha256,
      status: "promoted",
    };
    writeJson(join(evidence, "promotion.json"), exactPromotion);
    const promotable = normalizeControllerSnapshot({
      ...snapshot,
      waves: [
        {
          headSha: fixture.waveHeadSha,
          identity: "exact",
          inspection: "succeeded",
          integrationId: fixture.integrationId,
          ownershipId: fixture.record.reservationToken,
          runId: fixture.record.runId,
        },
      ],
    });
    const promoteAction = planControllerTick(promotable, policy, manifest)[0];
    if (!promoteAction) throw new Error("exact promote action missing");
    const promoted = normalizeControllerSnapshot({
      ...snapshot,
      controlHeadSha: fixture.waveHeadSha,
    });
    const reconcilePromotion = () =>
      reconcileControllerAction({
        action: promoteAction,
        isAncestor: () => true,
        observe: () => promoted,
        stateRoot: root,
      });
    expect(reconcilePromotion()).toEqual({ kind: "succeeded" });
    expect(
      reconcileControllerAction({
        action: promoteAction,
        isAncestor: () => false,
        observe: () => promoted,
        stateRoot: root,
      }),
    ).toEqual({ kind: "unresolved" });
    writeJson(join(evidence, "promotion.json"), {
      ...exactPromotion,
      headSha: "e".repeat(40),
    });
    expect(reconcilePromotion()).toEqual({ kind: "unresolved" });
    writeJson(join(evidence, "promotion.json"), exactPromotion);
    writeJson(fixture.recordPath, {
      ...fixture.record,
      selectionFileSha256: "f".repeat(64),
    });
    expect(reconcilePromotion()).toEqual({ kind: "unresolved" });
    const missingRunIds = Object.fromEntries(
      Object.entries(fixture.record).filter(([key]) => key !== "runIds"),
    );
    writeJson(fixture.recordPath, missingRunIds);
    expect(reconcilePromotion()).toEqual({ kind: "unresolved" });
    writeJson(fixture.recordPath, {
      ...fixture.record,
      runIds: ["different-run"],
    });
    expect(reconcilePromotion()).toEqual({ kind: "unresolved" });
    writeJson(fixture.recordPath, {
      ...fixture.record,
      workdir: "relative/wave-workdir",
    });
    expect(reconcilePromotion()).toEqual({ kind: "unresolved" });
    writeJson(fixture.recordPath, fixture.record);
    writeJson(join(evidence, "integration-result.json"), {
      baseSha: fixture.baseSha,
      headSha: fixture.waveHeadSha,
      integrationId: fixture.integrationId,
      integrationWorkdir: resolve(root, "different-workdir"),
      schemaVersion: "maestro-brain-integration-result/v3",
      selectionFileSha256: fixture.record.selectionFileSha256,
      selectionPayloadSha256: fixture.record.selectionPayloadSha256,
      status: "passed",
    });
    expect(reconcilePromotion()).toEqual({ kind: "unresolved" });
    rmSync(root, { force: true, recursive: true });
  });

  it("stops the real watch loop before a second mutation after SIGINT", async () => {
    let state = 0;
    let stopRequested = false;
    let executions = 0;
    const dispose = installControllerSignalHandlers(() => {
      stopRequested = true;
    });
    const runtime: ControllerCliRuntime & {
      readonly stopRequested: () => boolean;
    } = {
      acquireLock: () => () => undefined,
      appendTelemetry: () => undefined,
      execute: ({ action, tickId }) => {
        executions += 1;
        state += 1;
        process.emit("SIGINT");
        return {
          actionId: action.actionId,
          kind: action.kind,
          schemaVersion: "maestro-brain-controller-action-receipt/v1",
          status: "succeeded",
          tickId,
        };
      },
      manifest: () => manifest,
      now: () => "2026-07-18T00:00:00.000Z",
      observe: () =>
        state === 0
          ? normalizeControllerSnapshot({
              ...snapshot,
              tasks: [
                {
                  runId: "terminal-run",
                  status: "terminal",
                  taskId: "S01-T02",
                },
              ],
            })
          : normalizeControllerSnapshot({
              ...snapshot,
              tasks: [
                { status: "accepted", taskId: "S00-T01" },
                { status: "pending", taskId: "S00-T02" },
              ],
            }),
      sleep: async () => false,
      stopRequested: () => stopRequested,
    };
    try {
      await runControllerCli(
        parseControllerCliArgs([
          "--watch",
          "--interval-ms",
          "1000",
          "--state",
          stateRoot,
        ]),
        runtime,
      );
      expect(executions).toBe(1);
    } finally {
      dispose();
    }
  });

  it("strictly parses once/watch, policy, interval, and recovery flags", () => {
    expect(
      parseControllerCliArgs(["--once", "--dry-run", "--state", stateRoot]),
    ).toMatchObject({ dryRun: true, mode: "once", stateRoot });
    expect(
      parseControllerCliArgs([
        "--watch",
        "--interval-ms",
        "1000",
        "--state",
        stateRoot,
        "--max-active",
        "4",
        "--batch-max",
        "3",
        "--batch-min",
        "2",
      ]),
    ).toMatchObject({
      intervalMs: 1000,
      mode: "watch",
      policy: {
        maximumBatchSize: 3,
        minimumBatchSize: 2,
        totalActiveCapacity: 4,
      },
    });
    expect(
      parseControllerCliArgs([
        "--",
        "--once",
        "--dry-run",
        "--state",
        ".fabro/state/maestro-brain",
      ]).stateRoot,
    ).toBe(resolve(".fabro/state/maestro-brain"));
    for (const args of [
      ["--once", "--watch", "--state", stateRoot],
      ["--once", "--interval-ms", "1000", "--state", stateRoot],
      ["--watch", "--interval-ms", "999", "--state", stateRoot],
      ["--watch", "--interval-ms", "3600001", "--state", stateRoot],
      ["--watch", "--dry-run", "--interval-ms", "1000", "--state", stateRoot],
      ["--once", "--state", stateRoot, "--unknown"],
      ["--once", "--state", stateRoot, "--recover-controller-lock"],
      [
        "--once",
        "--dry-run",
        "--state",
        stateRoot,
        "--recover-controller-lock",
        "--recovery-reason",
        "stale owner",
      ],
    ]) {
      expect(() => parseControllerCliArgs(args)).toThrow();
    }
  });

  it("produces byte-identical dry-runs without locks, telemetry, or writes", async () => {
    let mutations = 0;
    const runtime: ControllerCliRuntime = {
      acquireLock: () => {
        mutations += 1;
        return () => undefined;
      },
      appendTelemetry: () => {
        mutations += 1;
      },
      execute: () => {
        mutations += 1;
        throw new Error("dry-run executed an action");
      },
      manifest: () => manifest,
      now: () => "2026-07-18T00:00:00.000Z",
      observe: () =>
        normalizeControllerSnapshot({
          ...snapshot,
          tasks: [
            { status: "accepted", taskId: "S00-T01" },
            { status: "pending", taskId: "S00-T02" },
          ],
        }),
      sleep: async () => false,
    };
    const options = parseControllerCliArgs([
      "--once",
      "--dry-run",
      "--state",
      stateRoot,
    ]);
    const first = await runControllerCli(options, runtime);
    const second = await runControllerCli(options, runtime);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatch(
      /^\{"actions":.+"schemaVersion":"maestro-brain-controller-dry-run\/v1"/,
    );
    expect(first[0]).not.toContain("2026-07-18");
    expect(mutations).toBe(0);
  });

  it("holds one watch lock, never overlaps ticks, and appends redacted telemetry", async () => {
    let locked = false;
    let active = 0;
    let maximumActive = 0;
    let executions = 0;
    let sleeps = 0;
    const telemetry: unknown[] = [];
    const runtime: ControllerCliRuntime = {
      acquireLock: () => {
        expect(locked).toBe(false);
        locked = true;
        return () => {
          locked = false;
        };
      },
      appendTelemetry: (value) => telemetry.push(value),
      execute: async ({ action, tickId }) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        executions += 1;
        await Promise.resolve();
        active -= 1;
        return {
          actionId: action.actionId,
          kind: action.kind,
          schemaVersion: "maestro-brain-controller-action-receipt/v1",
          status: "succeeded",
          tickId,
        } satisfies ControllerActionReceipt;
      },
      manifest: () => manifest,
      now: () => "2026-07-18T00:00:00.000Z",
      observe: () =>
        normalizeControllerSnapshot({
          ...snapshot,
          tasks: [
            { status: "accepted", taskId: "S00-T01" },
            { status: "pending", taskId: "S00-T02" },
          ],
        }),
      sleep: async () => {
        sleeps += 1;
        return sleeps < 2;
      },
    };
    const output = await runControllerCli(
      parseControllerCliArgs([
        "--watch",
        "--interval-ms",
        "1000",
        "--state",
        stateRoot,
      ]),
      runtime,
    );
    expect(executions).toBe(2);
    expect(maximumActive).toBe(1);
    expect(output).toHaveLength(2);
    expect(telemetry).toHaveLength(2);
    expect(JSON.stringify(telemetry)).not.toContain("payload");
    expect(locked).toBe(false);
  });

  it("requires explicit audited controller-lock recovery", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-cli-lock-"));
    const lockPath = join(root, "controller", "controller.lock");
    const auditPath = join(root, "controller", "lock-recovery.jsonl");
    const release = acquireControllerLock({
      auditPath,
      lockPath,
      now: "2026-07-18T00:00:00.000Z",
      owner: { action: "test-owner", pid: 1 },
    });
    expect(() =>
      acquireControllerLock({
        auditPath,
        lockPath,
        now: "2026-07-18T00:01:00.000Z",
        owner: { action: "second-owner", pid: 2 },
      }),
    ).toThrow("explicit audited recovery");
    const releaseRecovered = acquireControllerLock({
      auditPath,
      lockPath,
      now: "2026-07-18T00:02:00.000Z",
      owner: { action: "recovered-owner", pid: 3 },
      recoveryReason: "operator confirmed the prior process exited",
    });
    expect(readFileSync(auditPath, "utf8")).toContain("test-owner");
    releaseRecovered();
    release();
    expect(existsSync(lockPath)).toBe(false);
    rmSync(root, { force: true, recursive: true });
  });

  it("registers the checked package command", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "../../package.json"), "utf8"),
    ) as { readonly scripts?: Record<string, string> };
    expect(packageJson.scripts?.["brain:factory:control"]).toBe(
      "tsx tooling/brain-factory/src/controller.mts",
    );
  });

  it.each(["SIGINT", "SIGTERM"] as const)(
    "%s stops watch mode and removes its handler",
    (signal) => {
      let stopped = 0;
      const before = process.listenerCount(signal);
      const dispose = installControllerSignalHandlers(() => {
        stopped += 1;
      });
      expect(process.listenerCount(signal)).toBe(before + 1);
      process.emit(signal);
      expect(stopped).toBe(1);
      dispose();
      expect(process.listenerCount(signal)).toBe(before);
    },
  );
});
