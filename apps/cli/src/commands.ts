import {
  buildApiCatalog,
  buildHeadlessOperations,
  buildMcpTools,
  buildOpenApiDocument,
  callMcpTool,
  describeWorkflowTemplate,
  getHeadlessOperation,
  runTemplateWorkflow,
} from "@maestro-template/workflow-tooling";
import {
  providerConfigReport,
  type ProviderMode,
} from "@maestro-template/integrations";
import { parseNamedArgs } from "./namedArgs";
import { ADOPT_HELP } from "./factory/adopt";
import { CREATE_HELP } from "./factory/create";
import { DOCTOR_HELP } from "./factory/doctor";
import { MCP_CONFIGURE_HELP } from "./factory/mcpConfigure";
import { PLAN_CHECK_HELP } from "./factory/planCheck";
import { ADD_HELP, RECIPES_HELP } from "./factory/recipes";
import { SCAFFOLD_HELP } from "./factory/scaffold";
import { START_HELP } from "./factory/start";
import { SUPPORT_BUNDLE_HELP } from "./factory/supportBundle";
import { CHECK_HELP, VERIFY_HELP } from "./factory/verify";
import { cliFailure, cliSuccess, formatJsonOutput } from "./result";
import type {
  CliCapabilityRequest,
  CliCapabilityResolver,
  CliCommandContext,
  CliCommandHandler,
  CliResult,
  CliRuntimeConfig,
} from "./types";
import { buildWorkflowPayloadForCli } from "./workflowReceipt";

type CliCommandDependencies = {
  readonly capability: CliCapabilityResolver;
};

const providerModes = new Set<ProviderMode>(["fake", "test", "live"]);

const helpResult = (): CliResult =>
  cliSuccess(
    [
      "Maestro has two repository modes:",
      "  factory checkout: contains releases/; create a separate app here",
      "  generated app: contains template-instance.json; build the product here",
      "",
      "Factory checkout:",
      `  ${CREATE_HELP.trim()}`,
      "",
      "Generated app loop (preflight -> inspect -> preview -> write -> verify -> run):",
      "  maestro preflight [--mode fake|test|live] [--details|--json]",
      `  ${RECIPES_HELP.trim()}`,
      `  ${ADD_HELP.trim()}`,
      `  ${VERIFY_HELP.trim()}`,
      `  ${CHECK_HELP.trim()}`,
      `  ${START_HELP.trim()}`,
      `  ${SUPPORT_BUNDLE_HELP.trim()}`,
      "",
      "Advanced factory and operator commands:",
      `  ${PLAN_CHECK_HELP.trim()}`,
      `  ${SCAFFOLD_HELP.trim()}`,
      `  ${DOCTOR_HELP.trim()}`,
      `  ${ADOPT_HELP.trim()}`,
      "  maestro mcp",
      `  ${MCP_CONFIGURE_HELP.trim()}`,
      "",
      "Shared headless surfaces:",
      "maestro-template describe",
      "maestro-template operations list",
      "maestro-template operations get <id>",
      "maestro-template capability run <id> [--workspace <slug>] [--input <json>] [--idempotency-key <key>]",
      "maestro-template workflow run [--workflow <id>] [--workspace <slug>] [--idempotency-key <key>] [--mode <mode>] [--input <json>]",
      "maestro-template api catalog",
      "maestro-template api openapi",
      "maestro-template mcp tools",
      "maestro-template mcp call <toolName>",
      "maestro-template integrations report [fake|test|live]",
    ].join("\n") + "\n",
  );

const operationsResult = ({
  subcommand,
  target,
}: CliCommandContext): CliResult => {
  if (subcommand === "list") {
    return cliSuccess(formatJsonOutput(buildHeadlessOperations()));
  }

  const operation = getHeadlessOperation(target ?? "");
  return operation
    ? cliSuccess(formatJsonOutput(operation))
    : cliFailure(`Unknown operation: ${target}\n`);
};

const parseCapabilityRequest = (
  argv: readonly string[],
): CliCapabilityRequest | CliResult => {
  const [, , , ...requestArgs] = argv;
  const parsedArgs = parseNamedArgs(requestArgs);
  if (!parsedArgs.ok) {
    return cliFailure(`${parsedArgs.message}\n`);
  }

  const { workspaceSlug, input, idempotencyKey } = parsedArgs.args;
  if (
    workspaceSlug === undefined ||
    input === undefined ||
    idempotencyKey === undefined
  ) {
    return cliFailure(
      "capability run requires --workspace, --input, and --idempotency-key.\n",
    );
  }

  return { workspaceSlug, input, idempotencyKey };
};

