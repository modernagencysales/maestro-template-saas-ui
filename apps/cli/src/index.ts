#!/usr/bin/env node
import { runTemplateApiOperation } from "@maestro-template/workflow-tooling";
import { createCliHandlers } from "./commands";
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
): Promise<CliResult> => {
  const normalized = normalizeCliArgv(argv);
  return (
    (await dispatchFactoryCliCommand(normalized, cwd)) ??
    dispatchCliCommand(cliHandlers, normalized, config)
  );
};

if (
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
) {
  void runCliAsync(
    process.argv.slice(2),
    decodeCliRuntimeConfig(process.env),
  ).then((result) => {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  });
}
