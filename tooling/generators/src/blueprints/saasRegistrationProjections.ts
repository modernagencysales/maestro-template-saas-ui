import { existsSync, readFileSync } from "node:fs";
import type { GeneratedFile } from "../index";

const asset = (path: string): string =>
  readFileSync(
    new URL(
      `../../../../releases/v0.2.0-alpha.1/blueprints/saas-application/base/${path}`,
      import.meta.url,
    ),
    "utf8",
  );

const releasedSource = (path: string): string =>
  readFileSync(
    new URL(
      `../../../../releases/v0.2.0-alpha.1/blueprints/saas-application/base/${path}.txt`,
      import.meta.url,
    ),
    "utf8",
  );

const currentPublicDocument = (path: string): string =>
  readFileSync(
    new URL(`../../../../docs/template/${path}`, import.meta.url),
    "utf8",
  );

const currentSource = (path: string): string => {
  const url = new URL(`../../../../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : releasedSource(path);
};

const source = (path: string): string => currentSource(path);
const currentGeneratorSource = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

export const CURRENT_FACTORY_PRODUCT_TABLES = [
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

const customerReadme = (): string => `# Generated Maestro App

This is a customer application generated from an immutable Maestro release. Its
release, blueprint, and personalization facts live in \`template-instance.json\`.
Build the product in this repository. Do not run \`maestro create\` here and do
not copy files from a newer factory checkout.

## Start here

Requirements: Git and Node 22. The bootstrap check chooses a pinned Corepack or
npx pnpm command for the available host.

\`\`\`bash
node scripts/maestro-bootstrap.mjs
corepack pnpm@10.12.1 install --frozen-lockfile
node maestro-template.mjs preflight --mode fake
node maestro-template.mjs recipes list
node maestro-template.mjs recipes show crud-business-entity
pnpm template:systems -- --query records
node maestro-template.mjs start --mode fake
\`\`\`

If Corepack is unavailable, use the bootstrap report's exact
\`npx --yes pnpm@10.12.1 install --frozen-lockfile\` fallback.

The starter includes a neutral, workspace-owned \`record\` slice. Open the URL
printed after \`/health\` becomes ready, then exercise \`/records\`: create a
record, return to the list, and open its detail. Rename the noun when you build
the first real product outcome.

## The method

\`\`\`text
preflight -> recipes/system lookup -> preview -> reviewed write
          -> focused verification -> commit reviewed change
          -> start --mode fake
\`\`\`

Preview is the default. Before adding a subsystem or table, query the canonical
owner. A recipe write must use the exact confirmation command returned by the
preview; it rechecks the plan and clean-preflight fingerprints and retains a
receipt under \`.maestro/recipe-transactions/\`.

After the focused gates pass, review and commit the recipe transaction before
starting. Preflight intentionally requires a clean target so generated drift
cannot be mistaken for the app you reviewed.

\`\`\`bash
git status --short
git add .
git commit -m "feat: add reviewed Maestro change"
pnpm maestro -- start --mode fake
\`\`\`

For the copy/paste CRUD walkthrough, use
[Template Quickstart](./docs/template/quickstart.md). The broader method is in
[App Factory Guide](./docs/template/app-factory-guide.md), and recipe safety is
documented in
[Executable Outcome Recipes](./docs/template/executable-recipes.md).

## Guidance for agents

Start with [AGENTS.md](./AGENTS.md). Keep the shared Saas UI shell and customize
through blocks, tokens, feature adapters, generated routes, view models, and
typed contracts. Do not hand-edit generated Confect, Convex, or route-tree
files, invent parallel ownership, or weaken a failing gate.

The browser and headless surfaces share one implementation path:

\`\`\`text
API/CLI/MCP -> headless registry -> same capabilities/workflows as web
\`\`\`

Add behavior to the typed capability or workflow once, then project it through
the supported web, API, CLI, or MCP adapter. Do not create a second business
implementation for a headless surface.

## Before sharing

Run the focused commands printed by each successful write. At minimum:

\`\`\`bash
pnpm check:format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:system-catalog
pnpm check:system-topology
pnpm check:data-resources
\`\`\`

Use \`pnpm verify\` for the exhaustive handoff gate. Fake mode requires no live
provider credentials and must not contain production or customer data.
`;

export const REMOVED_CUSTOMER_TEMPLATE_SCRIPTS = [
  "template:init",
  "template:quickstart",
  "template:intake",
  "template:seed-demo",
  "template:handoff",
  "template:prototype",
  "template:add-client-domain",
  "template:workflow-output-smoke",
  "template:regenerate-workflow-publications",
  "template:upgrade",
] as const;
export const CURRENT_GENERATOR_GATE_SCRIPTS = [
  "template:quickstart",
  "template:seed-demo",
  "template:handoff",
  "template:add-client-domain",
  "template:prototype",
] as const;

export const CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE = [
  "packages/convex/confect/_generated/tables/deployAuthorityAuditEvents.ts",
  "packages/convex/confect/_generated/tables/deployAuthorityIssuers.ts",
  "packages/convex/confect/tables/deployActionConsumptions.ts",
  "packages/convex/confect/tables/deployApprovals.ts",
  "packages/convex/confect/tables/deployAuthorityAuditEvents.ts",
  "packages/convex/confect/tables/deployAuthorityIssuers.ts",
  "packages/convex/confect/tables/deployCensusSnapshots.ts",
  "packages/convex/confect/tables/deployVerdicts.ts",
] as const;
export const CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE = [
  "packages/convex/confect/deploy/authority.impl.ts",
  "packages/convex/confect/deploy/authority.spec.ts",
  "packages/convex/confect/deploy/authority.ts",
  "packages/convex/confect/deployAuthority/admin.ts",
  "packages/convex/confect/deployAuthority/env.ts",
  "packages/convex/confect/deployAuthority/http.ts",
  "packages/convex/confect/deployAuthority/store.ts",
  "packages/convex/confect/http.ts",
  "packages/convex/confect/shared/env.ts",
  "packages/convex/convex/convex.config.ts",
  "packages/convex/convex/deploy/authority.ts",
  "packages/convex/test/deploy-authority.test.ts",
] as const;

export const CURRENT_EMAIL_CLOSURE = [
  ".env.example",
  "apps/web/src/features/setup/setup-surface.ts",
  "apps/web/src/sample/templateData.test.ts",
  "docs/template/client-handoff-packet.md",
  "docs/template/client-intake-wizard.md",
  "docs/template/how-to-add-notification.md",
  "docs/template/implementation-brief-template.md",
  "docs/template/integrations.md",
  "docs/template/template-defaults.md",
  "packages/convex/confect/_generated/registeredFunctions/ops/email.ts",
  "packages/convex/confect/_generated/tables/emailCampaigns.ts",
  "packages/convex/confect/_generated/tables/emailDeliveries.ts",
  "packages/convex/confect/_generated/tables/emailEvents.ts",
  "packages/convex/confect/_generated/tables/emailSubscribers.ts",
  "packages/convex/confect/_generated/tables/emailSuppressions.ts",
  "packages/convex/confect/email/env.ts",
  "packages/convex/confect/email/postmarkWebhook.ts",
  "packages/convex/confect/email/unsubscribeToken.ts",
  "packages/convex/confect/access/invitations.impl.ts",
  "packages/convex/confect/ops/actions.impl.ts",
  "packages/convex/confect/ops/billing.impl.ts",
  "packages/convex/confect/ops/billing.spec.ts",
  "packages/convex/confect/ops/email.impl.ts",
  "packages/convex/confect/ops/email.spec.ts",
  "packages/convex/confect/tables/emailCampaigns.ts",
  "packages/convex/confect/tables/emailDeliveries.ts",
  "packages/convex/confect/tables/emailEvents.ts",
  "packages/convex/confect/tables/emailSubscribers.ts",
  "packages/convex/confect/tables/emailSuppressions.ts",
  "packages/convex/confect/tables/usageEvents.ts",
  "packages/convex/convex/ops/email.ts",
  "packages/convex/test/billing.test.ts",
  "packages/convex/test/email.test.ts",
  "packages/convex/test/headless-executor.test.ts",
  "packages/convex/test/http-docs.test.ts",
  "packages/integrations/src/billing.ts",
  "packages/integrations/src/email.test.ts",
  "packages/integrations/src/email.ts",
  "packages/integrations/src/emailSetup.test.ts",
  "packages/integrations/src/emailSetup.ts",
  "packages/integrations/src/index.test.ts",
  "packages/integrations/src/index.ts",
  "packages/notifications/src/index.test.ts",
  "packages/notifications/src/index.ts",
  "packages/template-core/src/actions.test.ts",
  "packages/template-core/src/index.ts",
  "packages/ui/src/visualize/visualize.test.tsx",
  "project.config.json",
  "tooling/confect-manifest/src/generate.ts",
  "tooling/quality/check-env-boundary.mts",
  "tooling/quality/check-env-boundary.test.mts",
  "tooling/workflow/src/index.test.ts",
  "tooling/workflow/src/index.ts",
] as const;

export const CURRENT_EMAIL_BASE_COPY_REPLACEMENTS = [
  ".env.example",
  "apps/web/src/features/setup/setup-surface.ts",
  "apps/web/src/sample/templateData.test.ts",
  "docs/template/client-handoff-packet.md",
  "docs/template/client-intake-wizard.md",
  "docs/template/how-to-add-notification.md",
  "docs/template/implementation-brief-template.md",
  "docs/template/integrations.md",
  "docs/template/template-defaults.md",
  "packages/convex/confect/access/invitations.impl.ts",
  "packages/convex/confect/ops/actions.impl.ts",
  "packages/convex/confect/ops/billing.impl.ts",
  "packages/convex/confect/ops/billing.spec.ts",
  "packages/convex/confect/tables/usageEvents.ts",
  "packages/convex/test/billing.test.ts",
  "packages/convex/test/headless-executor.test.ts",
  "packages/convex/test/http-docs.test.ts",
  "packages/integrations/src/billing.ts",
  "packages/integrations/src/index.test.ts",
  "packages/integrations/src/index.ts",
  "packages/notifications/src/index.test.ts",
  "packages/notifications/src/index.ts",
  "packages/template-core/src/actions.test.ts",
  "packages/template-core/src/index.ts",
  "packages/ui/src/visualize/visualize.test.tsx",
  "project.config.json",
  "tooling/confect-manifest/src/generate.ts",
  "tooling/quality/check-env-boundary.mts",
  "tooling/quality/check-env-boundary.test.mts",
  "tooling/workflow/src/index.test.ts",
  "tooling/workflow/src/index.ts",
] as const;

export const CURRENT_CUSTOMER_QUALITY_TEST_EXCLUSIONS = [
  "tooling/quality/ai-gate-scripts.test.mts",
  "tooling/quality/check-agent-pack.test.mts",
  "tooling/quality/check-convex-ai-files.test.mts",
  "tooling/quality/check-deploy-authority.test.mts",
  "tooling/quality/check-docs-freshness.test.mts",
  "tooling/quality/check-recipes.test.mts",
  "tooling/quality/mutation-script.test.mts",
] as const;

const exclusionArguments = (
  paths: readonly string[],
  packagePrefix = "",
): string =>
  paths.map((path) => ` --exclude ${path.replace(packagePrefix, "")}`).join("");

const currentCustomerRootTestExclusions = (): string =>
  exclusionArguments(CURRENT_CUSTOMER_QUALITY_TEST_EXCLUSIONS);

export const CURRENT_PRODUCT_JOURNEY_CLOSURE = [
  "packages/product-journey/package.json",
  "packages/product-journey/tsconfig.json",
  "packages/product-journey/src/attestation.ts",
  "packages/product-journey/src/contract-diff.ts",
  "packages/product-journey/src/evidence.ts",
  "packages/product-journey/src/graph.ts",
  "packages/product-journey/src/index.ts",
  "packages/product-journey/src/lease.ts",
  "packages/product-journey/src/manifest.ts",
  "packages/product-journey/src/ordering.ts",
  "packages/product-journey/src/receipts.ts",
  "packages/product-journey/src/redaction.ts",
  "packages/product-journey/src/runner.ts",
  "packages/product-journey/src/selection.ts",
  "tooling/quality/check-product-journeys.mts",
  "tooling/quality/src/check-definitions.mts",
] as const;

export const CUSTOMER_ROOT_SCRIPTS = [
  "maestro",
  "format",
  "check:format",
  "lint",
  "typecheck",
  "check:effect-diagnostics",
  "test",
  "test:bootstrap",
  "test:tooling",
  "test:app-map",
  "test:workflow",
  "test:convex-compat",
  "build",
  "confect:codegen",
  "confect:manifest",
  "confect:dev",
  "convex:dev",
  "dev:backend",
  "email:setup",
  "template:doctor",
  "template:quickstart",
  "template:seed-demo",
  "template:handoff",
  "template:systems",
  "template:prototype",
  "template:add-client-domain",
  "template:add-feature",
  "template:add-capability",
  "template:add-table",
  "template:add-workflow",
  "template:bump-workflow",
  "template:bump-capability",
  "template:publish-workflow",
  "template:publish-capability",
  "template:add-agent",
  "template:add-agent-seat",
  "template:promote-capability",
  "template:promote-workflow",
  "template:private-package:dry-run",
  "template:private-package:import",
  "pattern-fit",
  "check:convex",
  "check:confect-compat",
  "check:convex-compat",
  "check:ci-completeness",
  "check:config-drift",
  "check:product-journeys",
  "check:deps",
  "check:knip",
  "check:route-tree",
  "check:frontend-effect-boundary",
  "check:env-boundary",
  "check:provider-boundary",
  "check:logging-boundary",
  "check:access-audit-events",
  "check:coverage-ratchet",
  "check:types-coverage",
  "check:gates",
  "check:debt",
  "check:generators",
  "check:docs-freshness",
  "check:generated-files",
  "check:confect-effect-compat",
  "check:confect-contracts",
  "check:workflow-graph-boundary",
  "check:workflow-policy-snapshots",
  "check:workflow-principal-propagation",
  "check:workflow-semantics",
  "check:workflow:fast",
  "check:schema-migration-notes",
  "data-resources:generate",
  "check:data-resources",
  "check:append-only-tables",
  "check:system-catalog",
  "check:system-topology",
  "check:promotion-boundary",
  "check:layer-boundaries",
  "check:secret-canaries",
  "check:sbom-license",
  "check:headless-surface-contract",
  "check:posthog-readiness",
  "check:confect-manifest",
  "check:effectified-api-proof",
  "check:auth-demo-bypass",
  "check:pr-health",
  "check:unresolved-review-threads",
  "check:merge-conflicts",
  "check:qlty",
  "contract-review",
  "review:contract",
  "taste",
  "taste:eval",
  "verify",
  "coverage:update-baseline",
  "prepare",
  "convex:codegen",
  "convex:ai-files:install",
  "convex:ai-files:status",
  "check:convex-ai-files",
  "check:agent-pack",
  "check:app-map",
] as const;

const customerPackage = (current: boolean): string => {
  const value = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
  };
  const sourceScripts = value.scripts;
  value.scripts = Object.fromEntries(
    CUSTOMER_ROOT_SCRIPTS.map((name) => {
      const command = sourceScripts[name];
      if (command === undefined) {
        throw new Error(`missing customer root script: ${name}`);
      }
      return [name, command];
    }),
  );
  value.scripts.test =
    "turbo run test --filter='./packages/*' --filter=@maestro-template/web";
  value.scripts["test:tooling"] =
    "pnpm test:bootstrap && pnpm --dir tooling/workflow test && pnpm --dir tooling/generators exec vitest run src/customer-runtime.test.ts src/templateInstanceMigration.test.ts src/workflow-publication-generation.test.ts src/workflow-release-commands.test.ts --maxWorkers=1 --no-file-parallelism";
  value.scripts["check:coverage-ratchet"] =
    `vitest run --coverage --maxWorkers=1 --no-file-parallelism packages/template-core packages/integrations packages/search packages/storage packages/notifications packages/observability packages/convex tooling/quality tooling/workflow tooling/generators apps/cli apps/web${current ? currentCustomerRootTestExclusions() : ""} && tsx tooling/quality/check-coverage-ratchet.mts`;
  value.scripts["coverage:update-baseline"] =
    `vitest run --coverage packages/template-core packages/integrations packages/search packages/storage packages/notifications packages/observability packages/convex tooling/quality tooling/workflow tooling/generators apps/cli apps/web${current ? currentCustomerRootTestExclusions() : ""} && tsx tooling/quality/check-coverage-ratchet.mts --update`;
  value.scripts["check:agent-pack"] =
    "tsx tooling/quality/check-agent-pack.mts";
  value.scripts["check:layer-boundaries"] =
    "depcruise --config dependency-cruiser.config.cjs apps packages tooling tests";
  value.scripts.prepare = "node tooling/quality/install-lefthook-if-git.mjs";
  value.scripts.verify = [
    "check:format",
    "lint",
    "typecheck",
    "check:effect-diagnostics",
    "test",
    "test:tooling",
    "build",
    "check:convex-ai-files",
    "check:agent-pack",
    "check:route-tree",
    "check:frontend-effect-boundary",
    "check:env-boundary",
    "check:provider-boundary",
    "check:logging-boundary",
    "check:access-audit-events",
    "check:generators",
    "check:confect-effect-compat",
    "check:confect-contracts",
    "check:effectified-api-proof",
    "check:workflow-semantics",
    "check:workflow-graph-boundary",
    "check:workflow-policy-snapshots",
    "check:workflow-principal-propagation",
    "check:schema-migration-notes",
    "check:system-catalog",
    "check:system-topology",
    "check:data-resources",
    "check:append-only-tables",
    "check:promotion-boundary",
    "check:layer-boundaries",
    "check:confect-manifest",
    "check:headless-surface-contract",
    "check:posthog-readiness",
    "check:auth-demo-bypass",
  ]
    .map((name) => `pnpm ${name}`)
    .join(" && ");
  for (const name of REMOVED_CUSTOMER_TEMPLATE_SCRIPTS) {
    if (
      !current ||
      !CURRENT_GENERATOR_GATE_SCRIPTS.includes(
        name as (typeof CURRENT_GENERATOR_GATE_SCRIPTS)[number],
      )
    ) {
      delete value.scripts[name];
    }
  }
  delete value.scripts["check:recipes"];
  delete value.scripts["check:workflow-version-immutability"];
  delete value.scripts["check:workflow-publication-generation"];
  for (const name of Object.keys(value.scripts)) {
    if (name.startsWith("template:")) {
      const script = value.scripts[name];
      if (script === undefined) continue;
      value.scripts[name] = script
        .replace(
          "tooling/generators/src/index.ts",
          "tooling/generators/src/customer-cli.ts",
        )
        .replace(
          "tooling/generators/src/cli.ts",
          "tooling/generators/src/customer-cli.ts",
        );
    }
  }
  value.scripts["maestro:crud-proof"] =
    "tsx tooling/generators/src/crud-proof.ts --mode fake";
  value.scripts["template:smoke"] =
    "tsx tooling/generators/src/customer-cli.ts smoke";
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerGeneratorPackage = (): string => {
  const value = JSON.parse(source("tooling/generators/package.json")) as Record<
    string,
    unknown
  >;
  const dependencies = value.dependencies as Record<string, string>;
  delete dependencies["@maestro-template/app-idea-evaluator"];
  delete dependencies["@maestro-template/release-tooling"];
  value.main = "src/customer.ts";
  value.types = "src/customer.ts";
  value.exports = { ".": "./src/customer.ts" };
  const scripts = value.scripts as Record<string, string>;
  scripts.cli = "tsx src/customer-cli.ts";
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerPackageWithoutAppIdeaEvaluator = (path: string): string => {
  const value = JSON.parse(currentSource(path)) as {
    dependencies: Record<string, string>;
  };
  delete value.dependencies["@maestro-template/app-idea-evaluator"];
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerQualityPackage = (): string => {
  const value = JSON.parse(currentSource("tooling/quality/package.json")) as {
    scripts: Record<string, string>;
  };
  value.scripts["test:customer"] = `${value.scripts.test}${exclusionArguments(
    CURRENT_CUSTOMER_QUALITY_TEST_EXCLUSIONS,
    "tooling/quality/",
  )}`;
  value.scripts.test = value.scripts["test:customer"];
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerCliPackage = (): string => {
  const value = JSON.parse(source("apps/cli/package.json")) as {
    dependencies: Record<string, string>;
  };
  delete value.dependencies["@maestro-template/release-tooling"];
  delete value.dependencies["@maestro-template/stack-tooling"];
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerAgentPackPackage = (): string => {
  const value = JSON.parse(
    currentSource("tooling/agent-pack/package.json"),
  ) as { scripts: Record<string, string> };
  const customerTest = value.scripts["test:customer"];
  if (customerTest === undefined)
    throw new Error("missing Agent Pack customer test closure");
  value.scripts.test = customerTest;
  return `${JSON.stringify(value, null, 2)}\n`;
};

const removeLockfileImporterDependency = (
  value: string,
  importerPath: string,
  nextImporterPath: string,
  dependency: string,
): string => {
  const startMarker = `  ${importerPath}:`;
  const endMarker = `  ${nextImporterPath}:`;
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker);
  if (start < 0 || end <= start)
    throw new Error(
      `Customer lockfile importer boundary is missing: ${importerPath} -> ${nextImporterPath}`,
    );
  const importer = value.slice(start, end);
  const projected = replace(importer, dependency, "");
  return `${value.slice(0, start)}${projected}${value.slice(end)}`;
};

const customerLockfile = (): string => {
  let value = source("pnpm-lock.yaml");
  const appIdeaEvaluatorFromRoot =
    '      "@maestro-template/app-idea-evaluator":\n        specifier: workspace:*\n        version: link:../../packages/app-idea-evaluator\n';
  const appIdeaEvaluatorFromPackage =
    '      "@maestro-template/app-idea-evaluator":\n        specifier: workspace:*\n        version: link:../app-idea-evaluator\n';
  value = removeLockfileImporterDependency(
    value,
    "apps/web",
    "packages/app-idea-evaluator",
    appIdeaEvaluatorFromRoot,
  );
  value = removeLockfileImporterDependency(
    value,
    "packages/convex",
    "packages/editor-core",
    appIdeaEvaluatorFromPackage,
  );
  value = removeLockfileImporterDependency(
    value,
    "tooling/generators",
    "tooling/pr-backlog",
    appIdeaEvaluatorFromRoot,
  );
  value = removeLockfileImporterDependency(
    value,
    "apps/cli",
    "apps/voice-relay",
    '      "@maestro-template/release-tooling":\n        specifier: workspace:*\n        version: link:../../tooling/release\n',
  );
  value = removeLockfileImporterDependency(
    value,
    "apps/cli",
    "apps/voice-relay",
    '      "@maestro-template/stack-tooling":\n        specifier: workspace:*\n        version: link:../../tooling/stack\n',
  );
  value = removeLockfileImporterDependency(
    value,
    "tooling/generators",
    "tooling/pr-backlog",
    '      "@maestro-template/release-tooling":\n        specifier: workspace:*\n        version: link:../release\n',
  );
  if (
    value.includes("'@maestro-template/app-idea-evaluator':") ||
    value.includes('"@maestro-template/app-idea-evaluator":')
  )
    throw new Error(
      "Customer lockfile still references omitted @maestro-template/app-idea-evaluator workspace package.",
    );
  return value;
};

const customerAgentPackCheck = (): string => {
  let value = currentSource("tooling/quality/check-agent-pack.mts");
  value = replace(
    value,
    'import {\n  checkRootSkillProjections,\n  checkSkillProjections,\n} from "../agent-pack/src/syncSkills.js";\n',
    'import { customerContextFindings } from "./check-customer-context.mts";\n',
  );
  value = replace(
    value,
    'import { factoryWiringFindings } from "./check-agent-pack-factory-wiring.mts";\n',
    "",
  );
  value = replace(
    value,
    "  const [generated, root, wiring, verification] = await Promise.all([\n    checkSkillProjections(repoRoot),\n    checkRootSkillProjections(repoRoot),\n    factoryWiringFindings(repoRoot),\n    verificationArtifactFindings(repoRoot),\n  ]);\n  return [\n    ...generated,\n    ...root,\n    ...wiring,\n    ...verification,\n    ...(await forbiddenMcpFindings(repoRoot)),\n  ];",
    "  const [customerContext, verification] = await Promise.all([\n    customerContextFindings(repoRoot),\n    verificationArtifactFindings(repoRoot),\n  ]);\n  return [\n    ...customerContext,\n    ...verification,\n    ...(await forbiddenMcpFindings(repoRoot)),\n  ];",
  );
  return replace(
    value,
    '  console.log("Agent Pack root projections and MCP posture are valid.");',
    '  console.log("Customer context, receipts, and MCP posture are valid.");',
  );
};
const customerCliEntry = (): string => {
  let value = currentSource("apps/cli/src/index.ts");
  value = replace(
    value,
    'import { createFactoryCliComposition } from "./factory/composition";',
    'import { createCustomerCliComposition } from "./factory/customerComposition";',
  );
  value = replace(
    value,
    "const factoryCliComposition = createFactoryCliComposition(() => process.env);",
    "const customerCliComposition = createCustomerCliComposition(() => process.env);",
  );
  value = replace(
    value,
    '  if (normalized[0] === "mcp" && normalized[1] === "configure") {\n    return factoryCliComposition.mcpConfigure.run(normalized.slice(1), cwd);\n  }\n',
    "",
  );
  value = replace(
    value,
    "      factoryCliComposition.handlers,",
    "      customerCliComposition.handlers,",
  );
  return replace(
    value,
    "    await factoryCliComposition.mcp.serve(streams);",
    "    await customerCliComposition.mcp.serve(streams);",
  );
};

const customerContextSource = (path: string): string => {
  const content = releasedSource(`customer-context/${path}`);
  if (path === ".claude/settings.json") return content;
  return content.endsWith("\n\n") ? content.slice(0, -1) : content;
};

const customerContextProjections = (): readonly GeneratedFile[] => {
  const content = asset("customer-context.manifest.json");
  const manifest = JSON.parse(content) as {
    readonly files: readonly { readonly path: string }[];
  };
  return [
    {
      path: "docs/template/customer-context.manifest.json",
      content,
    },
    ...manifest.files
      .filter(({ path }) => path !== "AGENTS.md")
      .map(({ path }) => ({
        path,
        content: customerContextSource(path),
      })),
  ];
};

const replace = (
  value: string,
  search: string,
  replacement: string,
): string => {
  if (!value.includes(search))
    throw new Error(
      `SaaS registration projection marker is missing: ${search}`,
    );
  return value.replace(search, replacement);
};

const replaceAll = (
  value: string,
  search: string,
  replacement: string,
): string => {
  if (!value.includes(search))
    throw new Error(
      `SaaS registration projection marker is missing: ${search}`,
    );
  return value.replaceAll(search, replacement);
};

const factoryProductTablePattern = new RegExp(
  `\\b(?:${CURRENT_FACTORY_PRODUCT_TABLES.join("|")})\\b`,
  "u",
);

const withoutFactoryProductTableLines = (value: string): string =>
  value
    .split("\n")
    .filter((line) => !factoryProductTablePattern.test(line))
    .join("\n");

const withoutFactoryProductTableNames = (value: string): string => {
  let projected = value;
  for (const table of CURRENT_FACTORY_PRODUCT_TABLES)
    projected = projected.replace(` | "${table}"`, "");
  return projected;
};

const removeChainedCall = (value: string, marker: string): string => {
  const start = value.indexOf(marker);
  if (start < 0)
    throw new Error(
      `SaaS registration projection marker is missing: ${marker}`,
    );
  const open = value.indexOf("(", start);
  let depth = 0;
  for (let index = open; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    if (character !== ")") continue;
    depth -= 1;
    if (depth === 0) return `${value.slice(0, start)}${value.slice(index + 1)}`;
  }
  throw new Error(`Unbalanced SaaS registration projection marker: ${marker}`);
};

const withoutFactoryProductConfectGroups = (value: string): string => {
  const forbiddenImports = [
    "buildPacks_",
    "capabilities_evaluateAppIdea",
    "capabilities_manageEvaluationReport",
    "commerce_",
    "workflowContracts_generateCompleteBuildPack",
  ] as const;
  let projected = value
    .split("\n")
    .filter(
      (line) =>
        !(
          line.startsWith("import ") &&
          forbiddenImports.some((name) => line.includes(name))
        ) &&
        !(
          line.startsWith("  | GroupSpec.NamedAt<GroupSpec.GroupSpec") &&
          (line.includes('"buildPacks"') || line.includes('"commerce"'))
        ),
    )
    .map((line) =>
      line
        .replace(
          ' | GroupSpec.NamedAt<typeof capabilities_evaluateAppIdea, "evaluateAppIdea">',
          "",
        )
        .replace(
          ' | GroupSpec.NamedAt<typeof capabilities_manageEvaluationReport, "manageEvaluationReport">',
          "",
        )
        .replace(
          'GroupSpec.NamedAt<typeof workflowContracts_generateCompleteBuildPack, "generateCompleteBuildPack"> | ',
          "",
        ),
    )
    .join("\n");
  projected = removeChainedCall(projected, '.addAt("buildPacks",');
  projected = removeChainedCall(projected, '.addAt("commerce",');
  for (const call of [
    '.addGroupAt("evaluateAppIdea", capabilities_evaluateAppIdea)',
    '.addGroupAt("manageEvaluationReport", capabilities_manageEvaluationReport)',
    '.addGroupAt("generateCompleteBuildPack", workflowContracts_generateCompleteBuildPack)',
  ])
    projected = replace(projected, call, "");
  return projected;
};

const databaseSchema = (): string => {
  let value = withoutFactoryProductTableLines(
    source("packages/convex/confect/_generated/schema.ts"),
  );
  value = replace(
    value,
    'import promptRegistry from "./tables/promptRegistry";',
    'import promptRegistry from "./tables/promptRegistry";\nimport records from "./tables/records";',
  );
  value = replace(
    value,
    "  typeof promptRegistry |",
    "  typeof promptRegistry |\n  typeof records |",
  );
  return replace(value, "  promptRegistry,", "  promptRegistry,\n  records,");
};

const convexSchema = (): string => {
  let value = withoutFactoryProductTableLines(
    source("packages/convex/confect/_generated/convexSchema.ts"),
  );
  value = replace(
    value,
    'import promptRegistry from "./tables/promptRegistry";',
    'import promptRegistry from "./tables/promptRegistry";\nimport records from "./tables/records";',
  );
  return replace(
    value,
    "  promptRegistry: promptRegistry.tableDefinition,",
    "  promptRegistry: promptRegistry.tableDefinition,\n  records: records.tableDefinition,",
  );
};

const confectSpec = (current: boolean): string => {
  let value = current
    ? withoutFactoryProductConfectGroups(
        source("packages/convex/confect/_generated/spec.ts"),
      )
    : source("packages/convex/confect/_generated/spec.ts");
  if (!current) {
    value = replace(
      value,
      'import ops_versioning from "../ops/versioning.spec";',
      'import ops_versioning from "../ops/versioning.spec";\nimport records from "../records/records.spec";',
    );
    value = replace(
      value,
      '  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflows"',
      '  | GroupSpec.NamedAt<typeof records, "records">\n  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflows"',
    );
    return replace(
      value,
      ').addAt("workflows", GroupSpec.makeAt("workflows")',
      ').addAt("records", records).addAt("workflows", GroupSpec.makeAt("workflows")',
    );
  }
  value = replace(
    value,
    'import ops_versioning from "../ops/versioning.spec";',
    'import ops_versioning from "../ops/versioning.spec";\nimport records_records from "../records/records.spec";',
  );
  value = replace(
    value,
    '  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflowContracts"',
    '  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_records, "records">>, "records">\n  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflowContracts"',
  );
  return replace(
    value,
    ').addAt("workflowContracts", GroupSpec.makeAt("workflowContracts")',
    ').addAt("records", GroupSpec.makeAt("records").addGroupAt("records", records_records)).addAt("workflowContracts", GroupSpec.makeAt("workflowContracts")',
  );
};

const confectIds = (): string =>
  replace(
    withoutFactoryProductTableNames(
      source("packages/convex/confect/_generated/id.ts"),
    ),
    ' | "promptRegistry" | "transformBlocks"',
    ' | "promptRegistry" | "records" | "transformBlocks"',
  );

const confectDocs = (): string => {
  let value = withoutFactoryProductTableLines(
    source("packages/convex/confect/_generated/docs.ts"),
  );
  value = replace(
    value,
    'export type PromptRegistryDoc = Document.Document<typeof schemaDefinition, "promptRegistry">;',
    'export type PromptRegistryDoc = Document.Document<typeof schemaDefinition, "promptRegistry">;\nexport type RecordsDoc = Document.Document<typeof schemaDefinition, "records">;',
  );
  return replace(
    value,
    "  promptRegistry: PromptRegistryDoc;",
    "  promptRegistry: PromptRegistryDoc;\n  records: RecordsDoc;",
  );
};

const routeTree = (current: boolean): string => {
  let value = current
    ? currentGeneratorSource("blueprints/customer/routeTree.gen.ts.txt")
    : source("apps/web/src/routeTree.gen.ts");
  if (current) {
    value = replace(
      value,
      "import { Route as IndexRouteImport } from './routes/index'",
      "import { Route as IndexRouteImport } from './routes/index'\nimport { Route as DashboardRouteImport } from './routes/dashboard'",
    );
    value = replace(
      value,
      "const IndexRoute = IndexRouteImport.update({\n  id: '/',\n  path: '/',\n  getParentRoute: () => rootRouteImport,\n} as any)",
      "const IndexRoute = IndexRouteImport.update({\n  id: '/',\n  path: '/',\n  getParentRoute: () => rootRouteImport,\n} as any)\nconst DashboardRoute = DashboardRouteImport.update({\n  id: '/dashboard',\n  path: '/dashboard',\n  getParentRoute: () => rootRouteImport,\n} as any)",
    );
    value = replaceAll(
      value,
      "  '/': typeof IndexRoute",
      "  '/': typeof IndexRoute\n  '/dashboard': typeof DashboardRoute",
    );
    value = replaceAll(value, "    | '/'", "    | '/'\n    | '/dashboard'");
    value = replace(
      value,
      "  IndexRoute: typeof IndexRoute",
      "  IndexRoute: typeof IndexRoute\n  DashboardRoute: typeof DashboardRoute",
    );
    value = replace(
      value,
      "  interface FileRoutesByPath {\n    '/': {",
      "  interface FileRoutesByPath {\n    '/dashboard': {\n      id: '/dashboard'\n      path: '/dashboard'\n      fullPath: '/dashboard'\n      preLoaderRoute: typeof DashboardRouteImport\n      parentRoute: typeof rootRouteImport\n    }\n    '/': {",
    );
    value = replace(
      value,
      "  IndexRoute: IndexRoute,",
      "  IndexRoute: IndexRoute,\n  DashboardRoute: DashboardRoute,",
    );
  }
  value = replace(
    value,
    "import { Route as WorkspaceRunsRouteImport } from './routes/_workspace.runs'",
    "import { Route as WorkspaceRunsRouteImport } from './routes/_workspace.runs'\nimport { Route as WorkspaceRecordsRouteImport } from './routes/_workspace.records'",
  );
  value = replace(
    value,
    "const WorkspaceRunsRoute = WorkspaceRunsRouteImport.update({\n  id: '/_workspace/runs',\n  path: '/runs',\n  getParentRoute: () => rootRouteImport,\n} as any)",
    "const WorkspaceRunsRoute = WorkspaceRunsRouteImport.update({\n  id: '/_workspace/runs',\n  path: '/runs',\n  getParentRoute: () => rootRouteImport,\n} as any)\nconst WorkspaceRecordsRoute = WorkspaceRecordsRouteImport.update({\n  id: '/_workspace/records',\n  path: '/records',\n  getParentRoute: () => rootRouteImport,\n} as any)",
  );
  value = replaceAll(
    value,
    "  '/runs': typeof WorkspaceRunsRoute",
    "  '/records': typeof WorkspaceRecordsRoute\n  '/runs': typeof WorkspaceRunsRoute",
  );
  value = replace(
    value,
    "  '/_workspace/runs': typeof WorkspaceRunsRoute",
    "  '/_workspace/records': typeof WorkspaceRecordsRoute\n  '/_workspace/runs': typeof WorkspaceRunsRoute",
  );
  value = replaceAll(value, "    | '/runs'", "    | '/records'\n    | '/runs'");
  value = replace(
    value,
    "    | '/_workspace/runs'",
    "    | '/_workspace/records'\n    | '/_workspace/runs'",
  );
  value = replace(
    value,
    "  WorkspaceRunsRoute: typeof WorkspaceRunsRoute",
    "  WorkspaceRecordsRoute: typeof WorkspaceRecordsRoute\n  WorkspaceRunsRoute: typeof WorkspaceRunsRoute",
  );
  value = replace(
    value,
    "    '/_workspace/runs': {\n      id: '/_workspace/runs'\n      path: '/runs'\n      fullPath: '/runs'\n      preLoaderRoute: typeof WorkspaceRunsRouteImport\n      parentRoute: typeof rootRouteImport\n    }",
    "    '/_workspace/runs': {\n      id: '/_workspace/runs'\n      path: '/runs'\n      fullPath: '/runs'\n      preLoaderRoute: typeof WorkspaceRunsRouteImport\n      parentRoute: typeof rootRouteImport\n    }\n    '/_workspace/records': {\n      id: '/_workspace/records'\n      path: '/records'\n      fullPath: '/records'\n      preLoaderRoute: typeof WorkspaceRecordsRouteImport\n      parentRoute: typeof rootRouteImport\n    }",
  );
  return replace(
    value,
    "  WorkspaceRunsRoute: WorkspaceRunsRoute,",
    "  WorkspaceRecordsRoute: WorkspaceRecordsRoute,\n  WorkspaceRunsRoute: WorkspaceRunsRoute,",
  );
};

export const buildSaasRegistrationProjections = (
  options: { readonly current?: boolean } = {},
): readonly GeneratedFile[] => {
  const current = options.current ?? true;
  return [
    ...(current
      ? [
          {
            path: "README.md",
            content: customerReadme(),
          },
          {
            path: "docs/template/agent-pack-privacy.md",
            content: currentPublicDocument("agent-pack-privacy.md"),
          },
          {
            path: "docs/template/preflight.md",
            content: currentPublicDocument("preflight.md"),
          },
          {
            path: "AGENTS.md",
            content: currentSource("AGENTS.md"),
          },
          {
            path: "docs/template/agent-worker-playbook.md",
            content: currentPublicDocument("agent-worker-playbook.md"),
          },
          {
            path: "docs/template/how-this-relates-to-maestro.md",
            content: currentPublicDocument("how-this-relates-to-maestro.md"),
          },
          {
            path: "agent-patterns/effect-confect.md",
            content: currentSource("agent-patterns/effect-confect.md"),
          },
          {
            path: "docs/template/repo-map.md",
            content: currentPublicDocument("repo-map.md"),
          },
          {
            path: "docs/template/template-maturity-model.md",
            content: currentPublicDocument("template-maturity-model.md"),
          },
          {
            path: "maestro-template.mjs",
            content: currentSource("maestro-template.mjs"),
          },
          {
            path: "scripts/maestro-bootstrap.mjs",
            content: currentSource("scripts/maestro-bootstrap.mjs"),
          },
          {
            path: "scripts/maestro-bootstrap.test.mjs",
            content: currentSource("scripts/maestro-bootstrap.test.mjs"),
          },
          {
            path: "scripts/configure-postmark.mts",
            content: currentSource("scripts/configure-postmark.mts"),
          },
          {
            path: "apps/web/src/bundle-policy.ts",
            content: currentSource("apps/web/src/bundle-policy.ts"),
          },
          {
            path: "apps/web/scripts/check-client-bundle-budget.mjs",
            content: currentSource(
              "apps/web/scripts/check-client-bundle-budget.mjs",
            ),
          },
          {
            path: "apps/web/scripts/check-client-bundle-budget.test.mjs",
            content: currentSource(
              "apps/web/scripts/check-client-bundle-budget.test.mjs",
            ),
          },
          {
            path: "apps/web/src/bundle-policy.test.ts",
            content: currentSource("apps/web/src/bundle-policy.test.ts"),
          },
          {
            path: "apps/web/vite.config.ts",
            content: currentSource("apps/web/vite.config.ts"),
          },
          {
            path: "pnpm-workspace.yaml",
            content: currentSource("pnpm-workspace.yaml"),
          },
          {
            path: "packages/convex/package.json",
            content: customerPackageWithoutAppIdeaEvaluator(
              "packages/convex/package.json",
            ),
          },
          {
            path: "tooling/quality/check-convex-generation.mts",
            content: currentSource(
              "tooling/quality/check-convex-generation.mts",
            ),
          },
        ]
      : []),
    {
      path: "apps/cli/src/factory/customerComposition.ts",
      content: current
        ? currentSource("apps/cli/src/factory/customerComposition.ts")
        : source("apps/cli/src/factory/customerComposition.ts"),
    },
    ...(current
      ? [
          {
            path: "apps/cli/src/factory/mcp.ts",
            content: currentSource("apps/cli/src/factory/mcp.ts"),
          },
        ]
      : []),
    {
      path: "apps/cli/src/index.ts",
      content: customerCliEntry(),
    },
    ...(current
      ? [
          {
            path: "tooling/agent-pack/package.json",
            content: customerAgentPackPackage(),
          },
        ]
      : []),
    {
      path: "apps/cli/package.json",
      content: customerCliPackage(),
    },
    ...(current
      ? [
          {
            path: "apps/web/package.json",
            content: customerPackageWithoutAppIdeaEvaluator(
              "apps/web/package.json",
            ),
          },
        ]
      : []),
    {
      path: "apps/cli/src/factory/start.ts",
      content: source("apps/cli/src/factory/start.ts"),
    },
    {
      path: "apps/cli/src/factory/customerRecipes.ts",
      content: currentSource("apps/cli/src/factory/customerRecipes.ts"),
    },
    {
      path: "apps/cli/src/factory/recipeCatalog.ts",
      content: currentSource("apps/cli/src/factory/recipeCatalog.ts"),
    },
    {
      path: "apps/cli/src/factory/recipes.ts",
      content: currentSource("apps/cli/src/factory/recipes.ts"),
    },
    ...(current
      ? [
          {
            path: "apps/cli/src/factory/supportBundle.ts",
            content: currentSource("apps/cli/src/factory/supportBundle.ts"),
          },
        ]
      : []),
    { path: ".prettierignore", content: currentSource(".prettierignore") },
    { path: "package.json", content: customerPackage(current) },
    ...(current
      ? [{ path: "pnpm-lock.yaml", content: customerLockfile() }]
      : []),
    {
      path: "tooling/confect-manifest/tsconfig.json",
      content: currentSource("tooling/confect-manifest/tsconfig.json"),
    },
    {
      path: "tooling/generators/package.json",
      content: customerGeneratorPackage(),
    },
    ...(current
      ? [
          {
            path: "tooling/quality/package.json",
            content: customerQualityPackage(),
          },
        ]
      : []),
    ...(current
      ? [
          {
            path: "examples/generic-ai-ops/template-package.json",
            content: source("examples/generic-ai-ops/template-package.json"),
          },
        ]
      : []),
    ...(current
      ? [
          "lefthook.yml",
          "scripts/pre-push-rubric.sh",
          "tooling/quality/contract-review-rubric.md",
          "tooling/quality/taste-review.mts",
        ].map((path) => ({ path, content: currentSource(path) }))
      : []),
    {
      path: "tooling/quality/install-lefthook-if-git.mjs",
      content: `/* global process */\n\n${source("tooling/quality/install-lefthook-if-git.mjs")}`,
    },
    ...(
      [
        ["customer.ts", "customer.ts"],
        ["customer-runtime.ts", "customer-runtime.ts"],
        ["customer-dispatcher.ts", "customer-dispatcher.ts"],
        ...(current
          ? ([["private-package.ts", "private-package.ts"]] as const)
          : []),
        ["customer-cli.ts", "customer-cli.ts"],
        ["crud-proof.ts", "crud-proof.ts"],
        ["direct-run.ts", "direct-run.ts"],
        ["workflow-release-commands.ts", "workflow-release-commands.ts"],
        ...(current
          ? ([
              ["workflow-source-closure.ts", "workflow-source-closure.ts"],
            ] as const)
          : []),
        ["blueprints/gtmImplementation.ts", "blueprints/gtmImplementation.ts"],
      ] as const
    ).map(([path, name]) => ({
      path: `tooling/generators/src/${path}`,
      content:
        name === "workflow-source-closure.ts"
          ? currentGeneratorSource(name)
          : source(`tooling/generators/src/${name}`),
    })),
    ...[
      "tooling/generators/src/workflow-files.ts",
      "tooling/generators/src/workflow-predeploy.ts",
      ...(current
        ? [
            "packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts",
            "packages/convex/confect/workflows/_kit/graphRunnerV2Current.ts",
            "packages/convex/confect/workflows/_kit/observedStageCurrent.ts",
            "packages/convex/confect/workflows/_kit/observedStagePayloadCurrent.ts",
            "packages/convex/confect/workflows/_kit/workflowBuilderCurrent.ts",
            "packages/convex/confect/workflows/_kit/workflowSchedule.ts",
            "packages/convex/confect/workflows/_kit/workflowScheduledCapability.ts",
            "packages/convex/confect/workflows/graphCurrent.ts",
            "packages/convex/confect/workflows/graphNodeSchemaCurrent.ts",
            "packages/convex/confect/workflows/graphSchemaCurrent.ts",
            "packages/convex/confect/workflows/graphValidationCurrent.ts",
          ]
        : []),
      "packages/convex/confect/capabilities/_kit/workspaceAccess.ts",
      "packages/convex/confect/_generated/docs.ts",
      "packages/convex/confect/_generated/tables/workflowArtifacts.ts",
      ...(!current
        ? ["packages/convex/confect/ops/dataResources.generated.ts"]
        : []),
      ...(current ? CURRENT_EMAIL_CLOSURE : []),
      ...(current ? CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE : []),
      ...(current ? CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE : []),
      ...(current ? CURRENT_PRODUCT_JOURNEY_CLOSURE : []),
      "packages/convex/confect/tables/workflowArtifacts.ts",
      "packages/convex/confect/tables/workflowRuns.ts",
      "packages/convex/confect/tables/workflowStageRuns.ts",
      "packages/convex/confect/workflows/_kit/defineMaestroWorkflow.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerExecution.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerNodes.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerV2.ts",
      "packages/convex/confect/workflows/_kit/lifecycle.ts",
      "packages/convex/confect/workflows/_kit/lifecycleControls.ts",
      "packages/convex/confect/workflows/_kit/lifecycleSafety.ts",
      "packages/convex/confect/workflows/_kit/lifecycleState.ts",
      "packages/convex/confect/workflows/_kit/lifecycleSweep.ts",
      "packages/convex/confect/workflows/_kit/observedStage.ts",
      "packages/convex/confect/workflows/_kit/observedStagePayload.ts",
      "packages/convex/confect/workflows/_kit/payloadBudget.ts",
      "packages/convex/confect/workflows/_kit/policySnapshot.ts",
      "packages/convex/confect/workflows/_kit/principal.ts",
      "packages/convex/confect/workflows/_kit/subworkflows.ts",
      "packages/convex/confect/workflows/_kit/workflowArtifacts.ts",
      "packages/convex/confect/workflows/lifecycleAdapters.ts",
      "packages/convex/confect/workflows/lifecycle.impl.ts",
      "packages/convex/confect/workflows/lifecycleInspection.ts",
      "packages/convex/confect/workflows/lifecyclePersistence.ts",
      "packages/convex/confect/workflows/lifecycleReconciliation.ts",
      "packages/convex/confect/workflows/lifecycle.spec.ts",
      "packages/convex/test/workflow-lifecycle-controls.fixture.ts",
      "packages/convex/test/workflow-lifecycle-registration.test.ts",
      "tooling/quality/check-workflow-policy-snapshots.mts",
      "tooling/quality/check-workflow-principal-propagation.mts",
      "tooling/quality/fixtures/workflow-policy-snapshots.json",
    ].map((path) => ({
      path,
      content:
        path === "packages/convex/confect/_generated/docs.ts"
          ? current
            ? confectDocs()
            : source(path)
          : path.endsWith("Current.ts") ||
              path.endsWith("workflowSchedule.ts") ||
              path.endsWith("workflowScheduledCapability.ts")
            ? currentSource(path)
            : source(path),
    })),
    ...[
      "start.ts",
      "ports.ts",
      "verify.ts",
      "receiptWriter.ts",
      "recipes.ts",
      "recipeTransaction.ts",
      "index.ts",
      "readiness/artifacts.ts",
      "readiness/index.ts",
      "readiness/nodeSurface.ts",
      "readiness/presenter.ts",
      "readiness/server.ts",
    ].map((path) => ({
      path: `tooling/agent-pack/src/${path}`,
      content:
        current && path === "index.ts"
          ? currentSource("tooling/agent-pack/src/customer.ts")
          : source(`tooling/agent-pack/src/${path}`),
    })),
    ...(current
      ? ["mcp/protocol.ts", "mcp/projection.ts", "mcp/server.ts"].map(
          (path) => ({
            path: `tooling/agent-pack/src/${path}`,
            content: currentSource(`tooling/agent-pack/src/${path}`),
          }),
        )
      : []),
    ...(current
      ? [
          "customerTestClosure.ts",
          "customerTestClosure.test.ts",
          "mcp/projection.test.ts",
          "mcp/protocol.test.ts",
          "mcp/server.test.ts",
          "nodeAdapters.test.ts",
        ].map((path) => ({
          path: `tooling/agent-pack/src/${path}`,
          content: currentSource(`tooling/agent-pack/src/${path}`),
        }))
      : []),
    ...(current
      ? [
          {
            path: "apps/web/src/routes/index.tsx",
            content: currentGeneratorSource(
              "blueprints/customer/index-route.tsx.txt",
            ),
          },
          {
            path: "apps/web/src/providers/posthog.tsx",
            content: currentGeneratorSource(
              "blueprints/customer/posthog.tsx.txt",
            ),
          },
        ]
      : []),
    ...(current
      ? [
          "privacy/supportBundle.ts",
          "privacy/supportBundleCommand.ts",
          "privacy/nodeSupportBundleExporter.ts",
          "privacy/support-bundle.schema.json",
        ].map((path) => ({
          path: `tooling/agent-pack/src/${path}`,
          content: currentSource(`tooling/agent-pack/src/${path}`),
        }))
      : []),
    {
      path: "tooling/quality/check-agent-pack.mts",
      content: customerAgentPackCheck(),
    },
    {
      path: "tooling/quality/check-customer-context.mts",
      content: releasedSource("tooling/quality/check-customer-context.mts"),
    },
    {
      path: "tooling/quality/check-convex-ai-files.mts",
      content: currentGeneratorSource(
        "blueprints/customer/check-convex-ai-files.mts",
      ),
    },
    ...customerContextProjections(),
    {
      path: "packages/convex/confect/_generated/tables/records.ts",
      content:
        'import unnamed from "../../tables/records";\n\nexport default unnamed("records");\n',
    },
    {
      path: "packages/convex/confect/_generated/schema.ts",
      content: databaseSchema(),
    },
    {
      path: "packages/convex/confect/_generated/convexSchema.ts",
      content: convexSchema(),
    },
    {
      path: "packages/convex/confect/_generated/spec.ts",
      content: confectSpec(current),
    },
    {
      path: "packages/convex/confect/_generated/id.ts",
      content: confectIds(),
    },
    {
      path: current
        ? "packages/convex/confect/_generated/registeredFunctions/records/records.ts"
        : "packages/convex/confect/_generated/registeredFunctions/records.ts",
      content: current
        ? 'import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";\nimport databaseSchema from "../../schema";\nimport records from "../../../records/records.impl";\n\nexport default RegisteredFunctions.buildForGroup<typeof import("../../../records/records.spec")["default"]>(databaseSchema, records, RegisteredConvexFunction.make);\n'
        : 'import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";\nimport databaseSchema from "../schema";\nimport records from "../../records/records.impl";\n\nexport default RegisteredFunctions.buildForGroup<typeof import("../../records/records.spec")["default"]>(databaseSchema, records, RegisteredConvexFunction.make);\n',
    },
    {
      path: current
        ? "packages/convex/convex/records/records.ts"
        : "packages/convex/convex/records.ts",
      content: current
        ? 'import registeredFunctions from "../../confect/_generated/registeredFunctions/records/records";\n\nexport const create = registeredFunctions.create;\nexport const list = registeredFunctions.list;\nexport const read = registeredFunctions.read;\n'
        : 'import registeredFunctions from "../confect/_generated/registeredFunctions/records";\n\nexport const list = registeredFunctions.list;\nexport const read = registeredFunctions.read;\nexport const create = registeredFunctions.create;\n',
    },
    { path: "apps/web/src/routeTree.gen.ts", content: routeTree(current) },
    {
      path: "apps/web/src/routeRegistry.generated.ts",
      content:
        'export const saasApplicationRoutes = { records: "/records" } as const;\n',
    },
  ];
};
