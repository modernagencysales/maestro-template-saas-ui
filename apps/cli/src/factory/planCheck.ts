import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  resolveTargetPath,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import { readFile } from "node:fs/promises";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const PLAN_CHECK_HELP =
  "maestro plan-check --plan <manifest.json> [--human|--details|--json]\n";
const MAX_PLAN_BYTES = 256 * 1024;

type ReadPlan = (path: string) => Promise<unknown>;

export function createPlanCheckCliHandler<
  Args,
  Data extends AgentPackJsonValue,
>(
  command: AgentPackCommand<"plan-check", Args, Data>,
  readPlan: ReadPlan = readPlanFile,
) {
  return {
    command: "plan-check",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(PLAN_CHECK_HELP))
        : runPlanCheckCli(command, argv, cwd, readPlan),
  };
}

export async function runPlanCheckCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"plan-check", Args, Data>,
  argv: readonly string[],
  cwd: string,
  readPlan: ReadPlan = readPlanFile,
): Promise<CliResult> {
  const parsed = parsePlanCheckCli(argv.slice(1));
  const repo = createRepositoryContext({ cwd });
  let input: unknown = {};
  if (parsed.valid && parsed.planPath !== undefined) {
    try {
      input = {
        plan: await readPlan(resolveTargetPath(repo, parsed.planPath)),
      };
    } catch {
      input = {};
    }
  }
  return runAgentPackCommandAsCli(
    command,
    input,
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo,
    },
    parsed.renderMode,
  );
}

async function readPlanFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  if (Buffer.byteLength(text) > MAX_PLAN_BYTES)
    throw new Error("plan too large");
  return JSON.parse(text) as unknown;
}

function parsePlanCheckCli(argv: readonly string[]): {
  readonly valid: boolean;
  readonly planPath?: string;
  readonly renderMode: FactoryCliRenderMode;
} {
  let planPath: string | undefined;
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--plan") {
      const value = argv[index + 1];
      if (
        planPath !== undefined ||
        value === undefined ||
        value.startsWith("--")
      )
        valid = false;
      else {
        planPath = value;
        index += 1;
      }
      continue;
    }
    const selected = renderModeFor(token);
    if (selected === undefined || renderSeen) valid = false;
    else {
      renderMode = selected;
      renderSeen = true;
    }
  }
  return {
    valid: valid && planPath !== undefined,
    ...(planPath === undefined ? {} : { planPath }),
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
