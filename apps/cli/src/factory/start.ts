import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createNodeProcessSpawner,
  type StartDependencies,
  createRepositoryContext,
  createStartCommand,
  executeAgentPackCommand,
  nodeStartPortProbe,
  nodeStartSignalBoundary,
  redactStartLog,
  superviseProcesses,
  type AgentPackCommand,
  type AgentPackJsonValue,
  type PreflightInput,
  type createPreflightCommand,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const START_HELP =
  "maestro start [--mode fake|local|dev] [--web-port PORT] [--convex-port PORT] [--convex-site-port PORT] [--readiness-port PORT] [--human|--details|--json]\n";

export type StartOutputBoundary = {
  readonly write: (line: string) => void;
  readonly run: <Value>(
    renderMode: FactoryCliRenderMode,
    effect: () => Promise<Value>,
  ) => Promise<Value>;
};

export function createStartOutputBoundary(
  sink: (line: string) => void,
): StartOutputBoundary {
  const renderMode = new AsyncLocalStorage<FactoryCliRenderMode>();
  return {
    write: (line) => {
      if (renderMode.getStore() !== "json") sink(line);
    },
    run: (mode, effect) => renderMode.run(mode, effect),
  };
}

export function createStartCliHandler<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"start", Args, Data>,
  output?: StartOutputBoundary,
) {
  return {
    command: "start",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(START_HELP))
        : runStartCli(command, argv, cwd, output),
  };
}

export function runStartCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"start", Args, Data>,
  argv: readonly string[],
  cwd: string,
  output?: StartOutputBoundary,
): Promise<CliResult> {
  const parsed = parseStartCli(argv.slice(1));
  const execute = () =>
    runAgentPackCommandAsCli(
      command,
      parsed.input,
      {
        schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
        invocation: "cli",
        repo: createRepositoryContext({ cwd }),
      },
      parsed.renderMode,
    );
  return output?.run(parsed.renderMode, execute) ?? execute();
}

export function createComposedStartCommand(options: {
  readonly preflight: ReturnType<typeof createPreflightCommand>;
  readonly readFile: (
    path: string,
    options: { readonly maxBytes: number },
  ) => Promise<string>;
  readonly maxBytes: number;
  readonly environment: () => NodeJS.ProcessEnv;
  readonly log: (line: string) => void;
  readonly readinessSurface: StartDependencies["readinessSurface"];
}) {
  return createStartCommand({
    preflight: async (mode, context) => {
      const result = await executeAgentPackCommand(
        options.preflight,
        { mode } satisfies PreflightInput,
        context,
      );
      return result.data === null
        ? {
            safeToStart: false,
            auth: "cancelled",
            exitClass: result.exitClass,
            diagnostics: result.diagnostics,
            readiness: {
              worksNow: "Readiness is unavailable until preflight succeeds.",
              demoOnly: "Provider and runtime posture are unverified.",
              blueprint: "unverified",
              providers: [],
            },
          }
        : {
            safeToStart: result.data.safeToMutate,
            auth: result.data.facts.auth,
            exitClass: result.exitClass,
            diagnostics: result.diagnostics,
            readiness: {
              worksNow: result.data.worksNow,
              demoOnly: result.data.demoOnly,
              blueprint: result.data.facts.app.blueprint,
              providers: result.data.facts.app.providers,
            },
          };
    },
    readFile: (path) => options.readFile(path, { maxBytes: options.maxBytes }),
    ports: nodeStartPortProbe,
    readiness: { wait: waitForStartReadiness },
    readinessSurface: options.readinessSurface,
    announce: ({
      name,
      firstOutcome,
      url,
      readinessUrl,
      buildReadinessUrl,
    }) => {
      options.log(`[maestro] ${safeLine(name)}`);
      options.log(`[maestro] First outcome: ${safeLine(firstOutcome)}`);
      options.log(`[maestro] URL: ${url}`);
      options.log(`[maestro] Readiness: ${readinessUrl}`);
      options.log(`[maestro] Build Readiness: ${buildReadinessUrl}`);
    },
    supervise: (specs, readiness) =>
      superviseProcesses(specs, {
        spawner: createNodeProcessSpawner(options.environment),
        signals: nodeStartSignalBoundary,
        log: options.log,
        readiness,
      }),
  });
}

