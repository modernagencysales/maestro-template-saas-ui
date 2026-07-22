import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalControllerJson,
  executeControllerTick,
  planControllerTick,
  telemetryForControllerAction,
  tickIdForController,
  type ControllerAction,
  type ControllerActionReceipt,
  type ControllerPolicy,
} from "./controller.js";
import type { ControllerSnapshot } from "./factory-state.js";
import { readIntegrationWaveSelection } from "./integration-wave.js";
import { buildManifest, type BrainTaskManifest } from "./manifest.js";
import { gitIsAncestor } from "./process.js";
import {
  inspectFabroRun,
  observeControllerSnapshot,
} from "./controller-observation.js";

export interface ControllerCliOptions {
  readonly dryRun: boolean;
  readonly intervalMs?: number;
  readonly mode: "once" | "watch";
  readonly policy: ControllerPolicy;
  readonly recoverControllerLock: boolean;
  readonly recoveryReason?: string;
  readonly stateRoot: string;
}

const defaultPolicy: ControllerPolicy = {
  maximumBatchSize: 10,
  minimumBatchSize: 5,
  totalActiveCapacity: 12,
};

const positiveInteger = (value: string, flag: string): number => {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${flag} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${flag} is too large`);
  return parsed;
};

export const parseControllerCliArgs = (
  args: readonly string[],
): ControllerCliOptions => {
  let dryRun = false;
  let mode: "once" | "watch" | undefined;
  let intervalMs: number | undefined;
  let stateRoot: string | undefined;
  let recoverControllerLock = false;
  let recoveryReason: string | undefined;
  const policy = { ...defaultPolicy };
  const seen = new Set<string>();
  const valueAt = (index: number, flag: string): string => {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--" && index === 0) continue;
    if (!flag || !flag.startsWith("--") || seen.has(flag)) {
      throw new Error(
        `invalid or duplicate controller argument: ${flag ?? ""}`,
      );
    }
    seen.add(flag);
    if (flag === "--once" || flag === "--watch") {
      if (mode) throw new Error("--once and --watch are mutually exclusive");
      mode = flag === "--once" ? "once" : "watch";
      continue;
    }
    if (flag === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (flag === "--recover-controller-lock") {
      recoverControllerLock = true;
      continue;
    }
    if (
      flag === "--state" ||
      flag === "--interval-ms" ||
      flag === "--recovery-reason" ||
      flag === "--max-active" ||
      flag === "--batch-max" ||
      flag === "--batch-min"
    ) {
      const value = valueAt(index, flag);
      index += 1;
      if (flag === "--state") stateRoot = resolve(value);
      else if (flag === "--interval-ms")
        intervalMs = positiveInteger(value, flag);
      else if (flag === "--recovery-reason") recoveryReason = value.trim();
      else if (flag === "--max-active")
        policy.totalActiveCapacity = positiveInteger(value, flag);
      else if (flag === "--batch-max")
        policy.maximumBatchSize = positiveInteger(value, flag);
      else policy.minimumBatchSize = positiveInteger(value, flag);
      continue;
    }
    throw new Error(`unknown controller argument: ${flag}`);
  }
  if (!mode) throw new Error("exactly one of --once or --watch is required");
  if (!stateRoot) throw new Error("--state is required");
  if (mode === "once" && intervalMs !== undefined) {
    throw new Error("--interval-ms is valid only with --watch");
  }
  if (
    mode === "watch" &&
    (intervalMs === undefined || intervalMs > 3_600_000)
  ) {
    throw new Error("--watch requires --interval-ms in [1000, 3600000]");
  }
  if (mode === "watch" && (intervalMs as number) < 1_000) {
    throw new Error("--interval-ms must be at least 1000");
  }
  if (dryRun && mode !== "once") {
    throw new Error("--dry-run is valid only with --once");
  }
  if (policy.minimumBatchSize > policy.maximumBatchSize) {
    throw new Error("minimum batch size cannot exceed maximum batch size");
  }
  if (recoverControllerLock && !recoveryReason) {
    throw new Error("--recover-controller-lock requires --recovery-reason");
  }
  if (recoveryReason && !recoverControllerLock) {
    throw new Error("--recovery-reason requires --recover-controller-lock");
  }
  if (dryRun && recoverControllerLock) {
    throw new Error("dry-run cannot recover the controller lock");
  }
  return {
    dryRun,
    ...(intervalMs === undefined ? {} : { intervalMs }),
    mode,
    policy,
    recoverControllerLock,
    ...(recoveryReason ? { recoveryReason } : {}),
    stateRoot,
  };
};

export const acquireControllerLock = (input: {
  readonly auditPath: string;
  readonly lockPath: string;
  readonly now: string;
  readonly owner: Readonly<Record<string, unknown>>;
  readonly recoveryReason?: string;
}): (() => void) => {
  mkdirSync(join(input.lockPath, ".."), { recursive: true });
  if (existsSync(input.lockPath)) {
    if (!input.recoveryReason?.trim()) {
      throw new Error(
        `controller lock already exists at ${input.lockPath}; explicit audited recovery is required`,
      );
    }
    const ownerPath = join(input.lockPath, "owner.json");
    mkdirSync(join(input.auditPath, ".."), { recursive: true });
    appendFileSync(
      input.auditPath,
      `${JSON.stringify({
        action: "recover-controller-lock",
        at: input.now,
        previousOwner: existsSync(ownerPath)
          ? JSON.parse(readFileSync(ownerPath, "utf8"))
          : null,
        reason: input.recoveryReason.trim(),
      })}\n`,
      "utf8",
    );
    rmSync(input.lockPath, { recursive: true });
  }
  mkdirSync(input.lockPath, { recursive: false });
  const owner = { ...input.owner, token: randomUUID() };
  const ownerPath = join(input.lockPath, "owner.json");
  writeFileSync(ownerPath, `${JSON.stringify(owner, null, 2)}\n`, {
    flag: "wx",
  });
  return () => {
    if (!existsSync(ownerPath)) return;
    const current = JSON.parse(readFileSync(ownerPath, "utf8")) as {
      readonly token?: unknown;
    };
    if (current.token === owner.token)
      rmSync(input.lockPath, { recursive: true });
  };
};

export const installControllerSignalHandlers = (
  stop: () => void,
): (() => void) => {
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return () => {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  };
};

export interface ControllerCliRuntime {
  readonly acquireLock: (
    input: Parameters<typeof acquireControllerLock>[0],
  ) => () => void;
  readonly appendTelemetry: (
    value: ReturnType<typeof telemetryForControllerAction>,
  ) => void;
  readonly execute: (input: {
    readonly action: ControllerAction;
    readonly manifest: BrainTaskManifest;
    readonly policy: ControllerPolicy;
    readonly snapshot: ControllerSnapshot;
    readonly stateRoot: string;
    readonly tickId: string;
  }) => ControllerActionReceipt | Promise<ControllerActionReceipt>;
  readonly manifest: () => BrainTaskManifest;
  readonly now: () => string;
  readonly observe: () => ControllerSnapshot;
  readonly sleep: (intervalMs: number) => Promise<boolean>;
  readonly stopRequested?: () => boolean;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const runControllerCli = async (
  options: ControllerCliOptions,
  runtime: ControllerCliRuntime,
): Promise<readonly string[]> => {
  const output: string[] = [];
  if (options.dryRun) {
    const observed = runtime.observe();
    const manifest = runtime.manifest();
    const actions = planControllerTick(observed, options.policy, manifest);
    output.push(
      canonicalControllerJson({
        actions,
        schemaVersion: "maestro-brain-controller-dry-run/v1",
        snapshotSha256: sha256(canonicalControllerJson(observed)),
        tickId: tickIdForController(observed, options.policy),
      }),
    );
    return output;
  }
  const controllerRoot = join(options.stateRoot, "controller");
  const release = runtime.acquireLock({
    auditPath: join(controllerRoot, "lock-recovery.jsonl"),
    lockPath: join(controllerRoot, "controller.lock"),
    now: runtime.now(),
    owner: { action: `controller-${options.mode}`, pid: process.pid },
    ...(options.recoverControllerLock && options.recoveryReason
      ? { recoveryReason: options.recoveryReason }
      : {}),
  });
  try {
    let keepWatching = true;
    const stopped = (): boolean => runtime.stopRequested?.() === true;
    while (keepWatching && !stopped()) {
      const started = Date.now();
      let reachedWait = false;
      const attemptedActionIds = new Set<string>();
      while (!reachedWait && !stopped()) {
        const observed = runtime.observe();
        const manifest = runtime.manifest();
        const action = planControllerTick(
          observed,
          options.policy,
          manifest,
        )[0];
        if (!action || action.kind === "wait") {
          reachedWait = true;
          break;
        }
        if (attemptedActionIds.has(action.actionId)) {
          reachedWait = true;
          break;
        }
        attemptedActionIds.add(action.actionId);
        if (stopped()) break;
        const tickId = tickIdForController(observed, options.policy);
        const receipt = await runtime.execute({
          action,
          manifest,
          policy: options.policy,
          snapshot: observed,
          stateRoot: options.stateRoot,
          tickId,
        });
        runtime.appendTelemetry(
          telemetryForControllerAction({
            action,
            durationMs: Math.max(0, Date.now() - started),
            now: runtime.now(),
            outcome: receipt.status,
            readyToLaunchLatencyMs: 0,
            snapshot: observed,
            tickId,
          }),
        );
        output.push(canonicalControllerJson(receipt));
        if (stopped()) {
          reachedWait = true;
          keepWatching = false;
          break;
        }
        if (receipt.status !== "succeeded" && receipt.status !== "superseded") {
          reachedWait = true;
        }
      }
      if (options.mode === "once") break;
      if (stopped()) break;
      keepWatching = await runtime.sleep(options.intervalMs as number);
    }
  } finally {
    release();
  }
  return output;
};

type JsonRecord = Record<string, unknown>;

const jsonFile = (path: string): JsonRecord | undefined =>
  existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as JsonRecord)
    : undefined;

interface ControllerWaveAuthority {
  readonly baseSha: string;
  readonly integrationId: string;
  readonly legacy: boolean;
  readonly record: JsonRecord;
  readonly reservationToken: string;
  readonly runId: string;
  readonly selection: ReturnType<typeof readIntegrationWaveSelection>;
  readonly workdir: string;
}

const exactSha = (value: unknown, length: 40 | 64): value is string =>
  typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);

const waveAuthority = (
  stateRoot: string,
  integrationId: string,
): ControllerWaveAuthority | undefined => {
  try {
    const recordPath = join(
      stateRoot,
      "runs",
      `integration-${integrationId}.json`,
    );
    const record = jsonFile(recordPath);
    if (!record) return undefined;
    const selectionPath = resolve(String(record.selectionPath));
    const expectedSelectionPath = resolve(
      stateRoot,
      "runs",
      `integration-${integrationId}-selection.json`,
    );
    if (selectionPath !== expectedSelectionPath || !existsSync(selectionPath)) {
      return undefined;
    }
    const selection = readIntegrationWaveSelection(
      readFileSync(selectionPath, "utf8"),
    );
    const legacy =
      record.schemaVersion === "maestro-brain-integration-wave-run/v2";
    const baseSha = record.baseSha;
    const runId = record.runId;
    const runIds = record.runIds;
    const reservationToken = record.reservationToken;
    const workdir = record.workdir;
    if (
      (!legacy &&
        record.schemaVersion !== "maestro-brain-integration-wave-run/v3") ||
      selection.legacy !== legacy ||
      record.integrationId !== integrationId ||
      record.status !== "launched" ||
      !new Set(["integrate", "recover"]).has(String(record.activeMode)) ||
      !Number.isInteger(Number(record.attempt)) ||
      Number(record.attempt) < 1 ||
      record.branch !== `fabro/brain-${integrationId}` ||
      !exactSha(baseSha, 40) ||
      selection.selection.baseSha !== baseSha ||
      selection.selection.integrationId !== integrationId ||
      typeof runId !== "string" ||
      runId.length === 0 ||
      !Array.isArray(runIds) ||
      !runIds.every((value) => typeof value === "string" && value.length > 0) ||
      !runIds.includes(runId) ||
      typeof reservationToken !== "string" ||
      reservationToken.length === 0 ||
      typeof workdir !== "string" ||
      !isAbsolute(workdir) ||
      canonicalControllerJson(record.selection) !==
        canonicalControllerJson(selection.selection)
    ) {
      return undefined;
    }
    if (
      legacy
        ? record.selectionSha256 !== selection.selectionPayloadSha256
        : Object.hasOwn(record, "selectionSha256") ||
          Object.hasOwn(record, "selection_sha256") ||
          record.selectionPayloadSha256 !== selection.selectionPayloadSha256 ||
          record.selectionFileSha256 !== selection.selectionFileSha256
    ) {
      return undefined;
    }
    return {
      baseSha,
      integrationId,
      legacy,
      record,
      reservationToken,
      runId,
      selection,
      workdir,
    };
  } catch {
    return undefined;
  }
};

const exactStringArray = (
  left: readonly string[],
  right: readonly string[],
): boolean => canonicalControllerJson(left) === canonicalControllerJson(right);

const actionIdentityMatches = (action: ControllerAction): boolean => {
  const identity = {
    schemaVersion: action.schemaVersion,
    kind: action.kind,
    controlHeadSha: action.controlHeadSha,
    manifestSha256: action.manifestSha256,
    targetIds: action.targetIds,
    sourceRunIds: action.sourceRunIds,
    sourceHeadShas: action.sourceHeadShas,
    sourceEvidenceSha256: action.sourceEvidenceSha256,
    findingSha256: action.findingSha256,
    policySha256: action.policySha256,
  };
  return action.actionId === sha256(canonicalControllerJson(identity));
};

const promotionReconciles = (input: {
  readonly action: ControllerAction;
  readonly authority: ControllerWaveAuthority;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly observed: ControllerSnapshot;
  readonly stateRoot: string;
}): boolean => {
  const { action, authority } = input;
  const directory = join(
    input.stateRoot,
    "evidence",
    "integration",
    authority.integrationId,
  );
  const result = jsonFile(join(directory, "integration-result.json"));
  const promotion = jsonFile(join(directory, "promotion.json"));
  const headSha = result?.headSha;
  if (!result || !promotion || !exactSha(headSha, 40)) return false;
  const expectedResultSchema = authority.legacy
    ? "maestro-brain-integration-result/v2"
    : "maestro-brain-integration-result/v3";
  const expectedPromotionSchema = authority.legacy
    ? "maestro-brain-integration-wave-promotion/v2"
    : "maestro-brain-integration-wave-promotion/v3";
  const selectionHashesMatch = authority.legacy
    ? result.selectionSha256 === authority.selection.selectionPayloadSha256 &&
      promotion.selectionSha256 === authority.selection.selectionPayloadSha256
    : result.selectionPayloadSha256 ===
        authority.selection.selectionPayloadSha256 &&
      result.selectionFileSha256 === authority.selection.selectionFileSha256 &&
      promotion.selectionPayloadSha256 ===
        authority.selection.selectionPayloadSha256 &&
      promotion.selectionFileSha256 ===
        authority.selection.selectionFileSha256 &&
      !Object.hasOwn(promotion, "selectionSha256") &&
      !Object.hasOwn(promotion, "selection_sha256");
  return (
    authority.baseSha === action.controlHeadSha &&
    result.schemaVersion === expectedResultSchema &&
    result.status === "passed" &&
    result.integrationId === authority.integrationId &&
    result.baseSha === authority.baseSha &&
    result.integrationWorkdir === authority.workdir &&
    promotion.schemaVersion === expectedPromotionSchema &&
    promotion.status === "promoted" &&
    promotion.integrationId === authority.integrationId &&
    promotion.baseSha === authority.baseSha &&
    promotion.headSha === headSha &&
    selectionHashesMatch &&
    exactStringArray(action.sourceRunIds, [authority.runId]) &&
    exactStringArray(action.sourceHeadShas, [headSha]) &&
    input.isAncestor(authority.baseSha, headSha) &&
    input.isAncestor(headSha, input.observed.controlHeadSha) &&
    !input.observed.waves.some(
      ({ integrationId }) => integrationId === authority.integrationId,
    )
  );
};

const integrationReconciles = (input: {
  readonly action: ControllerAction;
  readonly authority: ControllerWaveAuthority;
  readonly observed: ControllerSnapshot;
}): boolean => {
  const { action, authority } = input;
  const wave = input.observed.waves.find(
    ({ integrationId }) => integrationId === authority.integrationId,
  );
  const selected = [...authority.selection.selection.selectedTasks].sort(
    (left, right) => left.taskId.localeCompare(right.taskId),
  );
  const selectedIds = selected.map(({ taskId }) => taskId);
  const selectedHeads = selected.map(({ headSha }) => headSha);
  return (
    authority.record.activeMode === "integrate" &&
    authority.baseSha === action.controlHeadSha &&
    wave?.identity === "exact" &&
    wave.stage !== "unknown" &&
    wave.runId === authority.runId &&
    wave.ownershipId === authority.reservationToken &&
    exactStringArray(selectedIds, [...action.targetIds].sort()) &&
    exactStringArray(selectedHeads, action.sourceHeadShas)
  );
};

export const reconcileControllerAction = (input: {
  readonly action: ControllerAction;
  readonly isAncestor?: (ancestor: string, descendant: string) => boolean;
  readonly observe: () => ControllerSnapshot;
  readonly stateRoot: string;
}): { readonly kind: "not-started" | "succeeded" | "unresolved" } => {
  const { action } = input;
  if (!actionIdentityMatches(action)) return { kind: "unresolved" };
  if (action.kind === "wait") return { kind: "succeeded" };
  if (action.kind === "archive_terminal") {
    const taskId = action.targetIds[0];
    if (!taskId) return { kind: "unresolved" };
    const archived = join(
      input.stateRoot,
      "runs",
      `${taskId}.json.terminal-${action.actionId}`,
    );
    return { kind: existsSync(archived) ? "succeeded" : "not-started" };
  }
  if (action.kind === "dispatch_tasks") {
    const records = action.targetIds.map((taskId) =>
      jsonFile(join(input.stateRoot, "runs", `${taskId}.json`)),
    );
    if (records.every((record) => record === undefined)) {
      return { kind: "not-started" };
    }
    const exact = records.every((record, index) => {
      if (!record) return false;
      return (
        record.taskId === action.targetIds[index] &&
        record.baseSha === action.controlHeadSha &&
        record.branch ===
          `fabro/brain-${action.targetIds[index]?.toLowerCase()}` &&
        typeof record.workdir === "string" &&
        record.workdir.startsWith("/") &&
        (record.status === "preparing" ||
          (record.status === "launched" && typeof record.runId === "string"))
      );
    });
    return { kind: exact ? "succeeded" : "unresolved" };
  }
  const observed = input.observe();
  if (action.kind === "recover_lane") {
    const task = observed.tasks.find(
      ({ taskId }) => taskId === action.targetIds[0],
    );
    if (!task || task.stage === "unknown") return { kind: "unresolved" };
    if (["preparing", "running", "lane_green"].includes(task.stage)) {
      return { kind: "succeeded" };
    }
    return {
      kind: task.stage === "recoverable" ? "not-started" : "unresolved",
    };
  }
  if (action.kind === "integrate_batch") {
    if (observed.waves.length === 0) return { kind: "not-started" };
    if (observed.waves.length !== 1 || observed.waves[0]?.stage === "unknown") {
      return { kind: "unresolved" };
    }
    const integrationId = observed.waves[0]?.integrationId;
    const authority = integrationId
      ? waveAuthority(input.stateRoot, integrationId)
      : undefined;
    return {
      kind:
        authority && integrationReconciles({ action, authority, observed })
          ? "succeeded"
          : "unresolved",
    };
  }
  if (action.kind === "route_owner_rework") {
    const integrationId = action.targetIds.find((value) =>
      /^wave-\d{6}$/.test(value),
    );
    const ownerTaskIds = action.targetIds.filter(
      (value) => value !== integrationId,
    );
    if (!integrationId || ownerTaskIds.length === 0) {
      return { kind: "unresolved" };
    }
    const wave = observed.waves.find(
      (candidate) => candidate.integrationId === integrationId,
    );
    if (wave) {
      const exact =
        wave.stage === "owner_rework" &&
        wave.findingSha256 === action.findingSha256 &&
        exactStringArray(
          [
            wave.resultSha256,
            wave.selectionFileSha256,
            wave.selectionPayloadSha256,
          ].filter((value): value is string => value !== undefined),
          action.sourceEvidenceSha256,
        );
      return { kind: exact ? "not-started" : "unresolved" };
    }
    const routing = jsonFile(
      join(
        input.stateRoot,
        "evidence",
        "integration",
        integrationId,
        "owner-rework-routing.json",
      ),
    );
    const routingOwners =
      routing &&
      typeof routing.owners === "object" &&
      routing.owners !== null &&
      !Array.isArray(routing.owners)
        ? (routing.owners as JsonRecord)
        : undefined;
    if (
      routing?.schemaVersion !== "maestro-brain-owner-rework-routing/v1" ||
      routing.status !== "complete" ||
      routing.findingSha256 !== action.findingSha256 ||
      !exactStringArray(
        [
          String(routing.resultSha256 ?? ""),
          String(routing.selectionFileSha256 ?? ""),
          String(routing.selectionPayloadSha256 ?? ""),
        ],
        action.sourceEvidenceSha256,
      ) ||
      !routingOwners
    ) {
      return { kind: "unresolved" };
    }
    const reopened = ownerTaskIds.every((taskId) => {
      const task = observed.tasks.find(
        (candidate) => candidate.taskId === taskId,
      );
      const owner = routingOwners[taskId];
      return (
        task !== undefined &&
        typeof owner === "object" &&
        owner !== null &&
        !Array.isArray(owner) &&
        (owner as JsonRecord).status === "launched" &&
        (owner as JsonRecord).runId === task.runId &&
        typeof (owner as JsonRecord).requestSha256 === "string" &&
        new Set(["preparing", "running", "recoverable"]).has(task.stage)
      );
    });
    return { kind: reopened ? "succeeded" : "unresolved" };
  }
  const integrationId = action.targetIds[0];
  if (!integrationId) return { kind: "unresolved" };
  if (action.kind === "recover_wave") {
    const wave = observed.waves.find(
      (candidate) => candidate.integrationId === integrationId,
    );
    if (!wave) return { kind: "unresolved" };
    return {
      kind:
        wave.runId === action.sourceRunIds[0]
          ? "not-started"
          : wave.stage === "running"
            ? "succeeded"
            : "unresolved",
    };
  }
  const authority = waveAuthority(input.stateRoot, integrationId);
  if (
    authority &&
    promotionReconciles({
      action,
      authority,
      isAncestor:
        input.isAncestor ??
        ((ancestor, descendant) =>
          gitIsAncestor(ancestor, descendant, process.cwd())),
      observed,
      stateRoot: input.stateRoot,
    })
  ) {
    return { kind: "succeeded" };
  }
  const wave = observed.waves.find(
    (candidate) => candidate.integrationId === integrationId,
  );
  return { kind: wave?.stage === "promotable" ? "not-started" : "unresolved" };
};

const main = async (): Promise<void> => {
  const options = parseControllerCliArgs(process.argv.slice(2));
  const manifest = buildManifest();
  let stopped = false;
  let interruptSleep: (() => void) | undefined;
  const stop = (): void => {
    stopped = true;
    interruptSleep?.();
  };
  const disposeSignals = installControllerSignalHandlers(stop);
  const observe = (): ControllerSnapshot =>
    observeControllerSnapshot({
      controlRoot: process.cwd(),
      inspect: inspectFabroRun,
      manifest,
      stateRoot: options.stateRoot,
    });
  const runtime: ControllerCliRuntime = {
    acquireLock: acquireControllerLock,
    appendTelemetry: (value) => {
      const path = join(options.stateRoot, "controller", "telemetry.jsonl");
      mkdirSync(join(path, ".."), { recursive: true });
      appendFileSync(path, `${canonicalControllerJson(value)}\n`, "utf8");
    },
    execute: ({
      action,
      manifest: exactManifest,
      policy,
      snapshot,
      stateRoot,
    }) =>
      executeControllerTick({
        action,
        manifest: exactManifest,
        now: new Date().toISOString(),
        observe,
        plannedSnapshot: snapshot,
        policy,
        reconcile: (candidate) =>
          reconcileControllerAction({ action: candidate, observe, stateRoot }),
        run: (command) => {
          if (!command) return { exitCode: 0, stderr: "", stdout: "" };
          const result = spawnSync("rtk", command, {
            cwd: process.cwd(),
            encoding: "utf8",
          });
          return {
            exitCode: result.status ?? 1,
            stderr: result.stderr,
            stdout: result.stdout,
          };
        },
        stateRoot,
      }),
    manifest: () => manifest,
    now: () => new Date().toISOString(),
    observe,
    sleep: async (intervalMs) => {
      if (stopped) return false;
      await new Promise<void>((done) => {
        const timer = setTimeout(done, intervalMs);
        interruptSleep = () => {
          clearTimeout(timer);
          done();
        };
      });
      interruptSleep = undefined;
      return !stopped;
    },
    stopRequested: () => stopped,
  };
  try {
    for (const line of await runControllerCli(options, runtime))
      console.log(line);
  } finally {
    disposeSignals();
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
