import {
  resolveCustomerReleasePath,
  type CustomerPathOwnership,
  type CustomerReleasePath,
} from "./manifest";

export class CustomerOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerOwnershipError";
  }
}

const FACTORY_ONLY_PREFIXES = [
  ".agents/",
  ".woodpecker/",
  "tooling/ci/",
  ".claude-plugin/",
  ".claude/",
  ".codex/",
  ".github/",
  ".qlty/",
  ".superpowers/",
  ".vscode/",
  "agent-pack/",
  "artifacts/saas-ui-golden/",
  "docs/design-intake/",
  "docs/migration/",
  "docs/superpowers/",
  "examples/gtm-context-app/",
  "examples/gtm-implementation/",
  "examples/saas-application/",
  "experiments/",
  "packages/app-idea-evaluator/",
  "packages/convex/confect/buildPacks/",
  "packages/convex/confect/commerce/",
  "packages/convex/confect/evaluator/",
  "packages/convex/confect/_generated/registeredFunctions/buildPacks/",
  "packages/convex/confect/_generated/registeredFunctions/commerce/",
  "packages/convex/convex/buildPacks/",
  "packages/convex/convex/commerce/",
  "apps/web/src/features/public-funnel/",
  "releases/",
  "repos/",
  "tooling/evals/",
  "tooling/release/",
] as const;

const FACTORY_PRODUCT_TABLES = [
  "buildPackEntitlements",
  "buildPackExports",
  "buildPackStages",
  "buildPacks",
  "checkoutSessions",
  "commerceRevocations",
  "emailVerificationChallenges",
  "evaluationAnswers",
  "evaluationReportVersions",
  "evaluationReports",
  "evaluationSessions",
  "evaluationShares",
  "maestroCredits",
  "modelReceipts",
  "purchases",
  "reportOwnerships",
  "supportIncidents",
] as const;

