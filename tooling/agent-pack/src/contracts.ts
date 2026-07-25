import { exitCodeFor, type AgentPackExitClass } from "./exitCodes.js";
import type { RepositoryContext } from "./repoContext.js";

export const AGENT_PACK_COMMAND_VERSION = 1 as const;
export const AGENT_PACK_RESULT_VERSION = 1 as const;
export const AGENT_PACK_EXECUTION_CONTEXT_VERSION = 1 as const;

export type AgentPackInvocation = "cli" | "mcp" | "library";
export type AgentPackMutationPosture = "read-only" | "preview" | "write";
export type AgentPackDiagnosticSeverity = "info" | "warning" | "error";

export type AgentPackExecutionContext = {
  readonly schemaVersion: typeof AGENT_PACK_EXECUTION_CONTEXT_VERSION;
  readonly invocation: AgentPackInvocation;
  readonly repo: RepositoryContext;
};

export type AgentPackDiagnostic = {
  readonly code: string;
  readonly severity: AgentPackDiagnosticSeverity;
  readonly message: string;
  readonly safeToContinue: boolean;
  readonly nextAction: string;
  readonly rerun: string;
};

export type AgentPackArgumentResult<Args> =
  | { readonly ok: true; readonly args: Args }
  | {
      readonly ok: false;
      readonly diagnostics: readonly AgentPackDiagnostic[];
    };

export type AgentPackResult<CommandId extends string, Data> = {
  readonly schemaVersion: typeof AGENT_PACK_RESULT_VERSION;
  readonly command: {
    readonly id: CommandId;
    readonly version: typeof AGENT_PACK_COMMAND_VERSION;
  };
  readonly mutationPosture: AgentPackMutationPosture;
  readonly exitClass: AgentPackExitClass;
  readonly summary: string;
  readonly context: AgentPackExecutionContext;
  readonly diagnostics: readonly AgentPackDiagnostic[];
  readonly data: Data;
};

export type AgentPackCommand<CommandId extends string, Args, Data> = {
  readonly id: CommandId;
  readonly schemaVersion: typeof AGENT_PACK_COMMAND_VERSION;
  readonly decode: (input: unknown) => AgentPackArgumentResult<Args>;
  readonly mutationPosture: (args: Args) => AgentPackMutationPosture;
  readonly execute: (
    args: Args,
    context: AgentPackExecutionContext,
  ) => Promise<AgentPackResult<CommandId, Data>>;
};

type AgentPackResultInput<CommandId extends string, Data> = Omit<
  AgentPackResult<CommandId, Data>,
  "schemaVersion" | "command"
> & {
  readonly command: CommandId;
};

export function defineAgentPackCommand<
  const CommandId extends string,
  Args,
  Data,
>(
  command: AgentPackCommand<CommandId, Args, Data>,
): AgentPackCommand<CommandId, Args, Data> {
  return command;
}

export function createAgentPackResult<const CommandId extends string, Data>(
  input: AgentPackResultInput<CommandId, Data>,
): AgentPackResult<CommandId, Data> {
  return {
    schemaVersion: AGENT_PACK_RESULT_VERSION,
    command: {
      id: input.command,
      version: AGENT_PACK_COMMAND_VERSION,
    },
    mutationPosture: input.mutationPosture,
    exitClass: input.exitClass,
    summary: input.summary,
    context: input.context,
    diagnostics: input.diagnostics,
    data: input.data,
  };
}

export function renderAgentPackResult(
  result: AgentPackResult<string, unknown>,
  options: { readonly details?: boolean } = {},
): string {
  const lines = [result.summary];
  const firstDiagnostic = result.diagnostics[0];

  if (options.details) {
    lines.push(
      `Command: ${result.command.id} (v${result.command.version})`,
      `Exit: ${result.exitClass} (${exitCodeFor(result.exitClass)})`,
      `Mutation: ${result.mutationPosture}`,
      `Source root: ${result.context.repo.sourceRoot}`,
      `Template root: ${result.context.repo.templateRoot}`,
      `Target root: ${result.context.repo.targetRoot}`,
    );
    for (const diagnostic of result.diagnostics) {
      lines.push(
        `[${diagnostic.code}] ${diagnostic.message}`,
        `Safe to continue: ${diagnostic.safeToContinue ? "yes" : "no"}`,
        `Next: ${diagnostic.nextAction}`,
        `Rerun: ${diagnostic.rerun}`,
      );
    }
  } else if (firstDiagnostic !== undefined) {
    lines.push(
      `Next: ${firstDiagnostic.nextAction}`,
      `Rerun: ${firstDiagnostic.rerun}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
