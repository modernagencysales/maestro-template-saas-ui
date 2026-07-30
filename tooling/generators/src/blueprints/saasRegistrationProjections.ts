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
  "template:private-package:dry-run",
  "template:private-package:import",
] as const;
export const CURRENT_GENERATOR_GATE_SCRIPTS = [
  "template:quickstart",
  "template:seed-demo",
  "template:handoff",
  "template:add-client-domain",
  "template:prototype",
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
  "check:confect-v9",
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
    "vitest run --coverage --maxWorkers=1 --no-file-parallelism packages/template-core packages/integrations packages/search packages/storage packages/notifications packages/observability packages/convex tooling/quality tooling/workflow tooling/generators apps/cli apps/web && tsx tooling/quality/check-coverage-ratchet.mts";
  value.scripts["coverage:update-baseline"] =
    "vitest run --coverage packages/template-core packages/integrations packages/search packages/storage packages/notifications packages/observability packages/convex tooling/quality tooling/workflow tooling/generators apps/cli apps/web && tsx tooling/quality/check-coverage-ratchet.mts --update";
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
    "check:confect-v9",
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
  value.main = "src/customer.ts";
  value.types = "src/customer.ts";
  value.exports = { ".": "./src/customer.ts" };
  const scripts = value.scripts as Record<string, string>;
  scripts.cli = "tsx src/customer-cli.ts";
  const dependencies = value.dependencies as Record<string, string>;
  delete dependencies["@maestro-template/release-tooling"];
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

const customerLockfile = (): string => {
  let value = source("pnpm-lock.yaml");
  for (const block of [
    '      "@maestro-template/release-tooling":\n        specifier: workspace:*\n        version: link:../../tooling/release\n',
    '      "@maestro-template/stack-tooling":\n        specifier: workspace:*\n        version: link:../../tooling/stack\n',
    '      "@maestro-template/release-tooling":\n        specifier: workspace:*\n        version: link:../release\n',
  ]) {
    value = replace(value, block, "");
  }
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
  value = replace(
    value,
    '  const normalized = normalizeCliArgv(argv);\n  if (normalized.length === 1 && normalized[0] === "mcp") {\n    await factoryCliComposition.mcp.serve(streams);\n    return;\n  }\n  const result = await runCliAsync(normalized, config, streams.cwd);',
    "  const result = await runCliAsync(argv, config, streams.cwd);",
  );
  return replace(
    value,
    '    process.stderr.write("MCP_SERVER_ERROR startup\\n");',
    '    process.stderr.write("CLI_STARTUP_ERROR\\n");',
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

const databaseSchema = (): string => {
  let value = source("packages/convex/confect/_generated/schema.ts");
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
  let value = source("packages/convex/confect/_generated/convexSchema.ts");
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

const confectSpec = (): string => {
  let value = source("packages/convex/confect/_generated/spec.ts");
  value = replace(
    value,
    'import ops_versioning from "../ops/versioning.spec";',
    'import ops_versioning from "../ops/versioning.spec";\nimport records from "../records.spec";',
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
};

const confectIds = (): string =>
  replace(
    source("packages/convex/confect/_generated/id.ts"),
    ' | "promptRegistry" | "transformBlocks"',
    ' | "promptRegistry" | "records" | "transformBlocks" | "workflowArtifacts"',
  );

const routeTree = (): string => {
  let value = source("apps/web/src/routeTree.gen.ts");
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
            path: "pnpm-workspace.yaml",
            content: currentSource("pnpm-workspace.yaml"),
          },
          {
            path: "pnpm-lock.yaml",
            content: customerLockfile(),
          },
        ]
      : []),
    {
      path: "apps/cli/src/factory/customerComposition.ts",
      content: current
        ? currentSource("apps/cli/src/factory/customerComposition.ts")
        : source("apps/cli/src/factory/customerComposition.ts"),
    },
    {
      path: "apps/cli/src/index.ts",
      content: customerCliEntry(),
    },
    {
      path: "apps/cli/package.json",
      content: customerCliPackage(),
    },
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
    {
      path: "tooling/confect-manifest/tsconfig.json",
      content: currentSource("tooling/confect-manifest/tsconfig.json"),
    },
    {
      path: "tooling/generators/package.json",
      content: customerGeneratorPackage(),
    },
    {
      path: "tooling/quality/install-lefthook-if-git.mjs",
      content: `/* global process */\n\n${source("tooling/quality/install-lefthook-if-git.mjs")}`,
    },
    ...(
      [
        ["customer.ts", "customer.ts"],
        ["customer-runtime.ts", "customer-runtime.ts"],
        ["customer-dispatcher.ts", "customer-dispatcher.ts"],
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
        path.endsWith("Current.ts") ||
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
      content: confectSpec(),
    },
    { path: "packages/convex/confect/_generated/id.ts", content: confectIds() },
    {
      path: "packages/convex/confect/_generated/registeredFunctions/records.ts",
      content:
        'import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";\nimport databaseSchema from "../schema";\nimport records from "../../records.impl";\n\nexport default RegisteredFunctions.buildForGroup<typeof import("../../records.spec")["default"]>(databaseSchema, records, RegisteredConvexFunction.make);\n',
    },
    {
      path: "packages/convex/convex/records.ts",
      content:
        'import registeredFunctions from "../confect/_generated/registeredFunctions/records";\n\nexport const list = registeredFunctions.list;\nexport const read = registeredFunctions.read;\nexport const create = registeredFunctions.create;\n',
    },
    { path: "apps/web/src/routeTree.gen.ts", content: routeTree() },
    {
      path: "apps/web/src/routeRegistry.generated.ts",
      content:
        'export const saasApplicationRoutes = { records: "/records" } as const;\n',
    },
  ];
};