const FACTORY_ONLY_EXACT = new Set([
  "apps/cli/src/factory/customerCandidateFixture.ts",
  "CLAUDE.md",
  "cucumber.cjs",
  "skills-lock.json",
  "schemas/maestro-customer-release-manifest.schema.json",
  "docs/template/do-not-port-register.md",
  "docs/template/effect-confect-working-plan.md",
  "docs/template/effect-review-findings.md",
  "docs/template/effectification-status.md",
  "docs/template/extraction-redaction-guide.md",
  "docs/template/investor-reviewer-packet.md",
  "docs/template/porting-backlog.md",
  "docs/template/porting-roadmap.md",
  "docs/template/post-port-backlog.md",
  "tooling/app-map/INTEGRATION_REQUEST.md",
  "tooling/release-seal.mts",
  "tooling/release-seal.test.mts",
  "tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts",
  "tooling/agent-pack/src/privacy/runtimeNetworkInterceptor.mjs",
  "tooling/generators/src/blueprints/customer/alpha2-plan.json.gz.b64",
  "packages/convex/confect/capabilities/evaluateAppIdea.domain.ts",
  "packages/convex/confect/capabilities/evaluateAppIdea.headless.json",
  "packages/convex/confect/capabilities/evaluateAppIdea.impl.ts",
  "packages/convex/confect/capabilities/evaluateAppIdea.spec.ts",
  "packages/convex/confect/capabilities/evaluateAppIdea.test.ts",
  "packages/convex/confect/capabilities/manageEvaluationReport.domain.ts",
  "packages/convex/confect/capabilities/manageEvaluationReport.headless.json",
  "packages/convex/confect/capabilities/manageEvaluationReport.impl.ts",
  "packages/convex/confect/capabilities/manageEvaluationReport.spec.ts",
  "packages/convex/confect/capabilities/manageEvaluationReport.test.ts",
  "packages/convex/confect/_generated/registeredFunctions/demo/showcase.ts",
  "packages/convex/convex/demo/showcase.ts",
  "packages/convex/confect/workflowContracts/generateCompleteBuildPack.impl.ts",
  "packages/convex/confect/workflowContracts/generateCompleteBuildPack.spec.ts",
  "packages/convex/confect/workflows/generateCompleteBuildPack.graph.ts",
  "packages/convex/convex/capabilities/evaluateAppIdea.ts",
  "packages/convex/convex/capabilities/manageEvaluationReport.ts",
  "packages/convex/convex/workflowContracts/generateCompleteBuildPack.ts",
  "packages/convex/convex/workflowRunners/generateCompleteBuildPack.ts",
  "packages/convex/confect/_generated/registeredFunctions/capabilities/evaluateAppIdea.ts",
  "packages/convex/confect/_generated/registeredFunctions/capabilities/manageEvaluationReport.ts",
  "packages/convex/confect/_generated/registeredFunctions/workflowContracts/generateCompleteBuildPack.ts",
  "packages/convex/test/app-idea-commerce-capabilities.test.ts",
  "packages/convex/test/app-idea-funnel-capabilities.test.ts",
  "packages/convex/test/app-idea-funnel-tables.test.ts",
  "packages/convex/test/build-pack-pipeline.test.ts",
  "packages/convex/test/evaluator-state.test.ts",
  "packages/convex/test/generateCompleteBuildPack.workflow.test.ts",
  "packages/convex/test/report-revision-capability.test.ts",
  "apps/web/src/routes/build-pack.$packId.generating.tsx",
  "apps/web/src/routes/build-pack.$packId.index.tsx",
  "apps/web/src/routes/build-pack.$packId.tsx",
  "apps/web/src/routes/checkout.$reportId.tsx",
  "apps/web/src/routes/checkout.fake-hosted.$sessionId.tsx",
  "apps/web/src/routes/checkout.return.tsx",
  "apps/web/src/routes/evaluate.tsx",
  "apps/web/src/routes/library.tsx",
  "apps/web/src/routes/maestro.$packId.tsx",
  "apps/web/src/routes/privacy.tsx",
  "apps/web/src/routes/report.$evaluationId.tsx",
  "apps/web/src/routes/share.$token.tsx",
  "apps/web/src/routes/support.tsx",
  "apps/web/src/routes/terms.tsx",
  "apps/web/src/routes/verify-report.tsx",
  "apps/web/src/providers/posthog.test.tsx",
  "apps/web/src/public-routes.test.tsx",
]);

const FACTORY_ONLY_NESTED_PREFIXES = ["docs/template/extraction/"] as const;

const CUSTOMER_EXTENSION_EXACT = new Set([
  ".env.example",
  "README.md",
  "project.config.json",
  "docs/template/client-intake-questionnaire.md",
]);

const GENERATED_EXACT = new Set([
  ".claude/settings.json",
  "package.json",
  "tsconfig.json",
  "apps/web/src/routeTree.gen.ts",
  "product.contract.yaml",
  "product.contract.schema.json",
  "docs/template/generated/product-contract.md",
  "playwright.acceptance.config.ts",
  "tooling/acceptance/checkout-state.mts",
  "tooling/acceptance/product-contract.mts",
  "tooling/acceptance/run-acceptance.mts",
  "tooling/acceptance/playwright-report.mts",
  "docs/product/records-plan.md",
  "tests/acceptance/records.spec.ts",
  "tests/acceptance/support/fixtures.ts",
  "tests/acceptance/support/runtime.ts",
]);

const GENERATED_PREFIXES = ["generated/"] as const;

const TEMPLATE_PREFIXES = [
  "agent-patterns/",
  "apps/cli/",
  "apps/web/",
  "docs/agent/",
  "docs/licenses/saas-ui/",
  "docs/template/",
  "examples/generic-ai-ops/",
  "patches/",
  "packages/",
  "schemas/",
  "scripts/",
  "tests/",
  "tooling/agent-pack/",
  "tooling/acceptance/",
  "tooling/app-map/",
  "tooling/confect-manifest/",
  "tooling/convex-compat/",
  "tooling/effectified-api-proof/",
  "tooling/eslint-plugin-template/",
  "tooling/generators/",
  "tooling/quality/",
  "tooling/saas-ui/",
  "tooling/workflow/",
] as const;

