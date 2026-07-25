import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createNodeProcessSpawner,
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
import { setTimeout as delay } from "node:timers/promises";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const START_HELP =
  "maestro start [--mode fake|local|dev] [--human|--details|--json]\n";

export function createStartCliHandler<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"start", Args, Data>,
) {
  return {
    command: "start",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(START_HELP))
        : runStartCli(command, argv, cwd),
  };
}

export function runStartCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"start", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseStartCli(argv.slice(1));
  return runAgentPackCommandAsCli(
    command,
    parsed.input,
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo: createRepositoryContext({ cwd }),
    },
    parsed.renderMode,
  );
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
          }
        : {
            safeToStart: result.data.safeToMutate,
            auth: result.data.facts.auth,
            exitClass: result.exitClass,
            diagnostics: result.diagnostics,
          };
    },
    readFile: (path) => options.readFile(path, { maxBytes: options.maxBytes }),
    ports: nodeStartPortProbe,
    readiness: { wait: waitForStartReadiness },
    announce: ({ name, firstOutcome, url, readinessUrl }) => {
      options.log(`[maestro] ${safeLine(name)}`);
      options.log(`[maestro] First outcome: ${safeLine(firstOutcome)}`);
      options.log(`[maestro] URL: ${url}`);
      options.log(`[maestro] Readiness: ${readinessUrl}`);
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
  customerDefault: (name: string) => T,
): T {
  try {
    return canonical(raw);
  } catch (canonicalError) {
    try {
      const value: unknown = JSON.parse(raw);
      const personalization = isRecord(value)
        ? value.personalization
        : undefined;
      if (
        isRecord(personalization) &&
        typeof personalization.name === "string" &&
        personalization.name.trim() !== "" &&
        typeof personalization.firstOutcome === "string" &&
        personalization.firstOutcome.trim() !== ""
      ) {
        return customerDefault(personalization.name);
      }
    } catch {
      // Preserve the canonical parser diagnostic below.
    }
    throw canonicalError;
  }
}

function parseStartCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let mode = "fake";
  let modeSeen = false;
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mode") {
      const value = argv[index + 1];
      if (modeSeen || value === undefined || value.startsWith("--"))
        valid = false;
      else {
        mode = value;
        modeSeen = true;
        index += 1;
      }
      continue;
    }
    const selected = renderModeFor(token);
    if (selected === undefined || renderSeen) valid = false;
    else {
      renderMode = selected;
      renderSeen = true;
    }
  }
  return { input: valid ? { mode } : { mode: "__invalid__" }, renderMode };
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
  return redactStartLog(value.replace(/[\r\n\u001b]/g, " "));
}

async function waitForStartReadiness(
  url: string,
  signal: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + 20_000;
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
