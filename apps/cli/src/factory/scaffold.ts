import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const SCAFFOLD_HELP =
  [
    "maestro scaffold --generator <id> --args <json-object> [--write]",
    "  [--workflow-rule <id>] [--workflow-alternative <id>=<exact-ledger-repair>]",
    "  [--workflow-adr <id>=<docs/template/adr/NNNN-name.md>] [--human|--details|--json]",
  ].join("\n") + "\n";

export function createScaffoldCliHandler<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"scaffold", Args, Data>,
) {
  return {
    command: "scaffold",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(SCAFFOLD_HELP))
        : runScaffoldCli(command, argv, cwd),
  };
}

export function runScaffoldCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"scaffold", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseScaffoldCli(argv.slice(1));
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

function parseScaffoldCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  const state = scaffoldCliState();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (applyScaffoldFlag(state, token)) continue;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      state.valid = false;
      continue;
    }
    index += 1;
    state.valid = applyScaffoldValue(state, token, value) && state.valid;
  }
  if (state.generatorId === undefined || state.args === undefined)
    state.valid = false;
  return {
    input: state.valid
      ? {
          generatorId: state.generatorId,
          args: state.args,
          write: state.write,
          workflowRuleIds: state.workflowRuleIds,
          workflowResolutions: state.workflowResolutions,
        }
      : {},
    renderMode: state.renderMode,
  };
}

type ScaffoldCliState = {
  generatorId: string | undefined;
  args: Record<string, AgentPackJsonValue> | undefined;
  write: boolean;
  writeSeen: boolean;
  workflowRuleIds: string[];
  workflowResolutions: WorkflowResolution[];
  renderMode: FactoryCliRenderMode;
  renderSeen: boolean;
  valid: boolean;
};

type WorkflowResolution =
  | {
      readonly kind: "declared-alternative";
      readonly ruleId: string;
      readonly alternative: string;
    }
  | {
      readonly kind: "reviewed-adr";
      readonly ruleId: string;
      readonly adrRef: string;
    };

function scaffoldCliState(): ScaffoldCliState {
  return {
    generatorId: undefined,
    args: undefined,
    write: false,
    writeSeen: false,
    workflowRuleIds: [],
    workflowResolutions: [],
    renderMode: "human",
    renderSeen: false,
    valid: true,
  };
}

function applyScaffoldFlag(state: ScaffoldCliState, token: string | undefined) {
  if (token === "--write") {
    state.valid = !state.writeSeen && state.valid;
    state.write = true;
    state.writeSeen = true;
    return true;
  }
  const renderMode = renderModeFor(token);
  if (renderMode === undefined) return false;
  state.valid = !state.renderSeen && state.valid;
  state.renderMode = renderMode;
  state.renderSeen = true;
  return true;
}

function applyScaffoldValue(
  state: ScaffoldCliState,
  token: string | undefined,
  value: string,
): boolean {
  switch (token) {
    case "--generator":
      if (state.generatorId !== undefined) return false;
      state.generatorId = value;
      return true;
    case "--args":
      if (state.args !== undefined) return false;
      state.args = parseJsonRecord(value);
      return state.args !== undefined;
    case "--workflow-rule":
      if (!state.workflowRuleIds.includes(value))
        state.workflowRuleIds.push(value);
      return true;
    case "--workflow-alternative":
      return appendWorkflowResolution(state, value, "declared-alternative");
    case "--workflow-adr":
      return appendWorkflowResolution(state, value, "reviewed-adr");
    default:
      return false;
  }
}

function appendWorkflowResolution(
  state: ScaffoldCliState,
  value: string,
  kind: WorkflowResolution["kind"],
): boolean {
  const pair = splitPair(value);
  if (pair === undefined) return false;
  state.workflowResolutions.push(
    kind === "declared-alternative"
      ? { kind, ruleId: pair[0], alternative: pair[1] }
      : { kind, ruleId: pair[0], adrRef: pair[1] },
  );
  return true;
}

function parseJsonRecord(
  value: string,
): Record<string, AgentPackJsonValue> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function splitPair(value: string): readonly [string, string] | undefined {
  const separator = value.indexOf("=");
  return separator > 0 && separator < value.length - 1
    ? [value.slice(0, separator), value.slice(separator + 1)]
    : undefined;
}

function isJsonRecord(
  value: unknown,
): value is Record<string, AgentPackJsonValue> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(isJsonValue)
  );
}

function isJsonValue(value: unknown): value is AgentPackJsonValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every(isJsonValue)) ||
    isJsonRecord(value)
  );
}

function renderModeFor(
  token: string | undefined,
): FactoryCliRenderMode | undefined {
  if (token === "--json") return "json";
  if (token === "--details") return "details";
  if (token === "--human") return "human";
  return undefined;
}
