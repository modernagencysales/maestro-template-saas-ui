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
    { mode: options.mode },
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo: createRepositoryContext({ cwd }),
    },
    options.renderMode,
  );
}

function parsePreflightCli(argv: readonly string[]): {
  readonly mode: string;
  readonly renderMode: FactoryCliRenderMode;
} {
  const modeIndex = argv.indexOf("--mode");
  const mode = modeIndex >= 0 ? (argv[modeIndex + 1] ?? "") : "fake";
  const renderMode = argv.includes("--json")
    ? "json"
    : argv.includes("--details")
      ? "details"
      : "human";
  return { mode, renderMode };
}
