import { existsSync, readFileSync } from "node:fs";
import type { GeneratedFile } from "../index";
import {
  selectsSaasApplicationPattern,
  type SaasApplicationPatternSelection,
} from "./saasApplicationPatterns";

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

const customerEngineeringRules = (workflowSelected: boolean): string => {
  const rules = currentPublicDocument("enforced-engineering-rules.md");
  if (workflowSelected) return rules;
  return rules
    .split("\n")
    .filter((line) => !line.startsWith("| Workflow "))
    .join("\n");
};

export const currentSource = (path: string): string => {
  const url = new URL(`../../../../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : releasedSource(path);
};

const source = (path: string): string => currentSource(path);
const currentGeneratorSource = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const customerRuntimeSource = (
  current: boolean,
  selection: SaasApplicationPatternSelection,
): string => {
  const value = current
    ? currentGeneratorSource("customer-runtime.ts")
    : source("tooling/generators/src/customer-runtime.ts");
  return current &&
    !selectsSaasApplicationPattern(selection, "workflow-automation")
    ? replace(
        value,
        'export { buildWorkflowFiles } from "./workflow-files";\n',
        [
          "export const buildWorkflowFiles = (",
          "  options: WorkflowGeneratorOptions,",
          "): WorkflowGeneratorResult => {",
          "  void options;",
          '  throw new Error("Workflow automation pattern is not selected.");',
          "};",
          "",
        ].join("\n"),
      )
    : value;
};

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

const CURRENT_CUSTOMER_PATCHES = [
  "patches/@chakra-ui__react@3.33.0.patch",
  "patches/@confect__cli@10.0.0-next.9.patch",
  "patches/@dnd-kit__core@6.3.1.patch",
  "patches/@dnd-kit__sortable@8.0.0.patch",
  "patches/@saas-ui-pro__react@1.0.0-next.4.patch",
  "patches/@saas-ui__react@3.0.0-next.51.patch",
  "patches/@tanstack__router-core@1.171.27.patch",
  "patches/@zag-js__toast@1.24.2.patch",
  "patches/@zag-js__toast@1.31.1.patch",
  "patches/effect@4.0.0-beta.102.patch",
] as const;

const customerReadme = (
  recordsSelected: boolean,
): string => `# Generated Maestro App

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

${
  recordsSelected
    ? "The selected `records-example` pattern includes a workspace-owned record slice. Open the URL printed after `/health` becomes ready, then exercise `/records`: create a record, return to the list, and open its detail."
    : "The starter is a neutral product chassis. Implement the first real product outcome before promoting its `@wip` contract to `@required`; select `records-example` only when a runnable CRUD reference is useful."
}

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

export const CURRENT_HEADLESS_CONTRACT_SOURCE_CLOSURE = [
  "packages/convex/confect/_generated/registeredFunctions/headless/apiKeys.ts",
  "packages/convex/confect/headless/apiKeys.impl.ts",
  "packages/convex/confect/headless/apiKeys.spec.ts",
  "packages/convex/confect/headless/auth.ts",
  "packages/convex/convex/headless/apiKeys.ts",
] as const;

export const CURRENT_EMAIL_CLOSURE = [
  ".env.example",
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
  "project.config.json",
  "tooling/confect-manifest/src/generate.ts",
  "tooling/quality/check-env-boundary.mts",
  "tooling/quality/check-env-boundary.test.mts",
  "tooling/workflow/src/index.test.ts",
  "tooling/workflow/src/index.ts",
] as const;

export const CURRENT_EMAIL_BASE_COPY_REPLACEMENTS = [
  ".env.example",
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

export const CURRENT_CUSTOMER_CONVEX_TEST_EXCLUSIONS = [
  "packages/convex/test/confect-codegen-component-roots.test.ts",
  "packages/convex/test/data-lifecycle.test.ts",
] as const;

export const CURRENT_CUSTOMER_PROJECT_TSCONFIGS = [
  "apps/cli/tsconfig.json",
  "packages/convex/tsconfig.json",
  "packages/editor-core/tsconfig.json",
  "packages/editor-react/tsconfig.json",
  "packages/workflow-ui/tsconfig.json",
  "packages/template-core/tsconfig.json",
  "packages/integrations/tsconfig.json",
  "packages/notifications/tsconfig.json",
  "packages/storage/tsconfig.json",
  "packages/observability/tsconfig.json",
  "packages/search/tsconfig.json",
  "tooling/agent-pack/tsconfig.json",
  "tooling/quality/tsconfig.json",
  "tooling/generators/tsconfig.json",
  "tooling/evals/tsconfig.json",
  "tooling/release/tsconfig.json",
] as const;

const exclusionArguments = (
  paths: readonly string[],
  packagePrefix = "",
): string =>
  paths.map((path) => ` --exclude ${path.replace(packagePrefix, "")}`).join("");

const currentCustomerRootTestExclusions = (): string =>
  exclusionArguments(CURRENT_CUSTOMER_QUALITY_TEST_EXCLUSIONS);

export const CUSTOMER_ROOT_SCRIPTS = [
  "check:saas-ui-foundation",
  "check:saas-ui-artifact-safety",
  "maestro",
  "product-contract:generate",
  "check:product-contract",
  "acceptance:all",
  "acceptance:required",
  "format",
  "check:format",
  "lint",
  "typecheck",
  "typecheck:saas-ui",
  "typecheck:saas-ui:baseline",
  "check:effect-diagnostics",
  "test",
  "test:runtime-longevity",
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
  "template:configure-shell",
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

const WORKFLOW_CUSTOMER_SCRIPTS = new Set([
  "test:workflow",
  "check:workflow:fast",
  "check:workflow-semantics",
  "check:workflow-graph-boundary",
  "check:workflow-policy-snapshots",
  "check:workflow-principal-propagation",
  "check:workflow-version-immutability",
  "check:workflow-publication-generation",
]);

const customerPackage = (
  current: boolean,
  selection: SaasApplicationPatternSelection,
  // eslint-disable-next-line complexity -- AP-008 tracks extracting optional script-group rendering.
): string => {
  if (!current) return releasedSource("package.json");
  const workflowSelected = selectsSaasApplicationPattern(
    selection,
    "workflow-automation",
  );
  const value = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
  };
  const sourceScripts = value.scripts;
  const generatedAcceptanceScripts: Readonly<Record<string, string>> = {
    "product-contract:generate":
      "tsx tooling/acceptance/product-contract.mts generate --source-root .",
    "check:product-contract":
      "tsx tooling/acceptance/product-contract.mts check --source-root . --allow-first-contract",
    "acceptance:all":
      "tsx tooling/acceptance/run-acceptance.mts all --source-root .",
    "acceptance:required":
      "tsx tooling/acceptance/run-acceptance.mts required --source-root .",
  };
  value.scripts = Object.fromEntries(
    CUSTOMER_ROOT_SCRIPTS.filter(
      (name) => workflowSelected || !WORKFLOW_CUSTOMER_SCRIPTS.has(name),
    ).map((name) => {
      const command = generatedAcceptanceScripts[name] ?? sourceScripts[name];
      if (command === undefined) {
        throw new Error(`missing customer root script: ${name}`);
      }
      return [name, command];
    }),
  );
  value.scripts.test =
    "turbo run test --filter='./packages/*' --filter=@maestro-template/web && pnpm test:tooling";
  value.scripts["test:tooling"] = workflowSelected
    ? "pnpm test:bootstrap && pnpm --dir tooling/workflow test && pnpm --dir tooling/generators exec vitest run src/customer-runtime.test.ts src/templateInstanceMigration.test.ts src/workflow-publication-generation.test.ts src/workflow-release-commands.test.ts --maxWorkers=1 --no-file-parallelism"
    : "pnpm test:bootstrap && pnpm --dir tooling/generators exec vitest run src/customer-runtime.test.ts --maxWorkers=1 --no-file-parallelism";
  value.scripts["check:coverage-ratchet"] =
    `vitest run --coverage --maxWorkers=1 --no-file-parallelism packages/template-core packages/integrations packages/search packages/storage packages/notifications packages/observability packages/convex tooling/quality${workflowSelected ? " tooling/workflow" : ""} tooling/generators apps/cli apps/web${current ? currentCustomerRootTestExclusions() : ""} && tsx tooling/quality/check-coverage-ratchet.mts`;
  value.scripts["coverage:update-baseline"] =
    `vitest run --coverage packages/template-core packages/integrations packages/search packages/storage packages/notifications packages/observability packages/convex tooling/quality${workflowSelected ? " tooling/workflow" : ""} tooling/generators apps/cli apps/web${current ? currentCustomerRootTestExclusions() : ""} && tsx tooling/quality/check-coverage-ratchet.mts --update`;
  value.scripts["check:agent-pack"] =
    "tsx tooling/quality/check-agent-pack.mts";
  value.scripts["check:saas-ui-artifact-safety"] =
    "tsx tooling/quality/check-saas-ui-artifact-safety.mts";
  value.scripts["check:layer-boundaries"] =
    "depcruise --config dependency-cruiser.config.cjs apps packages tooling tests";
  value.scripts.prepare = "node tooling/quality/install-lefthook-if-git.mjs";
  value.scripts.verify = [
    "check:format",
    "lint",
    "typecheck",
    "check:effect-diagnostics",
    "test",
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
    "check:saas-ui-artifact-safety",
  ]
    .filter((name) => workflowSelected || !WORKFLOW_CUSTOMER_SCRIPTS.has(name))
    .map((name) => `pnpm ${name}`)
    .join(" && ");
  value.scripts.verify +=
    " && pnpm check:product-contract && pnpm acceptance:required";
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
  if (selectsSaasApplicationPattern(selection, "records-example"))
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
  scripts.build = "tsc -p tsconfig.customer.json --outDir dist --declaration";
  scripts.typecheck = "tsc -p tsconfig.customer.json --noEmit";
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerGeneratorTsconfig = (): string =>
  `${JSON.stringify(
    {
      extends: "./tsconfig.json",
      compilerOptions: { composite: false },
      include: ["src/customer.ts", "src/customer-cli.ts"],
    },
    null,
    2,
  )}\n`;

const customerConvexCompatPackage = (): string => {
  const value = JSON.parse(
    currentSource("tooling/convex-compat/package.json"),
  ) as { scripts: Record<string, string> };
  value.scripts.typecheck = "tsc -p tsconfig.customer.json --noEmit";
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerConvexCompatTsconfig = (): string =>
  `${JSON.stringify(
    {
      extends: "./tsconfig.json",
      compilerOptions: { composite: false },
      include: ["src/matrix.ts"],
    },
    null,
    2,
  )}\n`;

const customerPackageWithoutOptionalPatterns = (
  path: string,
  selection: SaasApplicationPatternSelection,
): string => {
  const value = JSON.parse(currentSource(path)) as {
    dependencies: Record<string, string>;
  };
  delete value.dependencies["@maestro-template/app-idea-evaluator"];
  if (!selectsSaasApplicationPattern(selection, "workflow-automation"))
    delete value.dependencies["@maestro-template/workflow-tooling"];
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerConvexPackage = (
  selection: SaasApplicationPatternSelection,
): string => {
  const value = JSON.parse(currentSource("packages/convex/package.json")) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  delete value.dependencies["@maestro-template/app-idea-evaluator"];
  if (!selectsSaasApplicationPattern(selection, "workflow-automation")) {
    delete value.dependencies["@convex-dev/workflow"];
    delete value.dependencies["@maestro-template/workflow-tooling"];
    value.scripts["test:customer"] = `${value.scripts.test}${exclusionArguments(
      CURRENT_CUSTOMER_CONVEX_TEST_EXCLUSIONS,
      "packages/convex/",
    )}`;
    value.scripts.test = value.scripts["test:customer"];
  }
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerConvexConfig = (workflowSelected: boolean): string => {
  let value = currentSource("packages/convex/convex/convex.config.ts");
  if (workflowSelected) return value;
  for (const line of [
    'import workflow from "@convex-dev/workflow/convex.config";\n',
    'import workflowDeadline from "./components/workflowDeadline/convex.config";\n',
    'import workflowAdmission from "./components/workflowAdmission/convex.config";\n',
    'app.use(workpool, { name: "workflowDeadlineWorkpool" });\n',
    'app.use(workflow, { name: "workflow" });\n',
    'app.use(workflowDeadline, { name: "workflowDeadline" });\n',
    'app.use(workflowAdmission, { name: "workflowAdmission" });\n',
  ])
    value = replace(value, line, "");
  return value;
};

const customerConfectComponents = (workflowSelected: boolean): string => {
  const value = currentSource(
    "packages/convex/confect/_generated/components.ts",
  );
  if (workflowSelected) return value;
  return value
    .split("\n")
    .filter(
      (line) =>
        !line.includes('"workflow"') &&
        !line.includes('"workflowAdmission"') &&
        !line.includes('"workflowDeadline"') &&
        !line.includes('"workflowDeadlineWorkpool"'),
    )
    .join("\n");
};

const customerConvexApi = (workflowSelected: boolean): string => {
  const value = currentSource("packages/convex/convex/_generated/api.d.ts");
  if (workflowSelected) return value;
  return value
    .split("\n")
    .filter(
      (line) =>
        !line.includes("demo_showcase") && !line.includes('"demo/showcase"'),
    )
    .join("\n");
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

const customerCliPackage = (
  selection: SaasApplicationPatternSelection,
): string => {
  const value = JSON.parse(source("apps/cli/package.json")) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  delete value.dependencies["@maestro-template/release-tooling"];
  if (!selectsSaasApplicationPattern(selection, "workflow-automation"))
    delete value.dependencies["@maestro-template/workflow-tooling"];
  value.scripts.build =
    "tsc -p tsconfig.customer.json --outDir dist --declaration";
  value.scripts.typecheck = "tsc -p tsconfig.customer.json --noEmit";
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerCliTsconfig = (): string =>
  `${JSON.stringify(
    {
      extends: "./tsconfig.json",
      compilerOptions: { composite: false },
      include: ["src/index.ts"],
    },
    null,
    2,
  )}\n`;

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

const removeLockfileImporter = (
  value: string,
  importerPath: string,
): string => {
  const startMarker = `  ${importerPath}:`;
  const start = value.indexOf(startMarker);
  if (start < 0)
    throw new Error(`Customer lockfile importer is missing: ${importerPath}`);
  const remainderStart = start + startMarker.length;
  const nextMatch = /\n {2}\S/gu.exec(value.slice(remainderStart));
  const nextImporter =
    nextMatch === null ? -1 : remainderStart + nextMatch.index + 1;
  const packages = value.indexOf("\npackages:", start);
  const end =
    nextImporter >= 0 && (packages < 0 || nextImporter < packages)
      ? nextImporter + 1
      : packages + 1;
  if (end <= start)
    throw new Error(
      `Customer lockfile importer end is missing: ${importerPath}`,
    );
  return `${value.slice(0, start)}${value.slice(end)}`;
};

const lockfileDependencyStart = (
  value: string,
  importerStart: number,
  importerEnd: number,
  dependency: string,
) =>
  [`      "${dependency}":`, `      '${dependency}':`]
    .map((marker) => value.indexOf(marker, importerStart))
    .find((start) => start >= importerStart && start < importerEnd);

const removeLockfileImporterDependencyByName = (
  value: string,
  importerPath: string,
  dependency: string,
): string => {
  const importerMarker = `  ${importerPath}:`;
  const importerStart = value.indexOf(importerMarker);
  const importerBodyStart = importerStart + importerMarker.length;
  const nextImporter = /^ {2}\S.*$/gmu.exec(value.slice(importerBodyStart));
  const packages = value.indexOf("\npackages:", importerStart);
  const importerEnd =
    nextImporter === null ? packages : importerBodyStart + nextImporter.index;
  const dependencyStart = lockfileDependencyStart(
    value,
    importerStart,
    importerEnd,
    dependency,
  );
  if (
    importerStart < 0 ||
    importerEnd <= importerStart ||
    dependencyStart === undefined
  )
    throw new Error(
      `Customer lockfile dependency is missing: ${importerPath} -> ${dependency}`,
    );
  const nextDependency = /^ {6}\S.*$/gmu.exec(
    value.slice(dependencyStart + 1, importerEnd),
  );
  const dependencyEnd =
    nextDependency === null
      ? importerEnd
      : dependencyStart + 1 + nextDependency.index;
  return `${value.slice(0, dependencyStart)}${value.slice(dependencyEnd)}`;
};

const hasLockfileImporterDependency = (
  value: string,
  importerPath: string,
  dependency: string,
): boolean => {
  const importerMarker = `  ${importerPath}:`;
  const importerStart = value.indexOf(importerMarker);
  if (importerStart < 0) return false;
  const importerBodyStart = importerStart + importerMarker.length;
  const nextImporter = /^ {2}\S.*$/gmu.exec(value.slice(importerBodyStart));
  const packages = value.indexOf("\npackages:", importerStart);
  const importerEnd =
    nextImporter === null ? packages : importerBodyStart + nextImporter.index;
  if (importerEnd <= importerStart) return false;
  return (
    lockfileDependencyStart(value, importerStart, importerEnd, dependency) !==
    undefined
  );
};

const removeLockfileImporterDependencyIfPresent = (
  value: string,
  importerPath: string,
  dependency: string,
): string =>
  hasLockfileImporterDependency(value, importerPath, dependency)
    ? removeLockfileImporterDependencyByName(value, importerPath, dependency)
    : value;

const removeUnselectedWorkflowLockfile = (
  value: string,
  selection: SaasApplicationPatternSelection,
): string => {
  if (selectsSaasApplicationPattern(selection, "workflow-automation"))
    return value;
  const withoutImporter = removeLockfileImporter(value, "tooling/workflow");
  return ["apps/cli", "apps/web", "packages/convex"].reduce(
    (projected, importer) =>
      removeLockfileImporterDependencyIfPresent(
        projected,
        importer,
        "@maestro-template/workflow-tooling",
      ),
    removeLockfileImporterDependencyIfPresent(
      withoutImporter,
      "packages/convex",
      "@convex-dev/workflow",
    ),
  );
};

const customerLockfile = (
  selection: SaasApplicationPatternSelection,
): string => {
  let value = removeLockfileImporterDependencyIfPresent(
    source("pnpm-lock.yaml"),
    "apps/web",
    "@maestro-template/app-idea-evaluator",
  );
  value = removeUnselectedWorkflowLockfile(value, selection);
  value = ["packages/convex", "tooling/generators"].reduce(
    (projected, importer) =>
      removeLockfileImporterDependencyIfPresent(
        projected,
        importer,
        "@maestro-template/app-idea-evaluator",
      ),
    value,
  );
  value = ["apps/cli", "tooling/generators"].reduce(
    (projected, importer) =>
      removeLockfileImporterDependencyIfPresent(
        projected,
        importer,
        "@maestro-template/release-tooling",
      ),
    value,
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

const customerRootTsconfig = (workflowSelected: boolean): string => {
  const value = currentSource("tsconfig.json");
  return workflowSelected
    ? value
    : replace(value, '    { "path": "./tooling/workflow" },\n', "");
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
const customerCliModuleSource = (
  path: "apps/cli/src/commands.ts" | "apps/cli/src/index.ts",
  selection: SaasApplicationPatternSelection,
): string => {
  const value = currentSource(path);
  return selectsSaasApplicationPattern(selection, "workflow-automation")
    ? value
    : replace(
        value,
        'from "@maestro-template/workflow-tooling";',
        'from "./headlessRegistry";',
      );
};

const neutralHeadlessRegistrySource = (): string => {
  let value = currentSource("tooling/workflow/src/index.ts");
  value = replace(
    value,
    'import {\n  describeDefaultWorkflow,\n  describeWorkflowRegistry,\n  runDefaultWorkflow,\n  runWorkflowRegistry,\n} from "./workflow-compat";\n',
    "",
  );
  value = replace(
    value,
    "export const describeWorkflowTemplate = (registry?: TemplateRegistry) =>\n  registry === undefined\n    ? describeDefaultWorkflow(\n        confectManifest.functions.length,\n        buildHeadlessOperations().length,\n      )\n    : describeWorkflowRegistry(\n        registry,\n        confectManifest.functions.length,\n        buildHeadlessOperations(registry).length,\n      );",
    'export const describeWorkflowTemplate = (registry?: TemplateRegistry) => {\n  void registry;\n  return {\n    id: "workflow-automation",\n    status: "unavailable",\n    contractFunctions: confectManifest.functions.length,\n    headlessOperations: buildHeadlessOperations().length,\n  } as const;\n};',
  );
  value = replace(
    value,
    'const workflowRunMcpTool: McpToolEntry = {\n  name: "template.workflow.run",\n  description: "Run the template workflow compatibility adapter.",\n  inputSchema: {\n    type: "object",\n    additionalProperties: false,\n  },\n  typedErrors: [],\n};\n\nexport const buildMcpTools = (\n  registry?: TemplateRegistry,\n): readonly McpToolEntry[] => [\n  ...buildGeneratedMcpTools(registry),\n  workflowRunMcpTool,\n];\n\nexport const runTemplateWorkflow = (\n  registry?: TemplateRegistry,\n): WorkflowRunReceipt =>\n  registry === undefined ? runDefaultWorkflow() : runWorkflowRegistry(registry);',
    'export const buildMcpTools = buildGeneratedMcpTools;\n\nexport const runTemplateWorkflow = (): WorkflowRunReceipt => {\n  throw new Error("Workflow automation pattern is not selected.");\n};',
  );
  return replace(
    value,
    "  if (toolName === workflowRunMcpTool.name) {\n    return mcpText(runTemplateWorkflow(registry));\n  }\n\n",
    "",
  );
};

const customerCliEntry = (
  current: boolean,
  selection: SaasApplicationPatternSelection,
): string => {
  if (!current) return releasedSource("apps/cli/src/index.ts");
  let value = customerCliModuleSource("apps/cli/src/index.ts", selection);
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

const WORKFLOW_TABLES = [
  "workflowArtifacts",
  "workflowEffectReservations",
  "workflowEventInstances",
  "workflowRunContextManifests",
  "workflowRunEvents",
  "workflowRunEvidenceSnapshots",
  "workflowRunLinks",
  "workflowRuns",
  "workflowStageRuns",
] as const;

const workflowTablePattern = new RegExp(
  `\\b(?:${WORKFLOW_TABLES.join("|")})\\b`,
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

const withoutWorkflowTableLines = (value: string): string =>
  value
    .split("\n")
    .filter((line) => !workflowTablePattern.test(line))
    .join("\n");

const withoutWorkflowTableNames = (value: string): string => {
  let projected = value;
  for (const table of WORKFLOW_TABLES)
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

const WORKFLOW_CONFECT_IMPORT_FRAGMENTS = [
  'from "../workflowContracts/',
  'from "../workflowRunners/',
  'from "../workflows/',
  'from "../demo/showcase.spec"',
  'from "../capabilities/_versions/publicationEcho/',
] as const;

const WORKFLOW_CONFECT_GROUP_FRAGMENTS = [
  '"workflowContracts"',
  '"workflowRunners"',
  '>, "demo">',
  '>, "workflows">',
] as const;

const withoutWorkflowConfectGroups = (value: string): string => {
  let projected = value
    .split("\n")
    .filter(
      (line) =>
        !(
          line.startsWith("import ") &&
          WORKFLOW_CONFECT_IMPORT_FRAGMENTS.some((fragment) =>
            line.includes(fragment),
          )
        ) &&
        !(
          line.startsWith("  | GroupSpec.NamedAt") &&
          WORKFLOW_CONFECT_GROUP_FRAGMENTS.some((fragment) =>
            line.includes(fragment),
          )
        ),
    )
    .join("\n");
  projected = projected.replace(
    'GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "_versions", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "publicationEcho", never, GroupSpec.NamedAt<typeof capabilities__versions_publicationEcho_v1, "v1">>, "publicationEcho">>, "_versions"> | ',
    "",
  );
  for (const marker of [
    '.addGroupAt("_versions",',
    '.addAt("demo",',
    '.addAt("workflowContracts",',
    '.addAt("workflowRunners",',
    '.addAt("workflows",',
  ])
    projected = removeChainedCall(projected, marker);
  return projected;
};

const databaseSchema = (
  recordsSelected: boolean,
  workflowSelected: boolean,
): string => {
  let value = withoutFactoryProductTableLines(
    source("packages/convex/confect/_generated/schema.ts"),
  );
  if (!workflowSelected) value = withoutWorkflowTableLines(value);
  if (!recordsSelected) return value;
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

const convexSchema = (
  recordsSelected: boolean,
  workflowSelected: boolean,
): string => {
  let value = withoutFactoryProductTableLines(
    source("packages/convex/confect/_generated/convexSchema.ts"),
  );
  if (!workflowSelected) value = withoutWorkflowTableLines(value);
  if (!recordsSelected) return value;
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

const confectSpec = (
  current: boolean,
  recordsSelected: boolean,
  workflowSelected: boolean,
): string => {
  let value = current
    ? withoutFactoryProductConfectGroups(
        source("packages/convex/confect/_generated/spec.ts"),
      )
    : source("packages/convex/confect/_generated/spec.ts");
  if (!workflowSelected) value = withoutWorkflowConfectGroups(value);
  if (!recordsSelected) return value;
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
  const typeMarker = workflowSelected
    ? '  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflowContracts"'
    : '  | GroupSpec.NamedAt<typeof editorSync, "editorSync">';
  value = replace(
    value,
    typeMarker,
    `  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_records, "records">>, "records">\n${typeMarker}`,
  );
  const registrationMarker = workflowSelected
    ? ').addAt("workflowContracts", GroupSpec.makeAt("workflowContracts")'
    : ').addAt("editorSync", editorSync)';
  return replace(
    value,
    registrationMarker,
    `).addAt("records", GroupSpec.makeAt("records").addGroupAt("records", records_records))${registrationMarker.slice(1)}`,
  );
};

const confectIds = (
  recordsSelected: boolean,
  workflowSelected: boolean,
): string => {
  let value = withoutFactoryProductTableNames(
    source("packages/convex/confect/_generated/id.ts"),
  );
  if (!workflowSelected) value = withoutWorkflowTableNames(value);
  return recordsSelected
    ? replace(
        value,
        ' | "promptRegistry" | "providerConnections" | "transformBlocks"',
        ' | "promptRegistry" | "providerConnections" | "records" | "transformBlocks"',
      )
    : value;
};

const confectDocs = (
  recordsSelected: boolean,
  workflowSelected: boolean,
): string => {
  let value = withoutFactoryProductTableLines(
    source("packages/convex/confect/_generated/docs.ts"),
  );
  if (!workflowSelected) value = withoutWorkflowTableLines(value);
  if (!recordsSelected) return value;
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

const routeTree = (recordsSelected: boolean): string => {
  let value = releasedSource("apps/web/src/routeTree.gen.ts");
  if (!recordsSelected) return value;
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

export const projectCurrentRecordsRouteTree = (source: string): string => {
  const replacements = [
    [
      "import { Route as AppWorkspaceDashboardKanbanRouteImport } from './routes/_app/$workspace/_dashboard/kanban'",
      "import { Route as AppWorkspaceDashboardKanbanRouteImport } from './routes/_app/$workspace/_dashboard/kanban'\nimport { Route as AppWorkspaceDashboardRecordsRouteImport } from './routes/_app/$workspace/_dashboard/records'",
    ],
    [
      "const AppWorkspaceDashboardKanbanRoute =\n  AppWorkspaceDashboardKanbanRouteImport.update({\n    id: '/kanban',\n    path: '/kanban',\n    getParentRoute: () => AppWorkspaceDashboardRoute,\n  } as any)",
      "const AppWorkspaceDashboardKanbanRoute =\n  AppWorkspaceDashboardKanbanRouteImport.update({\n    id: '/kanban',\n    path: '/kanban',\n    getParentRoute: () => AppWorkspaceDashboardRoute,\n  } as any)\nconst AppWorkspaceDashboardRecordsRoute =\n  AppWorkspaceDashboardRecordsRouteImport.update({\n    id: '/records',\n    path: '/records',\n    getParentRoute: () => AppWorkspaceDashboardRoute,\n  } as any)",
    ],
    [
      "  '/$workspace/kanban': typeof AppWorkspaceDashboardKanbanRoute",
      "  '/$workspace/kanban': typeof AppWorkspaceDashboardKanbanRoute\n  '/$workspace/records': typeof AppWorkspaceDashboardRecordsRoute",
    ],
    [
      "  '/_app/$workspace/_dashboard/kanban': typeof AppWorkspaceDashboardKanbanRoute",
      "  '/_app/$workspace/_dashboard/kanban': typeof AppWorkspaceDashboardKanbanRoute\n  '/_app/$workspace/_dashboard/records': typeof AppWorkspaceDashboardRecordsRoute",
    ],
    [
      "    | '/$workspace/kanban'",
      "    | '/$workspace/kanban'\n    | '/$workspace/records'",
    ],
    [
      "    | '/_app/$workspace/_dashboard/kanban'",
      "    | '/_app/$workspace/_dashboard/kanban'\n    | '/_app/$workspace/_dashboard/records'",
    ],
    [
      "    '/_app/$workspace/_dashboard/kanban': {\n      id: '/_app/$workspace/_dashboard/kanban'\n      path: '/kanban'\n      fullPath: '/$workspace/kanban'\n      preLoaderRoute: typeof AppWorkspaceDashboardKanbanRouteImport\n      parentRoute: typeof AppWorkspaceDashboardRoute\n    }",
      "    '/_app/$workspace/_dashboard/kanban': {\n      id: '/_app/$workspace/_dashboard/kanban'\n      path: '/kanban'\n      fullPath: '/$workspace/kanban'\n      preLoaderRoute: typeof AppWorkspaceDashboardKanbanRouteImport\n      parentRoute: typeof AppWorkspaceDashboardRoute\n    }\n    '/_app/$workspace/_dashboard/records': {\n      id: '/_app/$workspace/_dashboard/records'\n      path: '/records'\n      fullPath: '/$workspace/records'\n      preLoaderRoute: typeof AppWorkspaceDashboardRecordsRouteImport\n      parentRoute: typeof AppWorkspaceDashboardRoute\n    }",
    ],
    [
      "  AppWorkspaceDashboardKanbanRoute: typeof AppWorkspaceDashboardKanbanRoute",
      "  AppWorkspaceDashboardKanbanRoute: typeof AppWorkspaceDashboardKanbanRoute\n  AppWorkspaceDashboardRecordsRoute: typeof AppWorkspaceDashboardRecordsRoute",
    ],
    [
      "  AppWorkspaceDashboardKanbanRoute: AppWorkspaceDashboardKanbanRoute,",
      "  AppWorkspaceDashboardKanbanRoute: AppWorkspaceDashboardKanbanRoute,\n  AppWorkspaceDashboardRecordsRoute: AppWorkspaceDashboardRecordsRoute,",
    ],
  ] as const;
  return replacements.reduce(
    (value, [search, replacement]) => replaceAll(value, search, replacement),
    source,
  );
};

export const buildSaasRegistrationProjections = (
  options: {
    readonly current?: boolean;
  } & SaasApplicationPatternSelection = {},
  // eslint-disable-next-line complexity -- this is a declarative file projection, not branching behavior
): readonly GeneratedFile[] => {
  const current = options.current ?? true;
  const workflowSelected =
    !current || selectsSaasApplicationPattern(options, "workflow-automation");
  const recordsSelected =
    !current || selectsSaasApplicationPattern(options, "records-example");
  return [
    ...(current
      ? [
          {
            path: "README.md",
            content: customerReadme(recordsSelected),
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
            path: "docs/template/coding-standards.md",
            content: currentPublicDocument("coding-standards.md"),
          },
          {
            path: "docs/template/enforced-engineering-rules.md",
            content: customerEngineeringRules(workflowSelected),
          },
          ...(workflowSelected
            ? [
                {
                  path: "tooling/workflow/package.json",
                  content: currentSource("tooling/workflow/package.json"),
                },
                {
                  path: "tooling/workflow/tsconfig.json",
                  content: currentSource("tooling/workflow/tsconfig.json"),
                },
              ]
            : []),
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
            path: "apps/web/vite.config.ts",
            content: currentSource("apps/web/vite.config.ts"),
          },
          {
            path: "pnpm-workspace.yaml",
            content: currentSource("pnpm-workspace.yaml"),
          },
          {
            path: "packages/convex/package.json",
            content: customerConvexPackage(options),
          },
          {
            path: "packages/convex/src/refs.ts",
            content: currentSource("packages/convex/src/refs.ts"),
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
        : releasedSource("apps/cli/src/factory/customerComposition.ts"),
    },
    ...(current
      ? [
          {
            path: "apps/cli/src/factory/mcp.ts",
            content: currentSource("apps/cli/src/factory/mcp.ts"),
          },
        ]
      : []),
    ...(current
      ? [
          {
            path: "apps/cli/src/commands.ts",
            content: customerCliModuleSource(
              "apps/cli/src/commands.ts",
              options,
            ),
          },
          ...(!workflowSelected
            ? [
                {
                  path: "apps/cli/src/headlessRegistry.ts",
                  content: neutralHeadlessRegistrySource(),
                },
              ]
            : []),
        ]
      : []),
    {
      path: "apps/cli/src/index.ts",
      content: customerCliEntry(current, options),
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
      content: customerCliPackage(options),
    },
    ...(current
      ? [
          {
            path: "apps/cli/tsconfig.customer.json",
            content: customerCliTsconfig(),
          },
        ]
      : []),
    ...(current
      ? [
          {
            path: "apps/web/package.json",
            content: customerPackageWithoutOptionalPatterns(
              "apps/web/package.json",
              options,
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
    ...(current ? [{ path: ".npmrc", content: currentSource(".npmrc") }] : []),
    { path: ".prettierignore", content: currentSource(".prettierignore") },
    ...(current
      ? [
          {
            path: "tsconfig.json",
            content: customerRootTsconfig(workflowSelected),
          },
          ...CURRENT_CUSTOMER_PROJECT_TSCONFIGS.map((path) => ({
            path,
            content: currentSource(path),
          })),
        ]
      : []),
    { path: "package.json", content: customerPackage(current, options) },
    ...(current
      ? [{ path: "pnpm-lock.yaml", content: customerLockfile(options) }]
      : []),
    ...(current
      ? CURRENT_CUSTOMER_PATCHES.map((path) => ({
          path,
          content: currentSource(path),
        }))
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
            path: "tooling/convex-compat/package.json",
            content: customerConvexCompatPackage(),
          },
          {
            path: "tooling/convex-compat/tsconfig.customer.json",
            content: customerConvexCompatTsconfig(),
          },
          {
            path: "tooling/generators/tsconfig.customer.json",
            content: customerGeneratorTsconfig(),
          },
        ]
      : []),
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
          "tooling/quality/contract-review-rubric.md",
          "tooling/quality/taste-review.mts",
        ].map((path) => ({ path, content: currentSource(path) }))
      : []),
    {
      path: "tooling/quality/install-lefthook-if-git.mjs",
      content: source("tooling/quality/install-lefthook-if-git.mjs"),
    },
    ...(
      [
        ["customer.ts", "customer.ts"],
        ["customer-runtime.ts", "customer-runtime.ts"],
        ["customer-dispatcher.ts", "customer-dispatcher.ts"],
        ["shell-configuration.ts", "shell-configuration.ts"],
        ["screen-selection.ts", "screen-selection.ts"],
        ...(current
          ? ([["private-package.ts", "private-package.ts"]] as const)
          : []),
        ["customer-cli.ts", "customer-cli.ts"],
        ["crud-proof.ts", "crud-proof.ts"],
        ["direct-run.ts", "direct-run.ts"],
        ["feature-crud.ts", "feature-crud.ts"],
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
          : name === "customer-runtime.ts"
            ? customerRuntimeSource(current, options)
            : source(`tooling/generators/src/${name}`),
    })),
    ...[
      ...(workflowSelected
        ? [
            "tooling/generators/src/workflow-files.ts",
            "tooling/generators/src/workflow-predeploy.ts",
          ]
        : []),
      ...(current && workflowSelected
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
      "packages/convex/confect/_generated/tables/workspaces.ts",
      "packages/convex/confect/_generated/registeredFunctions/access/members.ts",
      "packages/convex/confect/_generated/registeredFunctions/auth/workspaces.ts",
      "packages/convex/confect/_generated/services.ts",
      "packages/convex/confect/access/members.spec.ts",
      "packages/convex/confect/access/members.impl.ts",
      "packages/convex/confect/access/audit.ts",
      "packages/convex/confect/access/email.ts",
      "packages/convex/confect/access/handlerContext.ts",
      "packages/convex/confect/access/lifecycle.ts",
      "packages/convex/confect/access/lifecycleInvitations.ts",
      "packages/convex/confect/access/provisioning.spec.ts",
      "packages/convex/confect/access/roles.ts",
      "packages/convex/confect/auth/workspaces.spec.ts",
      "packages/convex/confect/auth/workspaces.impl.ts",
      "packages/convex/confect/errors.ts",
      "packages/convex/confect/tables/workspaces.ts",
      "packages/convex/confect/_generated/refs.ts",
      "packages/convex/convex/_generated/api.d.ts",
      "packages/convex/convex/_generated/api.js",
      "packages/convex/convex/access/members.ts",
      "packages/convex/convex/auth/workspaces.ts",
      ...(workflowSelected
        ? ["packages/convex/confect/_generated/tables/workflowArtifacts.ts"]
        : []),
      ...(!current
        ? ["packages/convex/confect/ops/dataResources.generated.ts"]
        : []),
      ...(current
        ? CURRENT_EMAIL_CLOSURE.filter(
            (path) => workflowSelected || !path.startsWith("tooling/workflow/"),
          )
        : []),
      ...(current ? CURRENT_HEADLESS_CONTRACT_SOURCE_CLOSURE : []),
      ...(current ? CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE : []),
      ...(current ? CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE : []),
      ...(workflowSelected
        ? [
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
          ]
        : []),
    ].map((path) => ({
      path,
      content:
        path === "packages/convex/confect/_generated/docs.ts"
          ? current
            ? confectDocs(recordsSelected, workflowSelected)
            : source(path)
          : path.endsWith("Current.ts") ||
              path.endsWith("workflowSchedule.ts") ||
              path.endsWith("workflowScheduledCapability.ts")
            ? currentSource(path)
            : path === "packages/convex/convex/_generated/api.d.ts" && current
              ? customerConvexApi(workflowSelected)
              : path === "packages/convex/convex/convex.config.ts" && current
                ? customerConvexConfig(workflowSelected)
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
    ...(recordsSelected
      ? [
          {
            path: "packages/convex/confect/_generated/tables/records.ts",
            content:
              'import unnamed from "../../tables/records";\n\nexport default unnamed("records");\n',
          },
        ]
      : []),
    {
      path: "packages/convex/confect/_generated/schema.ts",
      content: databaseSchema(recordsSelected, workflowSelected),
    },
    {
      path: "packages/convex/confect/_generated/convexSchema.ts",
      content: convexSchema(recordsSelected, workflowSelected),
    },
    {
      path: "packages/convex/confect/_generated/spec.ts",
      content: confectSpec(current, recordsSelected, workflowSelected),
    },
    ...(current
      ? [
          {
            path: "packages/convex/confect/_generated/components.ts",
            content: customerConfectComponents(workflowSelected),
          },
        ]
      : []),
    {
      path: "packages/convex/confect/_generated/id.ts",
      content: confectIds(recordsSelected, workflowSelected),
    },
    ...(recordsSelected
      ? [
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
        ]
      : []),
    ...(!current
      ? [
          {
            path: "apps/web/src/routeTree.gen.ts",
            content: routeTree(recordsSelected),
          },
        ]
      : []),
    ...(!current && recordsSelected
      ? [
          {
            path: "apps/web/src/routeRegistry.generated.ts",
            content:
              'export const saasApplicationRoutes = { records: "/records" } as const;\n',
          },
        ]
      : []),
  ];
};
