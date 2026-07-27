import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const VERIFY_HELP =
  "maestro verify [--scope focused|full] [--changed <paths>] [--human|--details|--json]\n";
export const CHECK_HELP =
  "maestro check [--mode fake|test|live] [--changed <paths>] [--human|--details|--json]\n";

export function createVerifyCliHandler<
  CommandId extends "verify" | "check",
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<CommandId, Args, Data>) {
  return {
    command: command.id,
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(
            cliSuccess(command.id === "check" ? CHECK_HELP : VERIFY_HELP),
          )
        : runVerifyCli(command, argv, cwd),
  };
}

export function createReceiptExportCliHandler<
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<"verify-export", Args, Data>) {
  return {
    command: command.id,
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      runReceiptExportCli(command, argv, cwd),
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
  const options = parseVerifyCli(argv.slice(1), command.id);
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

export function runReceiptExportCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"verify-export", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const options = parseReceiptExportCli(argv.slice(1));
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

function parseVerifyCli(
  argv: readonly string[],
  commandId: "verify" | "check",
): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let scope = "focused";
  let mode = "fake";
  let changed: readonly string[] = [];
  let renderMode: FactoryCliRenderMode = "human";
  let scopeSeen = false;
  let modeSeen = false;
  let changedSeen = false;
  let renderSeen = false;
  let valid = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mode") {
      const value = argv[index + 1];
      if (
        commandId !== "check" ||
        modeSeen ||
        value === undefined ||
        value.startsWith("--")
      ) {
        valid = false;
      } else {
        mode = value;
        modeSeen = true;
        index += 1;
      }
      continue;
    }
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
    input: valid
      ? commandId === "check"
        ? { mode, scope, changed }
        : { scope, changed }
      : commandId === "check"
        ? { mode: "__invalid__", scope: "focused", changed: [] }
        : { scope: "__invalid__", changed: [] },
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

function parseReceiptExportCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let scope = "focused";
  let changed: readonly string[] = [];
  let fingerprint: string | undefined;
  let write = false;
  let renderMode: FactoryCliRenderMode = "human";
  const seen = new Set<string>();
  let valid = true;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      if (seen.has(token)) valid = false;
      seen.add(token);
      write = true;
      continue;
    }
    if (
      token === "--scope" ||
      token === "--changed" ||
      token === "--fingerprint"
    ) {
      const value = argv[index + 1];
      if (seen.has(token) || value === undefined || value.startsWith("--")) {
        valid = false;
      } else {
        seen.add(token);
        if (token === "--scope") scope = value;
        if (token === "--fingerprint") fingerprint = value;
        if (token === "--changed") {
          const paths = value.split(",");
          changed = paths.filter(Boolean);
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
      if (seen.has("render")) valid = false;
      seen.add("render");
      renderMode = selectedRenderMode;
      continue;
    }
    valid = false;
  }
  if (scope === "full" && changed.length > 0) valid = false;
  if (write !== (fingerprint !== undefined)) valid = false;
  return {
    input: valid
      ? {
          scope,
          changed,
          write,
          ...(fingerprint === undefined ? {} : { fingerprint }),
        }
      : { scope: "__invalid__", changed: [], write: false },
    renderMode,
  };
}
