import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const CREATE_HELP =
  'maestro create <target> --name "My App" --outcome "Track client requests" [--demo-only] [--write] [--human|--details|--json]\n';

export function createCreateCliHandler<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"create", Args, Data>,
) {
  return {
    command: "create",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(CREATE_HELP))
        : runCreateCli(command, argv, cwd),
  };
}

export function runCreateCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"create", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseCreateCli(argv.slice(1));
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

function parseCreateCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  const target = argv[0]?.startsWith("--") ? undefined : argv[0];
  let name: string | undefined;
  let outcome: string | undefined;
  let demoOnly = false;
  let write = false;
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = target !== undefined;
  for (
    let index = target === undefined ? 0 : 1;
    index < argv.length;
    index += 1
  ) {
    const token = argv[index];
    if (token === "--demo-only") {
      if (demoOnly) valid = false;
      demoOnly = true;
      continue;
    }
    if (token === "--write") {
      if (write) valid = false;
      write = true;
      continue;
    }
    const selected = renderModeFor(token);
    if (selected !== undefined) {
      if (renderSeen) valid = false;
      renderMode = selected;
      renderSeen = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      valid = false;
      continue;
    }
    index += 1;
    if (token === "--name" && name === undefined) name = value;
    else if (token === "--outcome" && outcome === undefined) outcome = value;
    else valid = false;
  }
  if (name === undefined || outcome === undefined) valid = false;
  return {
    input: valid ? { target, name, outcome, demoOnly, write } : {},
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
