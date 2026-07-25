import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
} from "../contracts.js";
import type { RepositoryContext } from "../repoContext.js";

export type ProviderDoctorEnvironment =
  "fake" | "local" | "dev" | "preview" | "staging";

export type ProviderDoctorReport = {
  readonly provider: string;
  readonly environment: ProviderDoctorEnvironment;
  readonly ready: boolean;
  readonly safeStoppingPoint: boolean;
  readonly reference: string;
  readonly missingEnvironmentNames: readonly string[];
  readonly invalidEnvironmentNames: readonly string[];
  readonly questions: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly why: string;
    readonly choices?: readonly string[];
  }[];
  readonly checks: readonly {
    readonly id: string;
    readonly status: "pass" | "warn" | "fail";
    readonly detail: string;
  }[];
  readonly aiFiles: {
    readonly status: "installed" | "recommended";
    readonly findings: readonly string[];
  };
  readonly mcp: {
    readonly enabled: false;
    readonly optInProfile: "none" | "inspect";
    readonly deployment: null | "dev";
    readonly alwaysDisabledTools: readonly string[];
  };
  readonly nextSteps: readonly string[];
};

export type ProviderDoctorAdapter = {
  readonly provider: string;
  readonly inspect: (
    environment: ProviderDoctorEnvironment,
    repo: RepositoryContext,
  ) => Promise<ProviderDoctorReport>;
};

type ProviderDoctorData =
  | ProviderDoctorReport
  | {
      readonly provider: string;
      readonly environment: ProviderDoctorEnvironment;
      readonly templateGap: true;
      readonly adjacentProviders: readonly ["convex"];
    };

export function createProviderDoctorCommand(dependencies: {
  readonly adapters: readonly ProviderDoctorAdapter[];
}) {
  return defineAgentPackCommand<
    "doctor",
    {
      readonly provider: string;
      readonly environment: ProviderDoctorEnvironment;
    },
    ProviderDoctorData
  >({
    id: "doctor",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeProviderDoctorInput,
    mutationPosture: () => "read-only" as const,
    execute: async (input, context) => {
      const adapter = dependencies.adapters.find(
        ({ provider }) => provider === input.provider,
      );
      if (adapter === undefined) {
        return {
          mutationPosture: "read-only" as const,
          exitClass: "findings" as const,
          summary: `Provider ${input.provider} has no reviewed doctor.`,
          diagnostics: [unknownProvider(input.provider)],
          data: {
            provider: input.provider,
            environment: input.environment,
            templateGap: true as const,
            adjacentProviders: ["convex"] as const,
          },
        };
      }
      const report = await adapter.inspect(input.environment, context.repo);
      const diagnostics = reportDiagnostics(report);
      return {
        mutationPosture: "read-only" as const,
        exitClass:
          diagnostics.length === 0
            ? ("success" as const)
            : ("findings" as const),
        summary: report.ready
          ? `${report.provider} is ready for ${report.environment}; no changes were made.`
          : `${report.provider} needs reviewed setup for ${report.environment}.`,
        diagnostics,
        data: report,
      };
    },
  });
}

function decodeProviderDoctorInput(value: unknown): AgentPackArgumentResult<{
  readonly provider: string;
  readonly environment: ProviderDoctorEnvironment;
}> {
  const environments = ["fake", "local", "dev", "preview", "staging"];
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Object.keys(value).every((key) =>
      ["provider", "environment"].includes(key),
    )
  )
    return invalidInput();
  const input = value as Record<string, unknown>;
  if (
    typeof input.provider !== "string" ||
    input.provider.length === 0 ||
    typeof input.environment !== "string" ||
    !environments.includes(input.environment)
  )
    return invalidInput();
  return {
    ok: true,
    args: {
      provider: input.provider,
      environment: input.environment as ProviderDoctorEnvironment,
    },
  };
}

function invalidInput(): AgentPackArgumentResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        code: "AGENT_PACK_PROVIDER_DOCTOR_INVALID",
        severity: "error",
        message:
          "Use doctor <provider> --environment fake|local|dev|preview|staging.",
        safeToContinue: true,
        nextAction:
          "Choose a non-production environment and one reviewed provider.",
        rerun: "pnpm maestro -- doctor convex --environment fake --json",
      },
    ],
  };
}

function reportDiagnostics(
  report: ProviderDoctorReport,
): readonly AgentPackDiagnostic[] {
  const diagnostics: AgentPackDiagnostic[] = [];
  if (report.missingEnvironmentNames.length > 0)
    diagnostics.push({
      code: "AGENT_PACK_PROVIDER_ENV_MISSING",
      severity: "warning",
      message: `Missing environment names: ${report.missingEnvironmentNames.join(", ")}.`,
      safeToContinue: report.safeStoppingPoint,
      nextAction:
        "Configure only the named environment entries for the selected non-production environment.",
      rerun: `pnpm maestro -- doctor ${report.provider} --environment ${report.environment} --json`,
    });
  if (report.invalidEnvironmentNames.length > 0)
    diagnostics.push({
      code: "AGENT_PACK_PROVIDER_ENV_INVALID",
      severity: "warning",
      message: `Environment names not admitted in ${report.environment}: ${report.invalidEnvironmentNames.join(", ")}.`,
      safeToContinue: report.safeStoppingPoint,
      nextAction:
        "Remove live selectors from fake/local child environments; do not print or copy their values.",
      rerun: `pnpm maestro -- doctor ${report.provider} --environment ${report.environment} --json`,
    });
  return diagnostics;
}

function unknownProvider(provider: string): AgentPackDiagnostic {
  return {
    code: "AGENT_PACK_PROVIDER_UNKNOWN",
    severity: "warning",
    message: `No reviewed doctor owns provider ${JSON.stringify(provider)}.`,
    safeToContinue: true,
    nextAction: "Use the adjacent Convex doctor or record a template-gap.",
    rerun: "pnpm maestro -- doctor convex --environment fake --json",
  };
}
