import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export function createPreflightCliHandler<
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<"preflight", Args, Data>) {
  return {
    command: "preflight",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      runPreflightCli(command, argv, cwd),
  };
}

export function runPreflightCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"preflight", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const options = parsePreflightCli(argv.slice(1));
  return runAgentPackCommandAsCli(
    command,
    options.input,
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo: createRepositoryContext({ cwd }),
    },
    options.renderMode,
  );
}

function parsePreflightCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let mode = "fake";
  let renderMode: FactoryCliRenderMode = "human";
  let modeSeen = false;
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
    const selectedRenderMode = renderModeFor(token);
    if (selectedRenderMode !== undefined) {
      if (renderSeen) valid = false;
      else {
        renderMode = selectedRenderMode;
        renderSeen = true;
      }
      continue;
    }
    valid = false;
  }
  return {
    input: valid ? { mode } : { mode: "__invalid__" },
    renderMode,
  };
}

function renderModeFor(
  token: string | undefined,
): FactoryCliRenderMode | undefined {
  if (token === "--json") return "json";
  if (token === "--details") return "details";
  if (token === "--human") return "human";
  return undefined;
}
