import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import { cliSuccess } from "../result";
import type { CliResult } from "../types";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const SUPPORT_BUNDLE_HELP =
  "maestro support-bundle [--output .maestro/support/<name>.json] [--write --preview-fingerprint <support_preview_sha256:...>] [--human|--details|--json]\n";

export function createSupportBundleCliHandler<
  Args,
  Data extends AgentPackJsonValue,
>(command: AgentPackCommand<"support-bundle", Args, Data>) {
  return {
    command: "support-bundle",
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(SUPPORT_BUNDLE_HELP))
        : runSupportBundleCli(command, argv, cwd),
  };
}

function runSupportBundleCli<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<"support-bundle", Args, Data>,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseSupportBundleCli(argv.slice(1));
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

function parseSupportBundleCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let output: string | undefined;
  let write = false;
  let previewFingerprint: string | undefined;
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
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
    if (token === "--output" && output === undefined) output = value;
    else if (
      token === "--preview-fingerprint" &&
      previewFingerprint === undefined
    )
      previewFingerprint = value;
    else valid = false;
  }
  if (
    (write && previewFingerprint === undefined) ||
    (!write && previewFingerprint)
  )
    valid = false;
  return {
    input: valid
      ? {
          ...(output === undefined ? {} : { output }),
          ...(write ? { write, previewFingerprint } : {}),
        }
      : {},
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
