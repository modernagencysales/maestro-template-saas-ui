#!/usr/bin/env node
import { runTemplateApiOperation } from "@maestro-template/workflow-tooling";
import type { Readable, Writable } from "node:stream";
import { createCliHandlers, parseCapabilityRequest } from "./commands";
import { isCliDirectRun } from "./direct-run";
import { createFactoryCliComposition } from "./factory/composition";
import { dispatchFactoryCliCommand } from "./factory/router";
import { cliFailure, formatJsonOutput } from "./result";
import { decodeCliRuntimeConfig, emptyCliRuntimeConfig } from "./runtimeConfig";
import { dispatchCliCommand } from "./router";
import type {
  CliCapabilityRequest,
  CliResult,
  CliRuntimeConfig,
} from "./types";

export { decodeCliRuntimeConfig };
export type { CliResult, CliRuntimeConfig };

export const staticCliOperationRefs: Readonly<Record<string, string>> = {
  "brain.pages.createMarkdown": "brain.pages.createMarkdown",
  "ops.email.previewBroadcast": "ops.email.previewBroadcast",
  "ops.email.dispatchBroadcast": "ops.email.dispatchBroadcast",
};

export const staticCliCapabilityIds: ReadonlySet<string> = new Set(
  Object.keys(staticCliOperationRefs),
);

const runStaticCliCapability = (
  capabilityId: string,
  request: CliCapabilityRequest,
): CliResult => {
  const operationId = staticCliOperationRefs[capabilityId];
  if (!staticCliCapabilityIds.has(capabilityId) || operationId === undefined) {
    return cliFailure(`Unknown CLI capability: ${capabilityId}\n`);
  }

  const result = runTemplateApiOperation(operationId, request);

  return {
    exitCode: result.ok ? 0 : 1,
    stdout: formatJsonOutput(result),
    stderr: "",
  };
};

const cliHandlers = createCliHandlers({
  capability: {
    hasCapability: (capabilityId) => staticCliCapabilityIds.has(capabilityId),
    runCapability: runStaticCliCapability,
  },
});

const factoryCliComposition = createFactoryCliComposition(() => process.env);

const normalizeCliArgv = (argv: readonly string[]): readonly string[] =>
  argv[0] === "--" ? argv.slice(1) : argv;

export const runCli = (
  argv: readonly string[],
  config: CliRuntimeConfig = emptyCliRuntimeConfig,
): CliResult => dispatchCliCommand(cliHandlers, normalizeCliArgv(argv), config);

type RemoteCapabilityFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const remoteCapabilityTarget = (
  argv: readonly string[],
  environment: NodeJS.ProcessEnv,
): { readonly baseUrl: string; readonly operationId: string } | undefined => {
  const baseUrl = environment.MAESTRO_API_BASE_URL?.trim();
  return baseUrl &&
    argv[0] === "capability" &&
    argv[1] === "run" &&
    argv[2] !== undefined
    ? { baseUrl, operationId: argv[2] }
    : undefined;
};

const remoteCapabilityResult = async (
  response: Response,
): Promise<CliResult> => {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return cliFailure("Remote capability response was not valid JSON.\n");
  }
  if (payload === null || typeof payload !== "object") {
    return cliFailure("Remote capability response was not a JSON object.\n");
  }
  return {
    exitCode: response.ok && "ok" in payload && payload.ok === true ? 0 : 1,
    stdout: formatJsonOutput(payload),
    stderr: "",
  };
};

export const runRemoteCapability = async (
  argv: readonly string[],
  environment: NodeJS.ProcessEnv,
  request: RemoteCapabilityFetch = fetch,
): Promise<CliResult | undefined> => {
  const target = remoteCapabilityTarget(argv, environment);
  if (!target) return undefined;

  const parsed = parseCapabilityRequest(argv);
  if ("exitCode" in parsed) return parsed;

  try {
    const response = await request(
      new URL(
        `api/${encodeURIComponent(target.operationId)}`,
        `${target.baseUrl.replace(/\/+$/u, "")}/`,
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(environment.MAESTRO_API_KEY
            ? { authorization: `Bearer ${environment.MAESTRO_API_KEY}` }
            : {}),
        },
        body: JSON.stringify(parsed),
      },
    );
    return remoteCapabilityResult(response);
  } catch {
    return cliFailure("Remote capability request failed.\n");
  }
};

export const runCliAsync = async (
  argv: readonly string[],
  config: CliRuntimeConfig = emptyCliRuntimeConfig,
  cwd: string = process.cwd(),
): Promise<CliResult> => {
  const normalized = normalizeCliArgv(argv);
  if (normalized[0] === "mcp" && normalized[1] === "configure") {
    return factoryCliComposition.mcpConfigure.run(normalized.slice(1), cwd);
  }
  return (
    (await dispatchFactoryCliCommand(
      factoryCliComposition.handlers,
      normalized,
      cwd,
    )) ??
    (await runRemoteCapability(normalized, process.env)) ??
    dispatchCliCommand(cliHandlers, normalized, config)
  );
};

export type CliEntryStreams = {
  readonly stdin: Readable;
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly cwd: string;
};

export async function runCliEntry(
  argv: readonly string[],
  streams: CliEntryStreams,
  config: CliRuntimeConfig = emptyCliRuntimeConfig,
): Promise<void> {
  const normalized = normalizeCliArgv(argv);
  if (normalized.length === 1 && normalized[0] === "mcp") {
    await factoryCliComposition.mcp.serve(streams);
    return;
  }
  const result = await runCliAsync(normalized, config, streams.cwd);
  streams.stdout.write(result.stdout);
  streams.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

if (isCliDirectRun(import.meta.url)) {
  void runCliEntry(
    process.argv.slice(2),
    {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      cwd: process.cwd(),
    },
    decodeCliRuntimeConfig(process.env),
  ).catch(() => {
    process.stderr.write("MCP_SERVER_ERROR startup\n");
    process.exitCode = 70;
  });
}
