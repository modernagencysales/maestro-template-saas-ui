import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import {
  canonicalControllerJson,
  commandForControllerAction,
  executeControllerTick as executeControllerTickRaw,
  planControllerTick as planControllerTickRaw,
  taskCapacityDiagnostics,
  telemetryForControllerAction,
  tickIdForController,
  type ControllerAction,
  type ControllerPolicy,
} from "../src/controller.js";
import { buildManifest, type BrainTaskManifest } from "../src/manifest.js";
import {
  normalizeControllerSnapshot,
  type ControllerSnapshot,
  type ControllerTaskObservation,
  type ControllerWaveObservation,
} from "../src/factory-state.js";

const git = "a".repeat(40);
const sha = "b".repeat(64);
const policy: ControllerPolicy = {
  maximumBatchSize: 4,
  minimumBatchSize: 1,
  totalActiveCapacity: 10,
};
const manifest = buildManifest();
const planControllerTick = (
  observed: ControllerSnapshot,
  controllerPolicy: ControllerPolicy,
  selectedManifest: BrainTaskManifest = manifest,
) =>
  (
    planControllerTickRaw as unknown as (
      snapshot: ControllerSnapshot,
      policy: ControllerPolicy,
      manifest: BrainTaskManifest,
    ) => ReturnType<typeof planControllerTickRaw>
  )(observed, controllerPolicy, selectedManifest);
const executeControllerTick = (
  input: Omit<Parameters<typeof executeControllerTickRaw>[0], "manifest">,
) =>
  executeControllerTickRaw({
    ...input,
    manifest,
  } as Parameters<typeof executeControllerTickRaw>[0]);

const snapshot = (
  input: {
    readonly errors?: ControllerSnapshot["providerErrors"];
    readonly gate?: ControllerSnapshot["gateQueue"];
    readonly tasks?: readonly ControllerTaskObservation[];
    readonly waves?: readonly ControllerWaveObservation[];
  } = {},
): ControllerSnapshot =>
  normalizeControllerSnapshot({
    controlHeadSha: git,
    gateQueue: input.gate ?? { capacity: 2, inUse: 0, waiting: 0 },
    manifestSha256: sha,
    planSha256: manifest.planSha256,
    providerErrors: input.errors ?? [],
    tasks: input.tasks ?? [],
    waves: input.waves ?? [],
  });

const task = (
  taskId: string,
  status: ControllerTaskObservation["status"],
  extra: Partial<ControllerTaskObservation> = {},
): ControllerTaskObservation => ({ status, taskId, ...extra });

const wave = (
  integrationId: string,
  inspection: ControllerWaveObservation["inspection"],
): ControllerWaveObservation => ({
  headSha: "d".repeat(40),
  identity: "exact",
  inspection,
  integrationId,
  ownershipId: `owner-${integrationId}`,
  runId: `run-${integrationId}`,
});

const frontier = (): readonly ControllerTaskObservation[] => [
  task("S00-T01", "accepted"),
  task("S00-T02", "pending"),
  task("S01-T01", "pending"),
  task("S02-T01", "pending"),
];

