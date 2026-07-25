import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export function createVerifyCliHandler<
  CommandId extends "verify" | "check",
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<CommandId, Args, Data>) {
  return {
    command: command.id,
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      runVerifyCli(command, argv, cwd),
  };
}

export function runVerifyCli<
  CommandId extends "verify" | "check",
  Args,
  Data extends AgentPackJsonValue,
>(
  command: AgentPackCommand<CommandId, Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const options = parseVerifyCli(argv.slice(1));
  return runAgentPackCommandAsCli(
    command,
    { scope: options.scope, changed: options.changed },
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo: createRepositoryContext({ cwd }),
    },
    options.renderMode,
  );
}

function parseVerifyCli(argv: readonly string[]): {
  readonly scope: string;
  readonly changed: readonly string[];
  readonly renderMode: FactoryCliRenderMode;
} {
  const scopeIndex = argv.indexOf("--scope");
  const changed = argv.flatMap((token, index) =>
    token === "--changed" && argv[index + 1]
      ? (argv[index + 1] ?? "").split(",").filter(Boolean)
      : [],
  );
  return {
    scope: scopeIndex >= 0 ? (argv[scopeIndex + 1] ?? "") : "focused",
    changed,
    renderMode: argv.includes("--json")
      ? "json"
      : argv.includes("--details")
        ? "details"
        : "human",
  };
}
