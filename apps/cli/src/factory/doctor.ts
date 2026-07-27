import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import { cliSuccess } from "../result";
import type { CliResult } from "../types";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const DOCTOR_HELP =
  "maestro doctor <provider> --environment fake|local|dev|preview|staging [--human|--details|--json]\n";

export function createProviderDoctorCliHandler<
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<"doctor", Args, Data>) {
  return {
    command: "doctor",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(DOCTOR_HELP))
        : runDoctorCli(command, argv, cwd),
  };
}

function runDoctorCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"doctor", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseProviderDoctorCli(argv.slice(1));
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

function parseProviderDoctorCli(argv: readonly string[]) {
  const provider = argv[0];
  let environment: string | undefined;
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = provider !== undefined && !provider.startsWith("--");
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    const mode = renderModeFor(token);
    if (mode !== undefined) {
      if (renderSeen) valid = false;
      renderMode = mode;
      renderSeen = true;
      continue;
    }
    if (
      token !== "--environment" ||
      environment !== undefined ||
      argv[index + 1] === undefined
    ) {
      valid = false;
      continue;
    }
    environment = argv[index + 1];
    index += 1;
  }
  if (environment === undefined) valid = false;
  return {
    input: valid ? { provider, environment } : {},
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
