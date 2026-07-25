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
    options.input,
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo: createRepositoryContext({ cwd }),
    },
    options.renderMode,
  );
}

function parseVerifyCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let scope = "focused";
  let changed: readonly string[] = [];
  let renderMode: FactoryCliRenderMode = "human";
  let scopeSeen = false;
  let changedSeen = false;
  let renderSeen = false;
  let valid = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--scope" || token === "--changed") {
      const value = argv[index + 1];
      const duplicate = token === "--scope" ? scopeSeen : changedSeen;
      if (duplicate || value === undefined || value.startsWith("--"))
        valid = false;
      else {
        if (token === "--scope") {
          scope = value;
          scopeSeen = true;
        } else {
          const paths = value.split(",");
          changed = paths.filter(Boolean);
          changedSeen = true;
          if (changed.length === 0 || paths.some((path) => path.length === 0)) {
            valid = false;
          }
        }
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
  if (scope === "full" && changed.length > 0) valid = false;
  return {
    input: valid ? { scope, changed } : { scope: "__invalid__", changed: [] },
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
