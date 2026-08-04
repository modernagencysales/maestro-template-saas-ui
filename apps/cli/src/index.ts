#!/usr/bin/env node
import type { Readable, Writable } from "node:stream";
import { createCliHandlers } from "./commands";
import { isCliDirectRun } from "./direct-run";
import { createFactoryCliComposition } from "./factory/composition";
import { dispatchFactoryCliCommand } from "./factory/router";
import { createHttpCapabilityRunner } from "./httpCapabilityClient";
import { decodeCliRuntimeConfig, emptyCliRuntimeConfig } from "./runtimeConfig";
import { dispatchCliCommand, dispatchCliCommandAsync } from "./router";
import type { CliResult, CliRuntimeConfig } from "./types";

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

const createRuntimeCliHandlers = (
  config: CliRuntimeConfig,
  fetch: typeof globalThis.fetch,
) =>
  createCliHandlers({
    capability: {
      hasCapability: (capabilityId) => staticCliCapabilityIds.has(capabilityId),
      runCapability: createHttpCapabilityRunner({ config, fetch }),
    },
  });

const cliHandlers = createRuntimeCliHandlers(
  emptyCliRuntimeConfig,
  globalThis.fetch,
);

const factoryCliComposition = createFactoryCliComposition(() => process.env);

const normalizeCliArgv = (argv: readonly string[]): readonly string[] =>
  argv[0] === "--" ? argv.slice(1) : argv;

export const runCli = (
  argv: readonly string[],
  config: CliRuntimeConfig = emptyCliRuntimeConfig,
): CliResult => dispatchCliCommand(cliHandlers, normalizeCliArgv(argv), config);

export const runCliAsync = async (
  argv: readonly string[],
  config: CliRuntimeConfig = emptyCliRuntimeConfig,
  cwd: string = process.cwd(),
  fetch: typeof globalThis.fetch = globalThis.fetch,
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
    (await dispatchCliCommandAsync(
      createRuntimeCliHandlers(config, fetch),
      normalized,
      config,
    ))
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
