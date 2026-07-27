import type { RepositoryContext } from "../repoContext.js";
import type {
  ProviderDoctorAdapter,
  ProviderDoctorEnvironment,
  ProviderDoctorReport,
} from "./doctor.js";

type MaybePromise<T> = T | Promise<T>;
export type ConvexDoctorDependencies = {
  readonly environment: (
    repo: RepositoryContext,
  ) => MaybePromise<{ readonly availableEnvironmentNames: readonly string[] }>;
  readonly requiredEnvironmentNames: (
    repo: RepositoryContext,
  ) => MaybePromise<readonly string[]>;
  readonly templateProviderReport: (
    repo: RepositoryContext,
    environment: ProviderDoctorEnvironment,
  ) => MaybePromise<{
    readonly status: "pass" | "warn" | "fail";
    readonly detail: string;
  }>;
  readonly officialAiFilesFindings: (
    repo: RepositoryContext,
  ) => Promise<readonly string[]>;
  readonly mcpPolicy: {
    readonly fakeDisabled: true;
    readonly inspectDeployment: "dev";
    readonly productionUnsupported: true;
    readonly alwaysDisabledTools: readonly string[];
  };
};

export function createConvexDoctorAdapter(
  dependencies: ConvexDoctorDependencies,
): ProviderDoctorAdapter {
  return {
    provider: "convex",
    inspect: async (environment, repo) => {
      const [environmentReport, requiredNames, templateReport, aiFindings] =
        await Promise.all([
          dependencies.environment(repo),
          dependencies.requiredEnvironmentNames(repo),
          dependencies.templateProviderReport(repo, environment),
          dependencies.officialAiFilesFindings(repo),
        ]);
      const available = environmentReport.availableEnvironmentNames;
      const required = requirementsFor(environment, requiredNames);
      const invalid = invalidNamesFor(environment, available, requiredNames);
      const missing = required.filter((name) => !available.includes(name));
      const safeStoppingPoint =
        environment === "fake" || environment === "local";
      const ready =
        (safeStoppingPoint || missing.length === 0) &&
        templateReport.status !== "fail";
      return {
        provider: "convex",
        environment,
        ready,
        safeStoppingPoint,
        reference: "agent-pack/references/convex.md",
        missingEnvironmentNames: missing,
        invalidEnvironmentNames: invalid,
        questions: questionsFor(environment),
        checks: [
          {
            id: "template-provider-report",
            status: templateReport.status,
            detail: templateReport.detail,
          },
          {
            id: "environment-names",
            status:
              missing.length === 0 && invalid.length === 0 ? "pass" : "warn",
            detail: `required=${required.join(",") || "none"} missing=${missing.join(",") || "none"} invalid=${invalid.join(",") || "none"}`,
          },
          {
            id: "mcp-policy",
            status: "pass",
            detail: safeStoppingPoint
              ? "MCP is disabled."
              : "Inspect is explicit opt-in on a dev deployment; environment-value tools remain disabled.",
          },
        ],
        aiFiles: {
          status: aiFindings.length === 0 ? "installed" : "recommended",
          findings: aiFindings,
        },
        mcp: {
          enabled: false,
          optInProfile: safeStoppingPoint ? "none" : "inspect",
          deployment: safeStoppingPoint
            ? null
            : dependencies.mcpPolicy.inspectDeployment,
          alwaysDisabledTools: dependencies.mcpPolicy.alwaysDisabledTools,
        },
        nextSteps: nextStepsFor(environment),
      } satisfies ProviderDoctorReport;
    },
  };
}

function requirementsFor(
  environment: ProviderDoctorEnvironment,
  names: readonly string[],
): readonly string[] {
  if (environment === "fake" || environment === "local") return [];
  if (environment === "dev")
    return names.filter((name) => !name.includes("DEPLOY_KEY"));
  return names;
}

function invalidNamesFor(
  environment: ProviderDoctorEnvironment,
  available: readonly string[],
  names: readonly string[],
): readonly string[] {
  const deployKeys = ["CONVEX_DEPLOY_KEY", "TEMPLATE_CONVEX_DEPLOY_KEY"];
  const forbidden =
    environment === "fake" || environment === "local"
      ? new Set([...names, ...deployKeys])
      : environment === "dev"
        ? new Set(deployKeys)
        : new Set<string>();
  return available.filter((name) => forbidden.has(name));
}

function questionsFor(environment: ProviderDoctorEnvironment) {
  if (environment === "fake") return [];
  if (environment === "local")
    return [
      {
        id: "localData",
        prompt: "May this local Convex data be discarded?",
        why: "Local setup should not silently become a durable shared environment.",
        choices: ["yes", "no"],
      },
    ];
  if (environment === "dev")
    return [
      {
        id: "devDeployment",
        prompt:
          "Use a local backend or an authenticated personal dev deployment?",
        why: "The choice controls data location and whether explicit Convex authentication is needed.",
        choices: ["local", "personal-dev"],
      },
    ];
  return [
    {
      id: "promotionEvidence",
      prompt: `Has ${environment} passed provider doctor, codegen, smoke, and rollback review?`,
      why: "Promotion is explicit and never selects production automatically.",
      choices: ["yes", "no"],
    },
  ];
}

function nextStepsFor(
  environment: ProviderDoctorEnvironment,
): readonly string[] {
  if (environment === "fake")
    return [
      "Continue in fake mode; Convex authentication and MCP are not required.",
    ];
  if (environment === "local")
    return [
      "Start the explicit local backend and use generated http://127.0.0.1:3210 web wiring.",
      "Run Confect codegen before Convex codegen after schema/spec changes.",
    ];
  if (environment === "dev")
    return [
      "Choose local or personal dev, then authenticate only if personal dev was selected.",
      "Optionally preview the inspect MCP profile; never enable environment-value tools.",
    ];
  return [
    `Promote reviewed dev evidence to ${environment}; do not pass production flags.`,
  ];
}