describe("controller pure planner", () => {
  it("produces byte-identical plans and IDs for normalized input", () => {
    const left = snapshot({
      errors: [
        { category: "unavailable", provider: "fabro" },
        { category: "malformed", provider: "git" },
      ],
      tasks: [task("S01-T01", "pending"), task("S00-T02", "pending")],
    });
    const right = snapshot({
      errors: [...left.providerErrors].reverse(),
      tasks: [...left.tasks].reverse(),
    });
    const first = planControllerTick(left, policy);
    const second = planControllerTick(right, { ...policy });
    expect(canonicalControllerJson(first)).toBe(
      canonicalControllerJson(second),
    );
    expect(tickIdForController(left, policy)).toBe(
      tickIdForController(right, policy),
    );
  });

  it("archives terminal ownership in a dedicated tick before recovery", () => {
    const actions = planControllerTick(
      snapshot({
        tasks: [
          task("S03-T02", "failed", {
            baseSha: "1".repeat(40),
            findingSha256: "2".repeat(64),
            headSha: "3".repeat(40),
            runId: "lane-run",
          }),
          task("S02-T02", "terminal", { runId: "terminal-b" }),
          task("S01-T02", "terminal", { runId: "terminal-a" }),
        ],
      }),
      policy,
    );
    expect(actions.map(({ kind }) => kind)).toEqual([
      "archive_terminal",
      "archive_terminal",
    ]);
    expect(actions.map(({ targetIds }) => targetIds[0])).toEqual([
      "S01-T02",
      "S02-T02",
    ]);
    const changed = planControllerTick(
      snapshot({
        tasks: [
          task("S03-T02", "failed", {
            baseSha: "1".repeat(40),
            findingSha256: "4".repeat(64),
            headSha: "3".repeat(40),
            runId: "lane-run",
          }),
        ],
      }),
      policy,
    );
    expect(changed).toMatchObject([
      { kind: "recover_lane", targetIds: ["S03-T02"] },
    ]);
  });

  it("fails closed on false green and provider errors without coupling coding to gates", () => {
    const falseGreen = planControllerTick(
      snapshot({
        tasks: [task("S04-T01", "lane_green", { admission: "rejected" })],
      }),
      policy,
    );
    expect(falseGreen).toMatchObject([
      { kind: "wait", targetIds: ["false_green:S04-T01"] },
    ]);
    expect(
      planControllerTick(
        snapshot({ errors: [{ category: "unavailable", provider: "fabro" }] }),
        policy,
      ),
    ).toMatchObject([
      { kind: "wait", targetIds: ["provider_error:fabro:unavailable"] },
    ]);
    expect(
      planControllerTick(
        snapshot({
          gate: { capacity: 1, inUse: 1, waiting: 2 },
          tasks: frontier(),
        }),
        policy,
      ),
    ).toMatchObject([
      {
        kind: "dispatch_tasks",
        targetIds: ["S00-T02", "S01-T01", "S02-T01"],
      },
    ]);
  });

  it("serializes promotion and recovery without suppressing unrelated dispatch", () => {
    expect(
      planControllerTick(
        snapshot({ waves: [wave("wave-1", "succeeded")] }),
        policy,
      )[0],
    ).toMatchObject({
      kind: "promote_wave",
      targetIds: ["wave-1"],
    });
    expect(
      planControllerTick(
        snapshot({ waves: [wave("wave-2", "failed")] }),
        policy,
      )[0],
    ).toMatchObject({
      kind: "recover_wave",
      targetIds: ["wave-2"],
    });
    expect(
      planControllerTick(
        snapshot({ tasks: frontier(), waves: [wave("wave-3", "running")] }),
        policy,
      )[0],
    ).toMatchObject({
      kind: "dispatch_tasks",
      targetIds: ["S00-T02", "S01-T01", "S02-T01"],
    });
  });

  it("separates coding capacity from retained ownership", () => {
    const green = manifest.tasks.slice(0, 7).map(({ taskId }, index) =>
      task(taskId, "lane_green", {
        admission: "admissible",
        headSha: String(index + 1).repeat(40),
        ownershipId: `owner-${taskId}`,
      }),
    );
    expect(taskCapacityDiagnostics(snapshot({ tasks: green }))).toEqual({
      active: green.map(({ taskId }) => taskId).sort(),
      codingActive: [],
      owned: green.map(({ taskId }) => taskId).sort(),
    });
  });

  it("batches sorted admissible lanes within policy and suppresses dispatch", () => {
    const actions = planControllerTick(
      snapshot({
        tasks: [
          task("S04-T02", "lane_green", {
            admission: "admissible",
            headSha: "4".repeat(40),
          }),
          task("S03-T03", "lane_green", {
            admission: "admissible",
            headSha: "3".repeat(40),
          }),
          ...frontier(),
        ],
      }),
      { ...policy, maximumBatchSize: 1 },
    );
    expect(actions).toMatchObject([
      { kind: "integrate_batch", targetIds: ["S03-T03"] },
    ]);
  });

  it("selects the maximum compatible green batch instead of a greedy prefix", () => {
    const product = manifest.tasks
      .filter(({ kind }) => kind === "product")
      .slice(0, 6);
    expect(product).toHaveLength(6);
    const locks = [
      ["shared-left.ts", "shared-right.ts"],
      ["shared-left.ts"],
      ["shared-right.ts"],
      ["independent-d.ts"],
      ["independent-e.ts"],
      ["independent-f.ts"],
    ];
    const selectedManifest = {
      ...manifest,
      tasks: product.map((item, index) => ({
        ...item,
        fileLocks: locks[index] ?? [],
      })),
    };
    const actions = planControllerTick(
      snapshot({
        tasks: product.map(({ taskId }, index) =>
          task(taskId, "lane_green", {
            admission: "admissible",
            headSha: String(index + 1).repeat(40),
          }),
        ),
      }),
      { ...policy, maximumBatchSize: 10, minimumBatchSize: 5 },
      selectedManifest,
    );
    expect(actions).toMatchObject([
      {
        kind: "integrate_batch",
        targetIds: product.slice(1).map(({ taskId }) => taskId),
      },
    ]);
  });

  it("bounds large conflicting frontiers to a deterministic candidate window", () => {
    const template = manifest.tasks.find(({ kind }) => kind === "product");
    if (!template) throw new Error("product task template missing");
    const tasks = Array.from({ length: 30 }, (_, index) => ({
      ...template,
      fileLocks:
        index < 8
          ? [`independent-${index}.ts`]
          : index < 20
            ? ["window-conflict.ts"]
            : [`outside-window-${index}.ts`],
      taskId: `S20-T${String(index + 1).padStart(2, "0")}`,
    }));
    const selectedManifest = { ...manifest, tasks };
    const started = performance.now();
    const actions = planControllerTick(
      snapshot({
        tasks: tasks.map(({ taskId }, index) =>
          task(taskId, "lane_green", {
            admission: "admissible",
            headSha: ((index % 15) + 1).toString(16).repeat(40),
          }),
        ),
      }),
      { ...policy, maximumBatchSize: 10, minimumBatchSize: 5 },
      selectedManifest,
    );
    expect(performance.now() - started).toBeLessThan(250);
    expect(actions).toMatchObject([
      {
        kind: "integrate_batch",
        targetIds: [
          ...tasks.slice(0, 8).map(({ taskId }) => taskId),
          tasks[8]?.taskId,
        ],
      },
    ]);
  });

  it("delegates remaining capacity to the manifest scheduler", () => {
    const actions = planControllerTick(snapshot({ tasks: frontier() }), {
      ...policy,
      totalActiveCapacity: 2,
    });
    expect(actions).toMatchObject([
      { kind: "dispatch_tasks", targetIds: ["S00-T02", "S01-T01"] },
    ]);
  });

  it("routes owner rework while continuing unrelated dispatch", () => {
    const ownerRework = {
      ...wave("wave-000042", "failed"),
      findingSha256: "1".repeat(64),
      ownerTaskIds: ["S04-T04"],
      resultSha256: "2".repeat(64),
      selectionFileSha256: "3".repeat(64),
      selectionPayloadSha256: "4".repeat(64),
    } as const;
    const actions = planControllerTick(
      snapshot({ tasks: frontier(), waves: [ownerRework] }),
      { ...policy, totalActiveCapacity: 2 },
    );

    expect(actions).toMatchObject([
      {
        kind: "route_owner_rework",
        targetIds: ["S04-T04", "wave-000042"],
      },
      { kind: "dispatch_tasks", targetIds: ["S00-T02"] },
    ]);
    const routeAction = actions[0];
    if (!routeAction) throw new Error("route owner rework action missing");
    const command = commandForControllerAction(routeAction, "/tmp/state");
    expect(command).toEqual(
      expect.arrayContaining([
        "brain:factory:route-rework",
        "--integration-id",
        "wave-000042",
        "--result-sha256",
        "2".repeat(64),
        "--selection-file-sha256",
        "3".repeat(64),
        "--selection-payload-sha256",
        "4".repeat(64),
      ]),
    );
  });

  it("reserves every owner repair launch from unrelated coding capacity", () => {
    const actions = planControllerTick(
      snapshot({
        tasks: frontier(),
        waves: [
          {
            ...wave("wave-000043", "failed"),
            findingSha256: "1".repeat(64),
            ownerTaskIds: ["S04-T04", "S05-T01"],
            resultSha256: "2".repeat(64),
            selectionFileSha256: "3".repeat(64),
            selectionPayloadSha256: "4".repeat(64),
          },
        ],
      }),
      { ...policy, totalActiveCapacity: 2 },
    );

    expect(actions).toMatchObject([
      {
        kind: "route_owner_rework",
        targetIds: ["S04-T04", "S05-T01", "wave-000043"],
      },
    ]);
    expect(actions).toHaveLength(1);
  });

  it("defers an owner wave wider than total capacity while dispatching unrelated work", () => {
    const actions = planControllerTick(
      snapshot({
        tasks: frontier(),
        waves: [
          {
            ...wave("wave-000044", "failed"),
            findingSha256: "1".repeat(64),
            ownerTaskIds: ["S04-T04", "S05-T01", "S06-T01"],
            resultSha256: "2".repeat(64),
            selectionFileSha256: "3".repeat(64),
            selectionPayloadSha256: "4".repeat(64),
          },
        ],
      }),
      { ...policy, totalActiveCapacity: 2 },
    );

    expect(actions).toMatchObject([
      { kind: "dispatch_tasks", targetIds: ["S00-T02", "S01-T01"] },
      {
        kind: "wait",
        targetIds: ["owner_rework_capacity_exceeded:wave-000044:3>2"],
      },
    ]);
  });

  it("uses only the injected manifest contract for frontier selection", () => {
    const selectedManifest = {
      ...manifest,
      tasks: manifest.tasks.filter(({ taskId }) => taskId === "S00-T02"),
    };
    const actions = planControllerTick(
      snapshot({ tasks: frontier() }),
      { ...policy, totalActiveCapacity: 2 },
      selectedManifest,
    );
    expect(actions).toMatchObject([
      { kind: "dispatch_tasks", targetIds: ["S00-T02"] },
    ]);
  });

  it("waits when any integration wave identity is unknown", () => {
    const actions = planControllerTick(
      snapshot({
        waves: [
          wave("wave-000001", "succeeded"),
          {
            ...wave("wave-000002", "unknown"),
            identity: "unknown",
          },
        ],
      }),
      policy,
    );
    expect(actions).toMatchObject([
      {
        kind: "wait",
        targetIds: ["integration_unknown:wave-000002"],
      },
    ]);
  });

  it("returns one stable wait for an empty frontier", () => {
    expect(planControllerTick(snapshot(), policy)).toMatchObject([
      { kind: "wait", targetIds: ["frontier_empty"] },
    ]);
  });
});

