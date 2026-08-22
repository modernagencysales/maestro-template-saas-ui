import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { validatePromotionAuthorityEndpoint } from "./deploy/durableAuthority.js";
export * from "./deploy/audit.js";
export * from "./deploy/authority.js";
export * from "./deploy/census.js";
export * from "./deploy/censusEndpoint.js";
export * from "./deploy/checkpoint.js";
export * from "./deploy/consumption.js";
export * from "./deploy/contract.js";
export * from "./deploy/decision.js";
export * from "./deploy/durableAuthority.js";
export { evaluatePromotionRequirements } from "./deploy/requirements.js";
export type {
  PromotionEnvironment,
  PromotionReadinessInput,
  PromotionReadinessResult,
  PromotionRequirement,
  PromotionRequirementEvidence,
  PromotionRequirementFinding,
} from "./deploy/requirements.js";
export * from "./deploy/trustedAuthority.js";
export * from "./deploy/verdict.js";
export * from "./deploy/verify.js";

export type WebStaticSmokeReport = {
  readonly ok: boolean;
  readonly distPath: string;
  readonly indexHtmlBytes: number;
  readonly assetCount: number;
  readonly checks: readonly {
    readonly id: string;
    readonly status: "pass" | "fail";
    readonly detail: string;
  }[];
};

export type ReviewerReadinessReport = {
  readonly ok: boolean;
  readonly auditKind: "presence";
  readonly warning: string;
  readonly repoRoot: string;
  readonly commit: string;
  readonly hostedUrl: string;
  readonly artifacts: readonly {
    readonly path: string;
    readonly status: "pass" | "fail";
    readonly detail: string;
  }[];
  readonly claims: readonly {
    readonly id: string;
    readonly status: "pass" | "fail";
    readonly evidence: readonly string[];
    readonly detail: string;
  }[];
  readonly commands: readonly string[];
};

export type CompletionAuditReport = {
  readonly ok: boolean;
  readonly auditKind: "presence";
  readonly warning: string;
  readonly repoRoot: string;
  readonly commit: string;
  readonly hostedUrl: string;
  readonly requirements: readonly {
    readonly id: string;
    readonly requirement: string;
    readonly status: "pass" | "fail";
    readonly evidence: readonly string[];
    readonly verification: readonly string[];
    readonly detail: string;
  }[];
};

export type ClientReleaseReport = {
  readonly ok: boolean;
  readonly repoRoot: string;
  readonly templateVersion: string;
  readonly clientVersion: string;
  readonly compatibility: {
    readonly status: "ready-for-review" | "missing-artifacts";
    readonly requiredChecks: readonly string[];
    readonly notes: readonly string[];
  };
  readonly handoffArtifacts: readonly {
    readonly path: string;
    readonly status: "pass" | "fail";
    readonly detail: string;
  }[];
};

export type DeployEnvironmentName = "staging" | "production";

export type DeployEnvironmentConfig = {
  readonly name: DeployEnvironmentName;
  readonly domain: string;
  readonly cloudflarePagesProject: string;
  readonly cloudflareBranch: string;
  readonly convexDeployName: string;
  readonly convexUrl: string;
  readonly requiredEnvGroups: readonly string[];
  readonly requiredSecrets: readonly string[];
};

export type ProjectConfig = {
  readonly project: {
    readonly name: string;
  };
  readonly environments: Record<DeployEnvironmentName, DeployEnvironmentConfig>;
};

export type DeployDoctorReport = {
  readonly ok: boolean;
  readonly environment: DeployEnvironmentName;
  readonly domain: string;
  readonly cloudflarePagesProject: string;
  readonly convexDeployName: string;
  readonly requiredEnvGroups: readonly string[];
  readonly manifestPath: string;
  readonly requiredEnvNames: readonly string[];
  readonly requiredSecretNames: readonly string[];
  readonly missingEnvNames: readonly string[];
  readonly missingSecretNames: readonly string[];
  readonly invalidEnvNames: readonly string[];
  readonly alert?: ReleaseAlertPlan;
};

export type DeployPlan = {
  readonly ok: boolean;
  readonly environment: DeployEnvironmentName;
  readonly commitSha: string;
  readonly domain: string;
  readonly cloudflarePagesProject: string;
  readonly cloudflareBranch: string;
  readonly convexDeployName: string;
  readonly refusal?: string;
  readonly alert?: ReleaseAlertPlan;
};