const TEMPLATE_ROOT_FILES = new Set([
  ".factory/project.yaml",
  ".gitignore",
  ".gitleaks.toml",
  ".npmrc",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc.json",
  "AGENTS.md",
  "convex.json",
  "coverage-baseline.json",
  "dependency-cruiser.config.cjs",
  "docs/rule-coverage.md",
  "eslint.config.mjs",
  "knip.json",
  "lefthook.yml",
  "maestro-template.mjs",
  "playwright.config.ts",
  "playwright.funnel.config.ts",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "stryker.conf.mjs",
  "tsconfig.base.json",
  "tsconfig.type-coverage.json",
  "turbo.json",
  "vitest.config.ts",
  "vitest.stryker.config.ts",
]);

const validSourcePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !path.split("/").includes("..");

const rule = (
  path: string,
  match: "exact" | "subtree",
  ownership: CustomerPathOwnership,
): CustomerReleasePath => {
  if (ownership === "template-owned") {
    return { path, match, ownership, action: "copy", upgrade: "replace" };
  }
  if (ownership === "customer-extension") {
    return { path, match, ownership, action: "copy", upgrade: "preserve" };
  }
  if (ownership === "generated") {
    return {
      path,
      match,
      ownership,
      action: "generate",
      upgrade: "regenerate",
    };
  }
  if (ownership === "local-only") {
    return { path, match, ownership, action: "omit", upgrade: "preserve" };
  }
  return { path, match, ownership, action: "omit", upgrade: "remove" };
};

const subtree = (path: string): string =>
  path.endsWith("/") ? path.slice(0, -1) : path;

export const CUSTOMER_OWNERSHIP_RULES: readonly CustomerReleasePath[] = [
  ...FACTORY_ONLY_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "factory-only"),
  ),
  ...FACTORY_ONLY_NESTED_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "factory-only"),
  ),
  ...[...FACTORY_ONLY_EXACT].map((path) => rule(path, "exact", "factory-only")),
  ...FACTORY_PRODUCT_TABLES.flatMap((table) => [
    rule(`packages/convex/confect/tables/${table}.ts`, "exact", "factory-only"),
    rule(
      `packages/convex/confect/_generated/tables/${table}.ts`,
      "exact",
      "factory-only",
    ),
  ]),
  ...[...CUSTOMER_EXTENSION_EXACT].map((path) =>
    rule(path, "exact", "customer-extension"),
  ),
  ...[...GENERATED_EXACT].map((path) => rule(path, "exact", "generated")),
  ...GENERATED_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "generated"),
  ),
  rule(".env.local", "exact", "local-only"),
  ...TEMPLATE_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "template-owned"),
  ),
  ...[...TEMPLATE_ROOT_FILES].map((path) =>
    rule(path, "exact", "template-owned"),
  ),
];

export function classifyCustomerSourcePath(
  path: string,
): CustomerReleasePath | undefined {
  if (!validSourcePath(path)) return undefined;
  const ownershipRule = resolveCustomerReleasePath(
    CUSTOMER_OWNERSHIP_RULES,
    path,
  );
  return ownershipRule ? { ...ownershipRule, path, match: "exact" } : undefined;
}

export function buildCustomerOwnershipInventory(
  sourcePaths: readonly string[],
): readonly CustomerReleasePath[] {
  const seen = new Set<string>();
  return [...sourcePaths].sort().map((path) => {
    if (seen.has(path))
      throw new CustomerOwnershipError(`Duplicate source path: ${path}`);
    seen.add(path);
    const entry = classifyCustomerSourcePath(path);
    if (!entry) {
      throw new CustomerOwnershipError(
        `Unclassified customer release source path: ${path}`,
      );
    }
    return entry;
  });
}
