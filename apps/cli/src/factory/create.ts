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
  const parsed = parseCreateCli(
    (argv[0] === "--" ? argv.slice(1) : argv).slice(1),
  );
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
  if (!hasCreatePreviewData(data)) return result;
  const preview = data.preview;
  const release = data.release;

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

type CreatePreviewJson = {
  readonly [key: string]: AgentPackJsonValue;
  readonly writes: readonly AgentPackJsonValue[];
  readonly omissions: readonly AgentPackJsonValue[];
  readonly collisions: readonly AgentPackJsonValue[];
  readonly preflightFingerprint: string;
  readonly totalBytes: number;
};

type CreateReleaseJson = {
  readonly [key: string]: AgentPackJsonValue;
  readonly ownershipManifest: string;
  readonly ownershipManifestChecksum: string;
};

function hasCreatePreviewData(
  data: { readonly [key: string]: AgentPackJsonValue } | undefined,
): data is {
  readonly [key: string]: AgentPackJsonValue;
  readonly preview: CreatePreviewJson;
  readonly release: CreateReleaseJson;
} {
  if (
    data === undefined ||
    !isJsonRecord(data.preview) ||
    !isJsonRecord(data.release)
  )
    return false;
  const { preview, release } = data;
  return [
    Array.isArray(preview.writes),
    Array.isArray(preview.omissions),
    Array.isArray(preview.collisions),
    typeof preview.preflightFingerprint === "string",
    typeof preview.totalBytes === "number",
    typeof release.ownershipManifest === "string",
    typeof release.ownershipManifestChecksum === "string",
  ].every(Boolean);
}

function parseCreateCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  const target = argv[0]?.startsWith("--") ? undefined : argv[0];
  const parsed = parseCreateArguments(argv, target === undefined ? 0 : 1);
  const valid =
    target !== undefined &&
    parsed.valid &&
    parsed.values.name !== undefined &&
    parsed.values.outcome !== undefined;
  return {
    input: valid ? { target, ...parsed.values, ...parsed.flags } : {},
    renderMode: parsed.renderMode,
  };
}

function parseCreateArguments(
  argv: readonly string[],
  start: number,
): {
  readonly flags: Record<"demoOnly" | "write", boolean>;
  readonly renderMode: FactoryCliRenderMode;
  readonly valid: boolean;
  readonly values: Record<"name" | "outcome", string | undefined>;
} {
  const values: Record<"name" | "outcome", string | undefined> = {
    name: undefined,
    outcome: undefined,
  };
  const flags: Record<"demoOnly" | "write", boolean> = {
    demoOnly: false,
    write: false,
  };
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = true;
  for (let index = start; index < argv.length; index += 1) {
    const token = argv[index];
    const flag = createFlagFor(token);
    if (flag !== undefined) {
      valid &&= !flags[flag];
      flags[flag] = true;
      continue;
    }
    const selected = renderModeFor(token);
    if (selected !== undefined) {
      valid &&= !renderSeen;
      renderMode = selected;
      renderSeen = true;
      continue;
    }
    const value = argv[index + 1];
    const named = createNamedOption(token, value, values);
    if (named === undefined) {
      valid = false;
      continue;
    }
    index += 1;
    values[named.key] = named.value;
  }
  return { flags, renderMode, valid, values };
}

function createFlagFor(
  token: string | undefined,
): "demoOnly" | "write" | undefined {
  if (token === "--demo-only") return "demoOnly";
  if (token === "--write") return "write";
  return undefined;
}

function createNamedOption(
  token: string | undefined,
  value: string | undefined,
  values: Readonly<Record<"name" | "outcome", string | undefined>>,
): { readonly key: "name" | "outcome"; readonly value: string } | undefined {
  const key =
    token === "--name" || token === "--outcome" ? token.slice(2) : undefined;
  if (
    (key !== "name" && key !== "outcome") ||
    values[key] !== undefined ||
    value === undefined ||
    value.startsWith("--")
  )
    return undefined;
  return { key, value };
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
