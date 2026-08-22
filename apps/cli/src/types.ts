import type { AgentPackExitCode } from "@maestro-template/agent-pack";
import type { CliNamedArgs } from "./namedArgs";

export type CliResult = {
  readonly exitCode: AgentPackExitCode;
  readonly stdout: string;
  readonly stderr: string;
};

export type CliRuntimeConfig = {
  readonly providerEnv: Record<string, string | undefined>;
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
  ) => CliResult;
};

export type CliCapabilityRequest = Required<
  Pick<CliNamedArgs, "workspaceSlug" | "input" | "idempotencyKey">
>;

export type CliCapabilityRunner = (
  capabilityId: string,
  request: CliCapabilityRequest,
) => CliResult;

export type CliCapabilityResolver = {
  readonly hasCapability: (capabilityId: string) => boolean;
  readonly runCapability: CliCapabilityRunner;
};