export function parseStartTargetInstance<T>(
  raw: string,
  canonical: (raw: string) => T,
  customerDefault: (identity: {
    readonly name: string;
    readonly blueprint: string;
  }) => T,
): T {
  try {
    return canonical(raw);
  } catch (canonicalError) {
    try {
      const identity = parseCustomerIdentity(JSON.parse(raw));
      if (identity !== undefined) return customerDefault(identity);
    } catch {
      // Preserve the canonical parser diagnostic below.
    }
    throw canonicalError;
  }
}

function parseCustomerIdentity(
  value: unknown,
): { readonly name: string; readonly blueprint: string } | undefined {
  if (!isRecord(value)) return undefined;
  const personalization = value.personalization;
  const blueprint = value.blueprint;
  if (
    !isRecord(personalization) ||
    !isRecord(blueprint) ||
    !nonemptyText(personalization.name) ||
    !nonemptyText(personalization.firstOutcome) ||
    !nonemptyText(blueprint.id)
  )
    return undefined;
  return { name: personalization.name, blueprint: blueprint.id };
}

const nonemptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

function parseStartCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  const state = startCliState();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (applyStartFlag(state, token)) continue;
    if (applyStartValue(state, token, argv[index + 1])) index += 1;
  }
  return {
    input: state.valid
      ? {
          mode: state.mode,
          ...(Object.keys(state.ports).length === 0
            ? {}
            : { ports: state.ports }),
        }
      : { mode: "__invalid__" },
    renderMode: state.renderMode,
  };
}

type StartCliState = {
  mode: string;
  modeSeen: boolean;
  ports: Record<string, number>;
  renderMode: FactoryCliRenderMode;
  renderSeen: boolean;
  valid: boolean;
};

function startCliState(): StartCliState {
  return {
    mode: "fake",
    modeSeen: false,
    ports: {},
    renderMode: "human",
    renderSeen: false,
    valid: true,
  };
}

function applyStartFlag(state: StartCliState, token: string | undefined) {
  const selected = renderModeFor(token);
  if (selected === undefined) return false;
  if (state.renderSeen) {
    state.valid = false;
    return true;
  }
  state.renderMode = selected;
  state.renderSeen = true;
  return true;
}

function applyStartValue(
  state: StartCliState,
  token: string | undefined,
  value: string | undefined,
): boolean {
  if (token === "--mode") {
    if (state.modeSeen || value === undefined || value.startsWith("--")) {
      state.valid = false;
      return false;
    }
    state.mode = value;
    state.modeSeen = true;
    return true;
  }
  const portFlags: Readonly<Record<string, string>> = {
    "--web-port": "web",
    "--convex-port": "convex",
    "--convex-site-port": "convexSite",
    "--readiness-port": "readinessPresenter",
  };
  const portKey = token === undefined ? undefined : portFlags[token];
  if (portKey === undefined) {
    state.valid = false;
    return false;
  }
  const parsedPort = parsePort(value, portKey in state.ports);
  state.valid = parsedPort.port !== undefined && state.valid;
  if (parsedPort.port !== undefined) state.ports[portKey] = parsedPort.port;
  return parsedPort.consumeValue;
}

function parsePort(
  value: string | undefined,
  duplicate: boolean,
): { readonly consumeValue: boolean; readonly port?: number } {
  if (value === undefined || !/^[1-9]\d*$/.test(value) || duplicate) {
    return { consumeValue: false };
  }
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65_535
    ? { consumeValue: true, port }
    : { consumeValue: true };
}

function renderModeFor(
  token: string | undefined,
): FactoryCliRenderMode | undefined {
  if (token === "--json") return "json";
  if (token === "--details") return "details";
  if (token === "--human") return "human";
  return undefined;
}

function safeLine(value: string): string {
  const sanitized = value
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll(String.fromCodePoint(27), " ");
  return redactStartLog(sanitized);
}

async function waitForStartReadiness(
  url: string,
  signal: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + 120_000;
  while (!signal.aborted && Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(750)]),
      });
      if (response.ok) return true;
    } catch {
      if (signal.aborted) return false;
    }
    try {
      await delay(150, undefined, { signal });
    } catch {
      return false;
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
