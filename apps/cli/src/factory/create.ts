import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
  type AgentPackResult,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const CREATE_HELP =
  'maestro create <target> --name "My App" --outcome "Track client requests" [--demo-only] [--write --privacy-reviewed] [--human|--details|--json]\n';

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
    {
      projectJson: projectCreateResultForJson,
      includeDataInDetails: true,
    },
  );
}

function projectCreateResultForJson<Data extends AgentPackJsonValue>(
  result: AgentPackResult<"create", Data | null>,
): unknown {
  const data = asJsonRecord(result.data);
  if (data === undefined) return result;
  const preview = data.preview;
  const release = data.release;
  if (
    !isJsonRecord(preview) ||
    !isJsonRecord(release) ||
    !Array.isArray(preview.writes) ||
    !Array.isArray(preview.omissions) ||
    !Array.isArray(preview.collisions) ||
    typeof preview.preflightFingerprint !== "string" ||
    typeof preview.totalBytes !== "number" ||
    typeof release.ownershipManifest !== "string" ||
    typeof release.ownershipManifestChecksum !== "string"
  )
    return result;

  return {
    ...result,
    data: {
      ...data,
      preview: {
        preflightFingerprint: preview.preflightFingerprint,
        writeCount: preview.writes.length,
        omissionCount: preview.omissions.length,
        collisionCount: preview.collisions.length,
        collisions: preview.collisions,
        totalBytes: preview.totalBytes,
        fullInventory: {
          manifest: release.ownershipManifest,
          manifestChecksum: release.ownershipManifestChecksum,
          renderWith: "--details",
        },
      },
    },
  };
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
  let privacyReviewed = false;
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
    if (token === "--privacy-reviewed") {
      if (privacyReviewed) valid = false;
      privacyReviewed = true;
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
  if ((write && !privacyReviewed) || (!write && privacyReviewed)) valid = false;
  return {
    input: valid
      ? { target, name, outcome, demoOnly, write, privacyReviewed }
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

function isJsonRecord(
  value: unknown,
): value is { readonly [key: string]: AgentPackJsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asJsonRecord(
  value: unknown,
): { readonly [key: string]: AgentPackJsonValue } | undefined {
  return isJsonRecord(value) ? value : undefined;
}