const isCliResult = (
  value: CliCapabilityRequest | CliResult,
): value is CliResult => "exitCode" in value;

const capabilityResult = (
  { argv, target }: CliCommandContext,
  capability: CliCapabilityResolver,
): CliResult => {
  const capabilityId = target ?? "";
  if (!capability.hasCapability(capabilityId)) {
    return cliFailure(`Unknown CLI capability: ${target}\n`);
  }

  const request = parseCapabilityRequest(argv);
  return isCliResult(request)
    ? request
    : capability.runCapability(capabilityId, request);
};

const apiResult = ({ subcommand }: CliCommandContext): CliResult =>
  cliSuccess(
    formatJsonOutput(
      subcommand === "catalog" ? buildApiCatalog() : buildOpenApiDocument(),
    ),
  );

const mcpToolsResult = (): CliResult =>
  cliSuccess(formatJsonOutput(buildMcpTools()));

const mcpCallResult = ({ target }: CliCommandContext): CliResult => {
  const result = callMcpTool(target ?? "");

  return {
    exitCode: result.isError ? 1 : 0,
    stdout: formatJsonOutput(result),
    stderr: "",
  };
};

const mcpResult = (context: CliCommandContext): CliResult =>
  context.subcommand === "tools" ? mcpToolsResult() : mcpCallResult(context);

const parseProviderMode = (mode: string): ProviderMode | undefined =>
  providerModes.has(mode as ProviderMode) ? (mode as ProviderMode) : undefined;

const integrationsResult = (
  { target }: CliCommandContext,
  config: CliRuntimeConfig,
): CliResult => {
  const mode = target ?? "fake";
  const providerMode = parseProviderMode(mode);

  return providerMode === undefined
    ? cliFailure(`Unknown provider mode: ${mode}\n`)
    : cliSuccess(
        formatJsonOutput(
          providerConfigReport(providerMode, config.providerEnv),
        ),
      );
};

const workflowResult = ({ argv }: CliCommandContext): CliResult => {
  const workflowArgs = argv.slice(2);
  const parsedArgs = parseNamedArgs(workflowArgs);
  if (!parsedArgs.ok) {
    return cliFailure(`${parsedArgs.message}\n`);
  }

  try {
    return cliSuccess(
      formatJsonOutput(
        buildWorkflowPayloadForCli(runTemplateWorkflow(), parsedArgs.args),
      ),
    );
  } catch (error) {
    return cliFailure(
      `${error instanceof Error ? error.message : "Workflow run failed."}\n`,
    );
  }
};

export const createCliHandlers = ({
  capability,
}: CliCommandDependencies): readonly CliCommandHandler[] => [
  {
    matches: ({ command }) =>
      !command || command === "help" || command === "--help",
    run: () => helpResult(),
  },
  {
    matches: ({ command }) => command === "describe",
    run: () => cliSuccess(formatJsonOutput(describeWorkflowTemplate())),
  },
  {
    matches: ({ command, subcommand, target }) =>
      command === "operations" &&
      (subcommand === "list" || (subcommand === "get" && target !== undefined)),
    run: (context) => operationsResult(context),
  },
  {
    matches: ({ command, subcommand }) =>
      command === "workflow" && subcommand === "run",
    run: (context) => workflowResult(context),
  },
  {
    matches: ({ command, subcommand, target }) =>
      command === "capability" && subcommand === "run" && target !== undefined,
    run: (context) => capabilityResult(context, capability),
  },
  {
    matches: ({ command, subcommand }) =>
      command === "api" &&
      (subcommand === "catalog" || subcommand === "openapi"),
    run: (context) => apiResult(context),
  },
  {
    matches: ({ command, subcommand, target }) =>
      command === "mcp" &&
      (subcommand === "tools" ||
        (subcommand === "call" && target !== undefined)),
    run: (context) => mcpResult(context),
  },
  {
    matches: ({ command, subcommand }) =>
      command === "integrations" && subcommand === "report",
    run: (context, config) => integrationsResult(context, config),
  },
];
