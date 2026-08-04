import type { AgentPackExitCode } from "@maestro-template/agent-pack";
import type { CliNamedArgs } from "./namedArgs";

export type CliResult = {
  readonly exitCode: AgentPackExitCode;
  readonly stdout: string;
  readonly stderr: string;
};

export type CliRuntimeConfig = {
  readonly providerEnv: Record<string, string | undefined>;
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
};

export type CliCommandContext = {
  readonly argv: readonly string[];
  readonly command: string | undefined;
  readonly subcommand: string | undefined;
  readonly target: string | undefined;
};

export type CliCommandHandler = {
  readonly matches: (context: CliCommandContext) => boolean;
  readonly run: (
    context: CliCommandContext,
    config: CliRuntimeConfig,
  ) => CliResult | Promise<CliResult>;
};

export type CliCapabilityRequest = Required<
  Pick<CliNamedArgs, "workspaceSlug" | "input" | "idempotencyKey">
> &
  Pick<CliNamedArgs, "correlationNonce">;

export type CliCapabilityRunner = (
  capabilityId: string,
  request: CliCapabilityRequest,
) => Promise<CliResult>;

export type CliCapabilityResolver = {
  readonly hasCapability: (capabilityId: string) => boolean;
  readonly runCapability: CliCapabilityRunner;
};
