import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const SCAFFOLD_HELP =
  [
    "maestro scaffold --generator <id> --args <json-object> [--write --preflight-fingerprint <preflight_sha256:...> --preview-fingerprint <scaffold_sha256:...>]",
    "  [--workflow-rule <id>] [--workflow-alternative <id>=<exact-ledger-repair>]",
    "  [--workflow-adr <id>=<docs/template/adr/NNNN-name.md>] [--human|--details|--json]",
  ].join("\n") + "\n";

export function createScaffoldCliHandler<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"scaffold", Args, Data>,
) {
  return {
    command: "scaffold",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(SCAFFOLD_HELP))
        : runScaffoldCli(command, argv, cwd),
  };
}

export function runScaffoldCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"scaffold", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseScaffoldCli(argv.slice(1));
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

function parseScaffoldCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let generatorId: string | undefined;
  let args: Record<string, AgentPackJsonValue> | undefined;
  let write = false;
  let writeSeen = false;
  let preflightFingerprint: string | undefined;
  let previewFingerprint: string | undefined;
  const workflowRuleIds: string[] = [];
  const workflowResolutions: (
    | {
        readonly kind: "declared-alternative";
        readonly ruleId: string;
        readonly alternative: string;
      }
    | {
        readonly kind: "reviewed-adr";
        readonly ruleId: string;
        readonly adrRef: string;
      }
  )[] = [];
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      if (writeSeen) valid = false;
      write = true;
      writeSeen = true;
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
    if (token === "--generator" && generatorId === undefined)
      generatorId = value;
    else if (token === "--args" && args === undefined)
      args = parseJsonRecord(value);
    else if (
      token === "--preflight-fingerprint" &&
      preflightFingerprint === undefined
    )
      preflightFingerprint = value;
    else if (
      token === "--preview-fingerprint" &&
      previewFingerprint === undefined
    )
      previewFingerprint = value;
    else if (token === "--workflow-rule" && !workflowRuleIds.includes(value))
      workflowRuleIds.push(value);
    else if (token === "--workflow-alternative") {
      const pair = splitPair(value);
      if (pair === undefined) valid = false;
      else
        workflowResolutions.push({
          kind: "declared-alternative",
          ruleId: pair[0],
          alternative: pair[1],
        });
    } else if (token === "--workflow-adr") {
      const pair = splitPair(value);
      if (pair === undefined) valid = false;
      else
        workflowResolutions.push({
          kind: "reviewed-adr",
          ruleId: pair[0],
          adrRef: pair[1],
        });
    } else valid = false;
  }
  if (generatorId === undefined || args === undefined) valid = false;
  return {
    input: valid
      ? {
          generatorId,
          args,
          write,
          ...(preflightFingerprint === undefined
            ? {}
            : { preflightFingerprint }),
          ...(previewFingerprint === undefined ? {} : { previewFingerprint }),
          workflowRuleIds,
          workflowResolutions,
        }
      : {},
    renderMode,
  };
}

function parseJsonRecord(
  value: string,
): Record<string, AgentPackJsonValue> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function splitPair(value: string): readonly [string, string] | undefined {
  const separator = value.indexOf("=");
  return separator > 0 && separator < value.length - 1
    ? [value.slice(0, separator), value.slice(separator + 1)]
    : undefined;
}

function isJsonRecord(
  value: unknown,
): value is Record<string, AgentPackJsonValue> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(isJsonValue)
  );
}

function isJsonValue(value: unknown): value is AgentPackJsonValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every(isJsonValue)) ||
    isJsonRecord(value)
  );
}

function renderModeFor(
  token: string | undefined,
): FactoryCliRenderMode | undefined {
  if (token === "--json") return "json";
  if (token === "--details") return "details";
  if (token === "--human") return "human";
  return undefined;
}