describe("controller audited executor", () => {
  const dispatchAction = (): ControllerAction => {
    const action = planControllerTick(snapshot({ tasks: frontier() }), {
      ...policy,
      totalActiveCapacity: 1,
    })[0];
    if (!action) throw new Error("missing action fixture");
    return action;
  };

  it("maps every mutating action to argument-safe checked commands", () => {
    const stateRoot = "/tmp/state";
    const cases = [
      planControllerTick(
        snapshot({
          tasks: [task("S02-T02", "terminal", { runId: "terminal-run" })],
        }),
        policy,
      )[0],
      planControllerTick(snapshot({ tasks: frontier() }), policy)[0],
      planControllerTick(
        snapshot({ waves: [wave("wave-pass", "succeeded")] }),
        policy,
      )[0],
      planControllerTick(
        snapshot({ waves: [wave("wave-fail", "failed")] }),
        policy,
      )[0],
      planControllerTick(
        snapshot({
          tasks: [
            task("S03-T03", "lane_green", {
              admission: "admissible",
              headSha: "3".repeat(40),
            }),
          ],
        }),
        policy,
      )[0],
      planControllerTick(
        snapshot({
          tasks: [
            task("S03-T02", "failed", {
              baseSha: "f".repeat(40),
              findingSha256: "2".repeat(64),
              headSha: "1".repeat(40),
            }),
          ],
        }),
        policy,
      )[0],
    ].filter((value): value is ControllerAction => value !== undefined);
    for (const action of cases) {
      const command = commandForControllerAction(action, stateRoot);
      expect(command?.[0]).toBe("pnpm");
      expect(command).not.toContain(expect.stringContaining(";"));
      if (action.kind === "recover_lane") {
        expect(command?.[command.indexOf("--ref") + 1]).toBe("1".repeat(40));
        expect(command?.[command.indexOf("--base") + 1]).toBe("f".repeat(40));
      }
      if (action.kind === "archive_terminal") {
        expect(command).toContain("brain:factory:archive-terminal");
        expect(command?.[command.indexOf("--run") + 1]).toBe("terminal-run");
        expect(command?.[command.indexOf("--action-id") + 1]).toBe(
          action.actionId,
        );
      }
      if (action.kind === "dispatch_tasks") {
        expect(command?.[command.indexOf("--max") + 1]).toBe("10");
      }
    }
  });

  it("writes immutable tick/action receipts and skips succeeded replay", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-"));
    const observed = snapshot({ tasks: frontier() });
    let calls = 0;
    const run = () => {
      calls += 1;
      return { exitCode: 0, stderr: "", stdout: "launched" };
    };
    const reconcile = () =>
      ({ kind: calls > 0 ? "succeeded" : "not-started" }) as const;
    const first = executeControllerTick({
      action: dispatchAction(),
      now: "2026-07-18T00:00:00.000Z",
      observe: () => observed,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile,
      run,
      stateRoot: root,
    });
    const replay = executeControllerTick({
      action: dispatchAction(),
      now: "2026-07-18T00:01:00.000Z",
      observe: () => observed,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile,
      run,
      stateRoot: root,
    });
    expect(first.status).toBe("succeeded");
    expect(replay).toEqual(first);
    expect(calls).toBe(1);
  });

  it("reconciles reserved/executing crashes without duplicate child launch", () => {
    for (const status of ["reserved", "executing"] as const) {
      const root = mkdtempSync(join(tmpdir(), "brain-controller-crash-"));
      const observed = snapshot({ tasks: frontier() });
      const action = dispatchAction();
      const actionPath = join(
        root,
        "controller",
        "actions",
        `${action.actionId}.json`,
      );
      expect(() =>
        executeControllerTick({
          action,
          afterReceiptTransition: (receipt) => {
            if (receipt.status === status) throw new Error("simulated crash");
          },
          now: "2026-07-18T00:00:00.000Z",
          observe: () => observed,
          plannedSnapshot: observed,
          policy: { ...policy, totalActiveCapacity: 1 },
          reconcile: () => ({ kind: "not-started" }),
          run: () => ({ exitCode: 0, stderr: "", stdout: "unused" }),
          stateRoot: root,
        }),
      ).toThrow("simulated crash");
      let calls = 0;
      const replay = executeControllerTick({
        action,
        now: "2026-07-18T00:01:00.000Z",
        observe: () => observed,
        plannedSnapshot: observed,
        policy: { ...policy, totalActiveCapacity: 1 },
        reconcile: () => ({ kind: "succeeded" }),
        run: () => {
          calls += 1;
          return { exitCode: 0, stderr: "", stdout: "bad" };
        },
        stateRoot: root,
      });
      expect(replay.status).toBe("succeeded");
      expect(calls).toBe(0);
      expect(JSON.parse(readFileSync(actionPath, "utf8"))).toMatchObject({
        status: "succeeded",
      });
    }
  });

  it("supersedes control drift and rejects success without durable proof", () => {
    const observed = snapshot({ tasks: frontier() });
    const drifted = { ...observed, controlHeadSha: "f".repeat(40) };
    let calls = 0;
    const drift = executeControllerTick({
      action: dispatchAction(),
      now: "2026-07-18T00:00:00.000Z",
      observe: () => drifted,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile: () => ({ kind: "not-started" }),
      run: () => {
        calls += 1;
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      stateRoot: mkdtempSync(join(tmpdir(), "brain-controller-drift-")),
    });
    expect(drift.status).toBe("superseded");
    expect(calls).toBe(0);

    const failed = executeControllerTick({
      action: dispatchAction(),
      now: "2026-07-18T00:00:00.000Z",
      observe: () => observed,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile: () => ({ kind: "not-started" }),
      run: () => ({
        exitCode: 0,
        stderr: "secret provider payload",
        stdout: "",
      }),
      stateRoot: mkdtempSync(join(tmpdir(), "brain-controller-unproved-")),
    });
    expect(failed.status).toBe("failed");
    expect(JSON.stringify(failed)).not.toContain("secret provider payload");
  });

  it("retries a failed receipt after a fresh matching observation", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-retry-"));
    const observed = snapshot({ tasks: frontier() });
    let calls = 0;
    const run = () => {
      calls += 1;
      return {
        exitCode: calls === 1 ? 1 : 0,
        stderr: "provider unavailable",
        stdout: "",
      };
    };
    const reconcile = () =>
      ({ kind: calls >= 2 ? "succeeded" : "not-started" }) as const;
    const first = executeControllerTick({
      action: dispatchAction(),
      now: "2026-07-18T00:00:00.000Z",
      observe: () => observed,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile,
      run,
      stateRoot: root,
    });
    const second = executeControllerTick({
      action: dispatchAction(),
      now: "2026-07-18T00:01:00.000Z",
      observe: () => observed,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile,
      run,
      stateRoot: root,
    });
    expect(first.status).toBe("failed");
    expect(second.status).toBe("succeeded");
    expect(calls).toBe(2);
  });

  it("rejects conflicting same-ID receipts", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-corrupt-"));
    const action = dispatchAction();
    const dir = join(root, "controller", "actions");
    expect(() =>
      executeControllerTick({
        action,
        afterReceiptTransition: (receipt) => {
          if (receipt.status === "reserved") throw new Error("simulated crash");
        },
        now: "2026-07-18T00:00:00.000Z",
        observe: () => snapshot({ tasks: frontier() }),
        plannedSnapshot: snapshot({ tasks: frontier() }),
        policy: { ...policy, totalActiveCapacity: 1 },
        reconcile: () => ({ kind: "not-started" }),
        run: () => ({ exitCode: 0, stderr: "", stdout: "" }),
        stateRoot: root,
      }),
    ).toThrow("simulated crash");
    const path = join(dir, `${action.actionId}.json`);
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(
      path,
      JSON.stringify({ ...receipt, actionId: "x".repeat(64) }),
    );
    expect(() =>
      executeControllerTick({
        action,
        now: "2026-07-18T00:00:00.000Z",
        observe: () => snapshot({ tasks: frontier() }),
        plannedSnapshot: snapshot({ tasks: frontier() }),
        policy: { ...policy, totalActiveCapacity: 1 },
        reconcile: () => ({ kind: "not-started" }),
        run: () => ({ exitCode: 0, stderr: "", stdout: "" }),
        stateRoot: root,
      }),
    ).toThrow("action receipt identity mismatch");
  });

  it("rejects execution of an action absent from the immutable tick", () => {
    const observed = snapshot({ tasks: frontier() });
    const action = { ...dispatchAction(), actionId: "9".repeat(64) };
    expect(() =>
      executeControllerTick({
        action,
        now: "2026-07-18T00:00:00.000Z",
        observe: () => observed,
        plannedSnapshot: observed,
        policy: { ...policy, totalActiveCapacity: 1 },
        reconcile: () => ({ kind: "not-started" }),
        run: () => ({ exitCode: 0, stderr: "", stdout: "" }),
        stateRoot: mkdtempSync(join(tmpdir(), "brain-controller-unplanned-")),
      }),
    ).toThrow("not present in planned tick");
  });

  it("rejects same-ID action field drift", () => {
    const observed = snapshot({ tasks: frontier() });
    const action = { ...dispatchAction(), totalActiveCapacity: 99 };
    expect(() =>
      executeControllerTick({
        action,
        now: "2026-07-18T00:00:00.000Z",
        observe: () => observed,
        plannedSnapshot: observed,
        policy: { ...policy, totalActiveCapacity: 1 },
        reconcile: () => ({ kind: "not-started" }),
        run: () => ({ exitCode: 0, stderr: "", stdout: "" }),
        stateRoot: mkdtempSync(
          join(tmpdir(), "brain-controller-drifted-action-"),
        ),
      }),
    ).toThrow("action bytes differ from planned tick");
  });

  it("finishes an interrupted exact receipt rename", () => {
    const root = mkdtempSync(join(tmpdir(), "brain-controller-next-"));
    const observed = snapshot({ tasks: frontier() });
    const action = dispatchAction();
    expect(() =>
      executeControllerTick({
        action,
        afterReceiptTransition: (receipt) => {
          if (receipt.status === "reserved") throw new Error("simulated crash");
        },
        now: "2026-07-18T00:00:00.000Z",
        observe: () => observed,
        plannedSnapshot: observed,
        policy: { ...policy, totalActiveCapacity: 1 },
        reconcile: () => ({ kind: "not-started" }),
        run: () => ({ exitCode: 0, stderr: "", stdout: "" }),
        stateRoot: root,
      }),
    ).toThrow("simulated crash");
    const path = join(root, "controller", "actions", `${action.actionId}.json`);
    const reserved = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(
      `${path}.next`,
      `${canonicalControllerJson({ ...reserved, status: "executing" })}\n`,
    );
    let calls = 0;
    const result = executeControllerTick({
      action,
      now: "2026-07-18T00:01:00.000Z",
      observe: () => observed,
      plannedSnapshot: observed,
      policy: { ...policy, totalActiveCapacity: 1 },
      reconcile: () => ({ kind: "succeeded" }),
      run: () => {
        calls += 1;
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      stateRoot: root,
    });
    expect(result.status).toBe("succeeded");
    expect(calls).toBe(0);
  });

  it("emits redacted telemetry with stable operational metrics", () => {
    const observed = snapshot({
      errors: [{ category: "unauthorized", provider: "fabro" }],
      gate: { capacity: 3, inUse: 1, waiting: 2 },
      tasks: [task("S01-T01", "running"), task("S02-T01", "pending")],
    });
    const action = planControllerTick(observed, policy)[0];
    if (!action) throw new Error("missing telemetry action");
    const value = telemetryForControllerAction({
      action,
      durationMs: 25,
      now: "2026-07-18T00:00:00.000Z",
      outcome: "failed",
      readyToLaunchLatencyMs: 40,
      snapshot: observed,
      tickId: tickIdForController(observed, policy),
    });
    expect(value).toMatchObject({
      activeCounts: { running: 1 },
      durationMs: 25,
      gateQueue: { capacity: 3, inUse: 1, waiting: 2 },
      providerErrorCategories: ["fabro:unauthorized"],
      readyToLaunchLatencyMs: 40,
      schemaVersion: "maestro-brain-controller-telemetry/v1",
    });
    expect(JSON.stringify(value)).not.toContain("payload");
  });

  it("redacts untrusted telemetry outcome and provider tokens", () => {
    const secret = "raw-provider-secret";
    const observed = snapshot({
      errors: [
        {
          category: secret,
          provider: secret,
        } as unknown as ControllerSnapshot["providerErrors"][number],
      ],
      tasks: [task("S01-T01", "unknown")],
    });
    const action = planControllerTick(observed, policy)[0];
    if (!action) throw new Error("missing telemetry action");
    const value = telemetryForControllerAction({
      action,
      durationMs: 1,
      now: "2026-07-18T00:00:00.000Z",
      outcome: secret,
      readyToLaunchLatencyMs: 1,
      snapshot: observed,
      tickId: tickIdForController(observed, policy),
    });
    expect(value.outcome).toBe("unknown");
    expect(value.providerErrorCategories).toEqual(["unknown:unknown"]);
    expect(JSON.stringify(value)).not.toContain(secret);
  });
});
