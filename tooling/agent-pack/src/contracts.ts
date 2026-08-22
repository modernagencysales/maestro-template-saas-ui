import { exitCodeFor, type AgentPackExitClass } from "./exitCodes.js";
import type { RepositoryContext } from "./repoContext.js";

export const AGENT_PACK_COMMAND_VERSION = 1 as const;
export const AGENT_PACK_RESULT_VERSION = 1 as const;
export const AGENT_PACK_EXECUTION_CONTEXT_VERSION = 1 as const;

export type AgentPackInvocation = "cli" | "mcp" | "library";
export type AgentPackMutationPosture = "read-only" | "preview" | "write";
export type AgentPackDiagnosticSeverity = "info" | "warning" | "error";
export type AgentPackJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AgentPackJsonValue[]
  | { readonly [key: string]: AgentPackJsonValue };

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

export type AgentPackResult<
  CommandId extends string,
  Data extends AgentPackJsonValue,
> = {
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

export type AgentPackCommandOutcome<Data extends AgentPackJsonValue> = {
  readonly mutationPosture: AgentPackMutationPosture;
  readonly exitClass: AgentPackExitClass;
  readonly summary: string;
  readonly diagnostics: readonly AgentPackDiagnostic[];
  readonly data: Data;
};

export type AgentPackCommand<
  CommandId extends string,
  Args,
  Data extends AgentPackJsonValue,
> = {
  readonly id: CommandId;
  readonly schemaVersion: typeof AGENT_PACK_COMMAND_VERSION;
  readonly decode: (input: unknown) => AgentPackArgumentResult<Args>;
  readonly mutationPosture: (args: Args) => AgentPackMutationPosture;
  readonly execute: (
    args: Args,
    context: AgentPackExecutionContext,
  ) => Promise<AgentPackCommandOutcome<Data>>;
};

type AgentPackResultInput<
  CommandId extends string,
  Data extends AgentPackJsonValue,
> = Omit<AgentPackResult<CommandId, Data>, "schemaVersion" | "command"> & {
  readonly command: CommandId;
};

export function defineAgentPackCommand<
  const CommandId extends string,
  Args,
  Data extends AgentPackJsonValue,
>(
  command: AgentPackCommand<CommandId, Args, Data>,
): AgentPackCommand<CommandId, Args, Data> {
  return command;
}

function createAgentPackResult<
  const CommandId extends string,
  Data extends AgentPackJsonValue,
>(
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

export async function executeAgentPackCommand<
  const CommandId extends string,
  Args,
  Data extends AgentPackJsonValue,
>(
  command: AgentPackCommand<CommandId, Args, Data>,
  input: unknown,
  context: AgentPackExecutionContext,
): Promise<AgentPackResult<CommandId, Data | null>> {
  let mutationPosture: AgentPackMutationPosture = "read-only";

  try {
    const decoded = command.decode(input);
    if (!decoded.ok) {
      return diagnosticsMatchExit("invalidInvocation", decoded.diagnostics)
        ? createAgentPackResult({
            command: command.id,
            mutationPosture,
            exitClass: "invalidInvocation",
            summary: `Invalid invocation for ${command.id}.`,
            context,
            diagnostics: decoded.diagnostics,
            data: null,
          })
        : contractDefect(
            command.id,
            mutationPosture,
            context,
            "AGENT_PACK_EXIT_DIAGNOSTIC_MISMATCH",
            "Argument decoding returned diagnostics inconsistent with invalidInvocation.",
          );
    }

    mutationPosture = command.mutationPosture(decoded.args);
    const outcome = await command.execute(decoded.args, context);
    if (outcome.mutationPosture !== mutationPosture) {
      return contractDefect(
        command.id,
        mutationPosture,
        context,
        "AGENT_PACK_POSTURE_MISMATCH",
        `Command ${command.id} returned ${outcome.mutationPosture} after declaring ${mutationPosture}.`,
      );
    }
    if (!diagnosticsMatchExit(outcome.exitClass, outcome.diagnostics)) {
      return contractDefect(
        command.id,
        mutationPosture,
        context,
        "AGENT_PACK_EXIT_DIAGNOSTIC_MISMATCH",
        `Command ${command.id} returned diagnostics inconsistent with ${outcome.exitClass}.`,
      );
    }

    return createAgentPackResult({
      command: command.id,
      mutationPosture,
      exitClass: outcome.exitClass,
      summary: outcome.summary,
      context,
      diagnostics: outcome.diagnostics,
      data: outcome.data,
    });
  } catch {
    return contractDefect(
      command.id,
      mutationPosture,
      context,
      "AGENT_PACK_INTERNAL_DEFECT",
      `Command ${command.id} failed inside the agent-pack executor.`,
    );
  }
}

function diagnosticsMatchExit(
  exitClass: AgentPackExitClass,
  diagnostics: readonly AgentPackDiagnostic[],
): boolean {
  const hasError = diagnostics.some(({ severity }) => severity === "error");
  const hasFinding = diagnostics.some(
    ({ severity }) => severity === "warning" || severity === "error",
  );

  if (exitClass === "success") return !hasFinding;
  if (exitClass === "findings") return hasFinding;
  return hasError;
}

function contractDefect<CommandId extends string>(
  command: CommandId,
  mutationPosture: AgentPackMutationPosture,
  context: AgentPackExecutionContext,
  code:
    | "AGENT_PACK_EXIT_DIAGNOSTIC_MISMATCH"
    | "AGENT_PACK_INTERNAL_DEFECT"
    | "AGENT_PACK_POSTURE_MISMATCH",
  message: string,
): AgentPackResult<CommandId, null> {
  return createAgentPackResult({
    command,
    mutationPosture,
    exitClass: "internalDefect",
    summary: `Agent-pack command contract defect: ${command}.`,
    context,
    diagnostics: [
      {
        code,
        severity: "error",
        message,
        safeToContinue: false,
        nextAction: "Report this command contract defect.",
        rerun: `pnpm maestro -- ${command} --json`,
      },
    ],
    data: null,
  });
}

export function renderAgentPackResult(
  result: AgentPackResult<string, AgentPackJsonValue>,
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

  if (!options.details) {
    for (const command of nextCommands(result.data))
      lines.push(`Run: ${command}`);
  }

  return `${lines.join("\n")}\n`;
}

function nextCommands(data: AgentPackJsonValue): readonly string[] {
  if (!isJsonRecord(data)) return [];
  const actions = Array.isArray(data.followUpActions)
    ? data.followUpActions.flatMap((action) =>
        isJsonRecord(action) && typeof action.command === "string"
          ? [action.command]
          : [],
      )
    : [];
  const confirmation =
    typeof data.confirmationCommand === "string"
      ? [data.confirmationCommand]
      : [];
  const next = typeof data.nextCommand === "string" ? [data.nextCommand] : [];
  return [...actions, ...confirmation, ...next];
}

function isJsonRecord(
  value: AgentPackJsonValue,
): value is { readonly [key: string]: AgentPackJsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