export type ReleaseAlertPlan = {
  readonly severity: "warning" | "critical";
  readonly title: string;
  readonly body: string;
  readonly dedupeKey: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

const pass = (id: string, detail: string) => ({
  id,
  status: "pass" as const,
  detail,
});

const fail = (id: string, detail: string) => ({
  id,
  status: "fail" as const,
  detail,
});

const readProjectConfig = (repoRoot: string): ProjectConfig => {
  const path = resolve(repoRoot, "project.config.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ProjectConfig;

  return parsed;
};

type EnvManifestVariable = {
  readonly name: string;
  readonly group: string;
  readonly requiredFor: readonly string[];
};

type EnvManifest = {
  readonly variables: readonly EnvManifestVariable[];
};

const envManifestPath = (repoRoot: string): string =>
  resolve(repoRoot, "docs/template/env-manifest.json");

const readEnvManifest = (repoRoot: string): EnvManifest | undefined => {
  const path = envManifestPath(repoRoot);

  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8")) as EnvManifest;
};

const deployEnvGroupAliases = {
  llm: ["openrouter"],
  email: ["email"],
  "fake-providers": [
    "app",
    "workos",
    "posthog",
    "dodo",
    "email",
    "openrouter",
    "storage",
    "search",
  ],
} as const satisfies Record<string, readonly string[]>;

const expandEnvGroups = (groups: readonly string[]): readonly string[] => [
  ...new Set(
    groups.flatMap(
      (group) =>
        deployEnvGroupAliases[group as keyof typeof deployEnvGroupAliases] ?? [
          group,
        ],
    ),
  ),
];

const manifestRequiredFor = (
  environment: DeployEnvironmentName,
): readonly string[] =>
  environment === "production" ? ["live", "deploy"] : ["deploy"];

const manifestRequiredEnvNames = (
  manifest: EnvManifest | undefined,
  groups: readonly string[],
  environment: DeployEnvironmentName,
): readonly string[] => {
  if (!manifest) {
    return [];
  }

  const expandedGroups = new Set(expandEnvGroups(groups));
  const requiredFor = new Set(manifestRequiredFor(environment));

  return [
    ...new Set(
      manifest.variables
        .filter((variable) => expandedGroups.has(variable.group))
        .filter((variable) =>
          variable.requiredFor.some((mode) => requiredFor.has(mode)),
        )
        .map((variable) => variable.name),
    ),
  ].sort();
};

const deployDoctorAlert = (
  report: Omit<DeployDoctorReport, "alert">,
): ReleaseAlertPlan | undefined => {
  if (report.ok) {
    return undefined;
  }

  const missingNames = [
    ...new Set([
      ...report.missingEnvNames,
      ...report.missingSecretNames,
      ...report.invalidEnvNames,
    ]),
  ].sort();

  return {
    severity: report.environment === "production" ? "critical" : "warning",
    title: `Deploy doctor failed: ${report.environment}`,
    body: `Missing ${report.missingEnvNames.length} manifest env names and ${report.missingSecretNames.length} required deploy secrets; ${report.invalidEnvNames.length} env names are invalid.`,
    dedupeKey: `deploy-doctor:${report.environment}:${missingNames.join("|") || "unknown"}`,
    metadata: {
      environment: report.environment,
      domain: report.domain,
      cloudflarePagesProject: report.cloudflarePagesProject,
      convexDeployName: report.convexDeployName,
      requiredEnvGroups: report.requiredEnvGroups,
      missingEnvNames: report.missingEnvNames,
      missingSecretNames: report.missingSecretNames,
      invalidEnvNames: report.invalidEnvNames,
    },
  };
};

const productionPromoteAlert = (
  plan: Omit<DeployPlan, "alert">,
): ReleaseAlertPlan | undefined => {
  if (plan.ok) {
    return undefined;
  }

  return {
    severity: "critical",
    title: "Production promotion refused",
    body: plan.refusal ?? "Production promotion was refused.",
    dedupeKey: `production-promote:${plan.commitSha}:${plan.environment}`,
    metadata: {
      environment: plan.environment,
      commitSha: plan.commitSha,
      domain: plan.domain,
      cloudflarePagesProject: plan.cloudflarePagesProject,
      cloudflareBranch: plan.cloudflareBranch,
      convexDeployName: plan.convexDeployName,
      refusal: plan.refusal,
    },
  };
};

const deployEnvironment = (
  repoRoot: string,
  environment: DeployEnvironmentName,
): DeployEnvironmentConfig => {
  const config = readProjectConfig(repoRoot);
  const selected = config.environments[environment];

  if (!selected) {
    throw new Error(`Unknown deploy environment: ${environment}`);
  }

  return selected;
};

export const buildDeployDoctorReport = (options: {
  readonly repoRoot?: string;
  readonly environment: DeployEnvironmentName;
  readonly env?: NodeJS.ProcessEnv;
}): DeployDoctorReport => {
  const repoRoot = options.repoRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const selected = deployEnvironment(repoRoot, options.environment);
  const manifest = readEnvManifest(repoRoot);
  const requiredEnvNames = manifestRequiredEnvNames(
    manifest,
    selected.requiredEnvGroups,
    selected.name,
  );
  const missingEnvNames = requiredEnvNames.filter((name) => !env[name]?.trim());
  const missingSecretNames = selected.requiredSecrets.filter(
    (name) => !env[name]?.trim(),
  );
  const invalidEnvNames: string[] = [];
  if (env.PROMOTION_AUTHORITY_ENDPOINT?.trim()) {
    try {
      validatePromotionAuthorityEndpoint(
        env.PROMOTION_AUTHORITY_ENDPOINT,
        selected.convexUrl,
      );
    } catch {
      invalidEnvNames.push("PROMOTION_AUTHORITY_ENDPOINT");
    }
  }

  const report: Omit<DeployDoctorReport, "alert"> = {
    ok:
      missingSecretNames.length === 0 &&
      missingEnvNames.length === 0 &&
      invalidEnvNames.length === 0,
    environment: selected.name,
    domain: selected.domain,
    cloudflarePagesProject: selected.cloudflarePagesProject,
    convexDeployName: selected.convexDeployName,
    requiredEnvGroups: selected.requiredEnvGroups,
    manifestPath: envManifestPath(repoRoot),
    requiredEnvNames,
    requiredSecretNames: selected.requiredSecrets,
    missingEnvNames,
    missingSecretNames,
    invalidEnvNames,
  };

  const alert = deployDoctorAlert(report);

  return {
    ...report,
    ...(alert ? { alert } : {}),
  };
};

export const buildStagingDeployPlan = (options: {
  readonly repoRoot?: string;
  readonly commitSha: string;
}): DeployPlan => {
  const repoRoot = options.repoRoot ?? process.cwd();
  const selected = deployEnvironment(repoRoot, "staging");

  return {
    ok: true,
    environment: "staging",
    commitSha: options.commitSha,
    domain: selected.domain,
    cloudflarePagesProject: selected.cloudflarePagesProject,
    cloudflareBranch: selected.cloudflareBranch,
    convexDeployName: selected.convexDeployName,
  };
};

export const buildProductionPromotePlan = (options: {
  readonly repoRoot?: string;
  readonly stagedSha: string;
  readonly currentSha: string;
}): DeployPlan => {
  const repoRoot = options.repoRoot ?? process.cwd();
  const selected = deployEnvironment(repoRoot, "production");

  if (options.stagedSha !== options.currentSha) {
    const plan: Omit<DeployPlan, "alert"> = {
      ok: false,
      environment: "production",
      commitSha: options.currentSha,
      domain: selected.domain,
      cloudflarePagesProject: selected.cloudflarePagesProject,
      cloudflareBranch: selected.cloudflareBranch,
      convexDeployName: selected.convexDeployName,
      refusal: `Refusing production promotion: staged SHA ${options.stagedSha} does not match current SHA ${options.currentSha}.`,
    };
    const alert = productionPromoteAlert(plan);

    return {
      ...plan,
      ...(alert ? { alert } : {}),
    };
  }

  return {
    ok: true,
    environment: "production",
    commitSha: options.currentSha,
    domain: selected.domain,
    cloudflarePagesProject: selected.cloudflarePagesProject,
    cloudflareBranch: selected.cloudflareBranch,
    convexDeployName: selected.convexDeployName,
  };
};

const readinessArtifacts = [
  "README.md",
  "AGENTS.md",
  "docs/template/investor-reviewer-packet.md",
  "docs/template/reviewer-guide.md",
  "docs/template/repo-map.md",
  "docs/template/confect-effect-guide.md",
  "docs/template/app-factory-guide.md",
  "docs/template/private-package-guide.md",
  "docs/template/hosting.md",
  "docs/template/security.md",
  "docs/rule-coverage.md",
  "packages/convex/confect/http.ts",
  "packages/convex/confect/_generated/refs.ts",
  "packages/convex/confect/jobs/workpool.spec.ts",
  "packages/convex/test/confect-contracts.test.ts",
  "packages/workflow-ui/src/index.tsx",
  "packages/template-core/src/index.ts",
  "tooling/workflow/src/index.ts",
  "tooling/generators/src/index.ts",
  "tests/e2e/saas-ui-golden.spec.ts",
  "tests/e2e/saas-ui-golden.visual.spec.ts",
] as const;

const clientReleaseHandoffArtifacts = [
  "template-instance.json",
  "docs/template/generated/client-intake.md",
  "docs/template/generated/implementation-brief.md",
  "docs/template/generated/provider-setup-checklist.md",
  "docs/template/generated/handoff-packet.md",
  "docs/template/env-manifest.md",
  "docs/template/template-release-process.md",
] as const;

const clientReleaseRequiredChecks = [
  "pnpm check:generators",
  "pnpm check:confect-contracts",
  "pnpm check:workflow-graph-boundary",
  "pnpm check:schema-migration-notes",
  "pnpm check:secret-canaries",
  "pnpm review:readiness",
] as const;

const requiredHandoffStatusLabels = [
  "real",
  "fake",
  "seam",
  "planned",
] as const;

const validateClientReleaseArtifact = (
  repoRoot: string,
  artifactPath: string,
): {
  readonly path: string;
  readonly status: "pass" | "fail";
  readonly detail: string;
} => {
  const fullPath = resolve(repoRoot, artifactPath);

  if (!existsSync(fullPath)) {
    return {
      path: artifactPath,
      status: "fail",
      detail: `missing ${fullPath}`,
    };
  }

  if (artifactPath === "docs/template/generated/handoff-packet.md") {
    const content = readFileSync(fullPath, "utf8");
    const missingLabels = requiredHandoffStatusLabels.filter(
      (label) =>
        !content.includes(`\`${label}\``) &&
        !new RegExp(`(^|\\s)${label}:`, "i").test(content),
    );

    if (missingLabels.length > 0) {
      return {
        path: artifactPath,
        status: "fail",
        detail: `missing handoff status labels: ${missingLabels.join(", ")}`,
      };
    }
  }

  return {
    path: artifactPath,
    status: "pass",
    detail: "present",
  };
};

const readinessClaims = [
  {
    id: "saas-ui-golden-authorities",
    evidence: [
      "apps/web/src/routes/index.tsx",
      "apps/web/src/features/common/layouts/app-layout.tsx",
      "tests/e2e/saas-ui-golden.spec.ts",
      "tests/e2e/saas-ui-golden.visual.spec.ts",
    ],
    detail:
      "Hosted app has a concrete reference surface plus browser and visual smoke coverage.",
  },
  {
    id: "confect-effect-contracts",
    evidence: [
      "docs/template/confect-effect-guide.md",
      "packages/convex/confect/_generated/refs.ts",
      "packages/convex/test/confect-contracts.test.ts",
      "packages/convex/confect/jobs/workpool.spec.ts",
    ],
    detail:
      "Confect/Effect path has pinned versions, generated refs, contract tests, and plain Convex interop.",
  },
  {
    id: "workflow-react-flow-primitive",
    evidence: [
      "packages/workflow-ui/src/index.tsx",
      "tooling/quality/check-workflow-graph-boundary.mts",
      "docs/template/workflow-authoring-guide.md",
    ],
    detail:
      "React Flow is kept as a reusable UI primitive while durable workflow logic remains schema-backed.",
  },
  {
    id: "headless-api-cli-mcp",
    evidence: [
      "packages/template-core/src/index.ts",
      "tooling/workflow/src/index.ts",
      "apps/cli/src/index.ts",
      "packages/convex/confect/http.ts",
    ],
    detail:
      "API, CLI, MCP, and Scalar/OpenAPI projections come from generated Confect manifest metadata.",
  },
  {
    id: "provider-adapter-harness",
    evidence: [
      "packages/integrations/src/index.ts",
      "packages/integrations/src/index.test.ts",
      "docs/template/integrations.md",
    ],
    detail:
      "Provider integrations use Effect service boundaries with fake/test/live-ready adapter posture.",
  },
  {
    id: "app-factory-generators",
    evidence: [
      "tooling/generators/src/index.ts",
      "tooling/generators/src/index.test.ts",
      "docs/template/app-factory-guide.md",
      "docs/template/private-package-guide.md",
    ],
    detail:
      "App factory commands cover initialization, generated capabilities/workflows, promotion, upgrades, and private packages.",
  },
  {
    id: "security-and-rules",
    evidence: [
      "AGENTS.md",
      "docs/template/security.md",
      "docs/template/coding-standards.md",
      "docs/rule-coverage.md",
      "tooling/quality/check-secret-canaries.mts",
      "tooling/quality/check-auth-demo-bypass.mts",
    ],
    detail:
      "Coding rules, security posture, and static gates document and enforce the core safety model.",
  },
] as const;

const completionRequirements = [
  {
    id: "private-template-repo",
    requirement:
      "A private template repo exists and is navigable as an internal app factory, not a public starter kit.",
    evidence: [
      "README.md",
      "AGENTS.md",
      "docs/template/repo-map.md",
      "docs/template/investor-reviewer-packet.md",
    ],
    verification: ["pnpm review:readiness"],
    detail:
      "Repo entry points, agent rules, map, and investor packet are present.",
  },
  {
    id: "clear-sample-app",
    requirement:
      "The repo contains a clear, useful sample app that demonstrates Brain, workflow, capability, agent, integration, and safety surfaces.",
    evidence: [
      "apps/web/src/routes/index.tsx",
      "apps/web/src/features/common/layouts/app-layout.tsx",
      "apps/web/src/sample/templateData.ts",
      "apps/web/src/sample/templateData.test.ts",
      "examples/generic-ai-ops/seed/workspace.json",
      "examples/generic-ai-ops/seed/brain-pages.md",
      "examples/generic-ai-ops/seed/workflows.json",
      "tests/e2e/saas-ui-golden.spec.ts",
      "tests/e2e/saas-ui-golden.visual.spec.ts",
    ],
    verification: [
      "pnpm --dir apps/web test src/sample/templateData.test.ts",
      "pnpm smoke:golden:browser",
      "pnpm smoke:golden:visual",
    ],
    detail:
      "Reference app data, seed fixtures, and browser/visual tests cover the investor-visible sample app.",
  },
  {
    id: "saas-ui-golden",
    requirement:
      "The sample app is hosted or can be immediately hosted from the static build.",
    evidence: [
      "docs/template/hosting.md",
      "tests/e2e/saas-ui-golden.spec.ts",
      "tests/e2e/saas-ui-golden.visual.spec.ts",
    ],
    verification: [
      "pnpm build",
      "pnpm smoke:web-static",
      "pnpm smoke:golden:browser",
      "pnpm smoke:golden:a11y",
      "pnpm smoke:golden:visual",
    ],
    detail:
      "Cloudflare Pages URL and static/hosted smoke paths are documented and testable.",
  },
  {
    id: "confect-effect-framework",
    requirement:
      "The template uses Confect and Effect for typed contracts while preserving Convex component interop.",
    evidence: [
      "docs/template/confect-effect-guide.md",
      "packages/convex/confect/_generated/refs.ts",
      "packages/convex/test/confect-contracts.test.ts",
      "packages/convex/confect/jobs/workpool.spec.ts",
    ],
    verification: [
      "pnpm check:confect-contracts",
      "pnpm check:confect-compat",
      "pnpm --dir packages/convex test",
    ],
    detail:
      "Pinned compatibility, generated refs, contract tests, and plain Convex Workpool interop are present.",
  },
  {
    id: "workflow-capability-agent-primitives",
    requirement:
      "Reusable workflows, capabilities, agents, React Flow, API, CLI, MCP, and integration primitives are included without Maestro-specific business logic.",
    evidence: [
      "packages/workflow-ui/src/index.tsx",
      "packages/template-core/src/index.ts",
      "tooling/workflow/src/index.ts",
      "apps/cli/src/index.ts",
      "docs/template/workflow-authoring-guide.md",
      "docs/template/capability-authoring-guide.md",
    ],
    verification: [
      "pnpm test:workflow",
      "pnpm check:workflow-graph-boundary",
      "pnpm exec tsx apps/cli/src/index.ts describe",
      "pnpm exec tsx apps/cli/src/index.ts mcp tools",
    ],
    detail:
      "Workflow UI, headless registry, CLI/MCP projection, and authoring guides are present.",
  },
  {
    id: "app-factory",
    requirement:
      "The repo can be used to start custom client apps, promote generated capabilities/workflows, upgrade forks, and import private packages.",
    evidence: [
      "tooling/generators/src/index.ts",
      "tooling/generators/src/index.test.ts",
      "docs/template/app-factory-guide.md",
      "docs/template/private-package-guide.md",
    ],
    verification: [
      "pnpm check:generators",
      "pnpm --dir tooling/generators test",
      'pnpm template:init -- --name "Reviewer Brain"',
      "pnpm template:private-package:dry-run -- --fixture examples/generic-ai-ops",
    ],
    detail:
      "Generator implementation, tests, and app-factory/private-package docs are present.",
  },
  {
    id: "day-0-factory-loop",
    requirement:
      "The starter proves the Day-0 loop from quickstart to fake doctor, deterministic seed, and handoff packet.",
    evidence: [
      "docs/template/quickstart.md",
      "apps/web/src/sample/templateData.ts",
      "apps/web/src/sample/templateData.test.ts",
      "tooling/generators/src/index.ts",
      "tooling/generators/src/index.test.ts",
      "tooling/release/src/index.ts",
      "tooling/release/src/index.test.ts",
    ],
    verification: [
      "pnpm --dir tooling/generators test src/index.test.ts",
      "pnpm --dir tooling/release test src/index.test.ts",
      'pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Reviewer Brain" --write',
      "pnpm template:doctor -- --mode fake",
      "pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write",
      "pnpm template:handoff -- --mode fake --write",
      "pnpm --dir tooling/release exec tsx src/index.ts client-release <template-version> <client-version>",
    ],
    detail:
      "Quickstart, fake doctor, deterministic seed, handoff packet, and client-release validation are documented and covered by generator/release tests.",
  },
  {
    id: "services-and-security",
    requirement:
      "Core services, provider adapters, CI/CD gates, security posture, and coding rules are documented and enforced.",
    evidence: [
      ".woodpecker/firewall.yml",
      ".woodpecker/epoch.yml",
      ".woodpecker/deploy.yml",
      "packages/integrations/src/index.ts",
      "packages/integrations/src/index.test.ts",
      "docs/template/security.md",
      "docs/template/coding-standards.md",
      "docs/rule-coverage.md",
    ],
    verification: [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm check:secret-canaries",
      "pnpm check:auth-demo-bypass",
      "pnpm check:ci-completeness",
    ],
    detail:
      "Provider harnesses, CI config, security docs, coding standards, and static gates are present.",
  },
  {
    id: "investor-handoff",
    requirement:
      "An investor or technical reviewer has a clear entry point, review path, evidence packet, and explicit production limits.",
    evidence: [
      "docs/template/investor-reviewer-packet.md",
      "docs/template/reviewer-guide.md",
      "docs/template/confect-effect-guide.md",
      "docs/template/hosting.md",
    ],
    verification: ["pnpm review:readiness", "pnpm review:completion"],
    detail:
      "Investor packet, reviewer guide, typed-contract guide, hosting guide, and completion audit are present.",
  },
] as const;

const readinessPresenceAuditWarning =
  "Presence audit only: this report checks required files and listed evidence paths. Run pnpm verify for behavior.";

const completionPresenceAuditWarning =
  "Presence audit only: this report checks evidence paths. It does not execute verification commands or inspect generated handoff content; run pnpm verify and client-release for behavior.";

export const reviewerCommands = [
  "pnpm check:format",
  "pnpm lint",
  "pnpm typecheck",
  "host-test-slot --class full pnpm test",
  "pnpm check:confect-contracts",
  "pnpm check:confect-compat",
  "pnpm check:workflow-graph-boundary",
  "pnpm check:secret-canaries",
  "pnpm build",
  "pnpm smoke:web-static",
  "pnpm smoke:golden:browser",
  "pnpm smoke:golden:a11y",
  "pnpm smoke:golden:visual",
] as const;

const currentCommit = (repoRoot: string): string => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
};

export const buildReviewerReadinessReport = (options?: {
  readonly repoRoot?: string;
  readonly commit?: string;
  readonly hostedUrl?: string;
}): ReviewerReadinessReport => {
  const repoRoot = options?.repoRoot ?? process.cwd();
  const hostedUrl =
    options?.hostedUrl ??
    process.env.TEMPLATE_HOSTED_URL ??
    "https://maestro-template.pages.dev";
  const artifactStatus = (artifactPath: string) => {
    const fullPath = resolve(repoRoot, artifactPath);

    return existsSync(fullPath)
      ? {
          path: artifactPath,
          status: "pass" as const,
          detail: "present",
        }
      : {
          path: artifactPath,
          status: "fail" as const,
          detail: `missing ${fullPath}`,
        };
  };
  const artifacts = readinessArtifacts.map(artifactStatus);
  const claims = readinessClaims.map((claim) => {
    const missing = claim.evidence.filter(
      (artifactPath) => !existsSync(resolve(repoRoot, artifactPath)),
    );

    return {
      id: claim.id,
      status: missing.length === 0 ? ("pass" as const) : ("fail" as const),
      evidence: claim.evidence,
      detail:
        missing.length === 0
          ? claim.detail
          : `${claim.detail} Missing evidence: ${missing.join(", ")}`,
    };
  });

  return {
    ok:
      artifacts.every((artifact) => artifact.status === "pass") &&
      claims.every((claim) => claim.status === "pass"),
    auditKind: "presence",
    warning: readinessPresenceAuditWarning,
    repoRoot,
    commit: options?.commit ?? currentCommit(repoRoot),
    hostedUrl,
    artifacts,
    claims,
    commands: reviewerCommands,
  };
};

export const buildCompletionAuditReport = (options?: {
  readonly repoRoot?: string;
  readonly commit?: string;
  readonly hostedUrl?: string;
}): CompletionAuditReport => {
  const repoRoot = options?.repoRoot ?? process.cwd();
  const hostedUrl =
    options?.hostedUrl ??
    process.env.TEMPLATE_HOSTED_URL ??
    "https://maestro-template.pages.dev";
  const requirements = completionRequirements.map((requirement) => {
    const missing = requirement.evidence.filter(
      (artifactPath) => !existsSync(resolve(repoRoot, artifactPath)),
    );

    return {
      id: requirement.id,
      requirement: requirement.requirement,
      status: missing.length === 0 ? ("pass" as const) : ("fail" as const),
      evidence: requirement.evidence,
      verification: requirement.verification,
      detail:
        missing.length === 0
          ? requirement.detail
          : `${requirement.detail} Missing evidence: ${missing.join(", ")}`,
    };
  });

  return {
    ok: requirements.every((requirement) => requirement.status === "pass"),
    auditKind: "presence",
    warning: completionPresenceAuditWarning,
    repoRoot,
    commit: options?.commit ?? currentCommit(repoRoot),
    hostedUrl,
    requirements,
  };
};

export const buildClientReleaseReport = (options: {
  readonly repoRoot?: string;
  readonly templateVersion: string;
  readonly clientVersion: string;
}): ClientReleaseReport => {
  const repoRoot = options.repoRoot ?? process.cwd();
  const handoffArtifacts = clientReleaseHandoffArtifacts.map((artifactPath) =>
    validateClientReleaseArtifact(repoRoot, artifactPath),
  );
  const ok = handoffArtifacts.every((artifact) => artifact.status === "pass");

  return {
    ok,
    repoRoot,
    templateVersion: options.templateVersion,
    clientVersion: options.clientVersion,
    compatibility: {
      status: ok ? "ready-for-review" : "missing-artifacts",
      requiredChecks: clientReleaseRequiredChecks,
      notes: [
        "Review generated Confect refs, workflow graphs, provider posture, and private-package promotion metadata before upgrading a client fork.",
        "Handoff artifacts must label fake, seam, planned, and real behavior before investor or client review.",
      ],
    },
    handoffArtifacts,
  };
};

export const smokeWebStaticBuild = (options?: {
  readonly repoRoot?: string;
}): WebStaticSmokeReport => {
  const repoRoot = options?.repoRoot ?? process.cwd();
  const distPath = resolve(repoRoot, "apps/web/dist");
  const indexPath = join(distPath, "index.html");
  const startShellPath = join(distPath, "client/_shell.html");
  const assetsPath = join(distPath, "assets");
  const startAssetsPath = join(distPath, "client/assets");
  const checks = [];
  const htmlPath = existsSync(indexPath) ? indexPath : startShellPath;

  if (!existsSync(htmlPath)) {
    checks.push(
      fail(
        "web:index",
        `Missing ${indexPath} or ${startShellPath}. Run pnpm build.`,
      ),
    );
  } else {
    const html = readFileSync(htmlPath, "utf8");
    const isStartShell = htmlPath === startShellPath;
    checks.push(
      isStartShell
        ? pass("web:start-shell", `Found ${startShellPath}`)
        : pass("web:index", `Found ${indexPath}`),
    );
    if (!isStartShell) {
      checks.push(
        html.includes('<div id="root"></div>')
          ? pass("web:root", "index.html contains the React root")
          : fail("web:root", "index.html is missing the React root"),
      );
    }
    checks.push(
      html.includes("/assets/")
        ? pass("web:assets-linked", "index.html links built assets")
        : fail("web:assets-linked", "index.html does not link built assets"),
    );
  }

  const resolvedAssetsPath = existsSync(assetsPath)
    ? assetsPath
    : startAssetsPath;
  const assets = existsSync(resolvedAssetsPath)
    ? readdirSync(resolvedAssetsPath)
    : [];
  checks.push(
    assets.length > 0
      ? pass("web:assets", `Found ${assets.length} built assets`)
      : fail(
          "web:assets",
          `Missing built assets under ${assetsPath} or ${startAssetsPath}`,
        ),
  );

  return {
    ok: checks.every((check) => check.status === "pass"),
    distPath,
    indexHtmlBytes: existsSync(htmlPath) ? statSync(htmlPath).size : 0,
    assetCount: assets.length,
    checks,
  };
};

export const runReleaseCli = (
  argv: readonly string[],
  cwd = process.cwd(),
): {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
} => {
  const [command] = argv;

  if (!command || command === "help" || command === "--help") {
    return {
      exitCode: 0,
      stdout:
        "release-tooling smoke-web-static | review-readiness | review-completion | client-release <template-version> <client-version> | deploy-doctor [staging|production] | deploy-plan staging <sha> | promote-plan <staged-sha> <current-sha>\n",
      stderr: "",
    };
  }

  if (command === "smoke-web-static") {
    const report = smokeWebStaticBuild({ repoRoot: cwd });

    return {
      exitCode: report.ok ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "review-readiness") {
    const report = buildReviewerReadinessReport({ repoRoot: cwd });

    return {
      exitCode: report.ok ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "review-completion") {
    const report = buildCompletionAuditReport({ repoRoot: cwd });

    return {
      exitCode: report.ok ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "client-release") {
    const templateVersion = argv[1];
    const clientVersion = argv[2];

    if (!templateVersion || !clientVersion) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: client-release <template-version> <client-version>\n",
      };
    }

    const report = buildClientReleaseReport({
      repoRoot: cwd,
      templateVersion,
      clientVersion,
    });

    return {
      exitCode: report.ok ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "deploy-doctor") {
    const environment = (argv[1] ?? "production") as
      DeployEnvironmentName | undefined;

    if (environment !== "staging" && environment !== "production") {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: deploy-doctor [staging|production]\n",
      };
    }

    const report = buildDeployDoctorReport({ repoRoot: cwd, environment });

    return {
      exitCode: report.ok ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "deploy-plan") {
    const environment = argv[1];
    const commitSha = argv[2];

    if (environment !== "staging" || !commitSha) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: deploy-plan staging <sha>\n",
      };
    }

    const report = buildStagingDeployPlan({ repoRoot: cwd, commitSha });

    return {
      exitCode: 0,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "promote-plan") {
    const stagedSha = argv[1];
    const currentSha = argv[2];

    if (!stagedSha || !currentSha) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: promote-plan <staged-sha> <current-sha>\n",
      };
    }

    const report = buildProductionPromotePlan({
      repoRoot: cwd,
      stagedSha,
      currentSha,
    });

    return {
      exitCode: report.ok ? 0 : 1,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unknown release command: ${command}\n`,
  };
};

if (
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
) {
  const result = runReleaseCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
