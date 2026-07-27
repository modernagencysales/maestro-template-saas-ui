import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  executeAgentPackCommand,
  exitCodeFor,
  renderAgentPackResult,
  type AgentPackCommand,
  type AgentPackExecutionContext,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";

export type FactoryCliRenderMode = "human" | "details" | "json";

export type FactoryCliHandler = {
  readonly command: string;
  readonly run: (argv: readonly string[], cwd: string) => Promise<CliResult>;
};

export async function runAgentPackCommandAsCli<
  const CommandId extends string,
  Args,
  Data extends AgentPackJsonValue,
>(
  command: AgentPackCommand<CommandId, Args, Data>,
  input: unknown,
  context: AgentPackExecutionContext,
  renderMode: FactoryCliRenderMode = "human",
): Promise<CliResult> {
  const result = await executeAgentPackCommand(command, input, context);
  return {
    exitCode: exitCodeFor(result.exitClass),
    stdout:
      renderMode === "json"
        ? `${JSON.stringify(result, null, 2)}\n`
        : renderAgentPackResult(result, { details: renderMode === "details" }),
    stderr: "",
  };
}

export function createFactoryCliHandler<
  const CommandId extends string,
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<CommandId, Args, Data>): FactoryCliHandler {
  return {
    command: command.id,
    run: (argv, cwd) =>
      runAgentPackCommandAsCli(command, argv.slice(1), {
        schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
        invocation: "cli",
        repo: createRepositoryContext({ cwd }),
      }),
  };
}

export async function dispatchFactoryCliCommand(
  handlers: readonly FactoryCliHandler[],
  argv: readonly string[],
  cwd: string,
): Promise<CliResult | undefined> {
  const handler = handlers.find((candidate) => candidate.command === argv[0]);
  return handler?.run(argv, cwd);
}
