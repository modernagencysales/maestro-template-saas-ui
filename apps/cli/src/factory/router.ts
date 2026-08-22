import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  executeAgentPackCommand,
  exitCodeFor,
  renderAgentPackResult,
  type AgentPackCommand,
  type AgentPackExecutionContext,
  type AgentPackJsonValue,
  type AgentPackResult,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";

export type FactoryCliRenderMode = "human" | "details" | "json";

export type FactoryCliHandler = {
  readonly command: string;
  readonly run: (argv: readonly string[], cwd: string) => Promise<CliResult>;
};

export type FactoryCliRenderOptions<
  CommandId extends string,
  Data extends AgentPackJsonValue,
> = {
  readonly projectJson?: (
    result: AgentPackResult<CommandId, Data | null>,
  ) => unknown;
  readonly includeDataInDetails?: boolean;
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
  renderOptions: FactoryCliRenderOptions<CommandId, Data> = {},
): Promise<CliResult> {
  const result = await executeAgentPackCommand(command, input, context);
  const renderedDetails = renderAgentPackResult(result, { details: true });
  return {
    exitCode: exitCodeFor(result.exitClass),
    stdout:
      renderMode === "json"
        ? `${JSON.stringify(renderOptions.projectJson?.(result) ?? result, null, 2)}\n`
        : renderMode === "details" && renderOptions.includeDataInDetails
          ? `${renderedDetails.trimEnd()}\nData:\n${JSON.stringify(result.data, null, 2)}\n`
          : renderAgentPackResult(result, {
              details: renderMode === "details",
            }),
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
