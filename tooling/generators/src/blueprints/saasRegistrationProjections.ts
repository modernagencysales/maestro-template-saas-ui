import { readFileSync } from "node:fs";
import type { GeneratedFile } from "../index";

const asset = (path: string): string =>
  readFileSync(
    new URL(
      `../../../../releases/v0.2.0-alpha.1/blueprints/saas-application/base/${path}`,
      import.meta.url,
    ),
    "utf8",
  );

const source = (path: string): string =>
  readFileSync(
    new URL(
      `../../../../releases/v0.2.0-alpha.1/blueprints/saas-application/base/${path}.txt`,
      import.meta.url,
    ),
    "utf8",
  );

const generatorSource = (name: string): string =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

export const REMOVED_CUSTOMER_TEMPLATE_SCRIPTS = [
  "template:init",
  "template:quickstart",
  "template:intake",
  "template:seed-demo",
  "template:handoff",
  "template:prototype",
  "template:add-client-domain",
  "template:workflow-output-smoke",
  "template:upgrade",
  "template:private-package:dry-run",
  "template:private-package:import",
] as const;

const customerPackage = (): string => {
  const value = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
  };
  for (const name of REMOVED_CUSTOMER_TEMPLATE_SCRIPTS) delete value.scripts[name];
  for (const name of Object.keys(value.scripts)) {
    if (name.startsWith("template:")) {
      value.scripts[name] = value.scripts[name]!.replace(
        "tooling/generators/src/index.ts",
        "tooling/generators/src/customer-cli.ts",
      );
    }
  }
  value.scripts["template:smoke"] = "tsx tooling/generators/src/customer-cli.ts smoke";
  return `${JSON.stringify(value, null, 2)}\n`;
};

const customerContextSource = (path: string): string => {
  const content = source(`customer-context/${path}`);
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
    'import promptRegistry from "./tables/promptRegistry";\nimport records from "./tables/records";\nimport workflowArtifacts from "./tables/workflowArtifacts";',
  );
  value = replace(
    value,
    "  typeof promptRegistry |",
    "  typeof promptRegistry |\n  typeof records |\n  typeof workflowArtifacts |",
  );
  return replace(
    value,
    "  promptRegistry,",
    "  promptRegistry,\n  records,\n  workflowArtifacts,",
  );
};

const convexSchema = (): string => {
  let value = source("packages/convex/confect/_generated/convexSchema.ts");
  value = replace(
    value,
    'import promptRegistry from "./tables/promptRegistry";',
    'import promptRegistry from "./tables/promptRegistry";\nimport records from "./tables/records";\nimport workflowArtifacts from "./tables/workflowArtifacts";',
  );
  return replace(
    value,
    "  promptRegistry: promptRegistry.tableDefinition,",
    "  promptRegistry: promptRegistry.tableDefinition,\n  records: records.tableDefinition,\n  workflowArtifacts: workflowArtifacts.tableDefinition,",
  );
};

const confectSpec = (): string => {
  let value = source("packages/convex/confect/_generated/spec.ts");
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
    "import { Route as rootRouteImport } from './routes/__root'",
    "import { Route as rootRouteImport } from './routes/__root'\nimport { saasApplicationRoutes } from './routeRegistry.generated'",
  );
  value = replace(
    value,
    "import { Route as WorkspaceRunsRouteImport } from './routes/_workspace.runs'",
    "import { Route as WorkspaceRunsRouteImport } from './routes/_workspace.runs'\nimport { Route as WorkspaceRecordsRouteImport } from './routes/_workspace.records'",
  );
  value = replace(
    value,
    "const WorkspaceRunsRoute = WorkspaceRunsRouteImport.update({\n  id: '/_workspace/runs',\n  path: '/runs',\n  getParentRoute: () => rootRouteImport,\n} as any)",
    "const WorkspaceRunsRoute = WorkspaceRunsRouteImport.update({\n  id: '/_workspace/runs',\n  path: '/runs',\n  getParentRoute: () => rootRouteImport,\n} as any)\nconst WorkspaceRecordsRoute = WorkspaceRecordsRouteImport.update({\n  id: '/_workspace/records',\n  path: saasApplicationRoutes.records,\n  getParentRoute: () => rootRouteImport,\n} as any)",
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
    "    '/_workspace/runs': {",
    "    '/_workspace/records': {\n      id: '/_workspace/records'\n      path: '/records'\n      fullPath: '/records'\n      preLoaderRoute: typeof WorkspaceRecordsRouteImport\n      parentRoute: typeof rootRouteImport\n    }\n    '/_workspace/runs': {",
  );
  return replace(
    value,
    "  WorkspaceRunsRoute: WorkspaceRunsRoute,",
    "  WorkspaceRecordsRoute: WorkspaceRecordsRoute,\n  WorkspaceRunsRoute: WorkspaceRunsRoute,",
  );
};

export const buildSaasRegistrationProjections =
  (): readonly GeneratedFile[] => [
    {
      path: "apps/cli/src/factory/customerComposition.ts",
      content: source("apps/cli/src/factory/customerComposition.ts"),
    },
    {
      path: "apps/cli/src/index.ts",
      content: source("apps/cli/src/index.ts"),
    },
    {
      path: "apps/cli/src/factory/start.ts",
      content: source("apps/cli/src/factory/start.ts"),
    },
    { path: "package.json", content: customerPackage() },
    {
      path: "tooling/quality/install-lefthook-if-git.mjs",
      content: source("tooling/quality/install-lefthook-if-git.mjs"),
    },
    ...([
      ["customer.ts", "customer.ts"],
      ["customer-runtime.ts", "customer-runtime.ts"],
      ["customer-dispatcher.ts", "customer-dispatcher.ts"],
      ["customer-cli.ts", "customer-cli.ts"],
      ["direct-run.ts", "direct-run.ts"],
      ["workflow-release-commands.ts", "workflow-release-commands.ts"],
      ["blueprints/gtmImplementation.ts", "blueprints/gtmImplementation.ts"],
    ] as const).map(([path, name]) => ({
      path: `tooling/generators/src/${path}`,
      content: generatorSource(name),
    })),
    ...[
      "tooling/generators/src/workflow-files.ts",
      "tooling/generators/src/workflow-predeploy.ts",
      "packages/convex/confect/capabilities/_kit/workspaceAccess.ts",
      "packages/convex/confect/_generated/docs.ts",
      "packages/convex/confect/_generated/tables/workflowArtifacts.ts",
      "packages/convex/confect/ops/dataResources.generated.ts",
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
    ].map((path) => ({ path, content: source(path) })),
    ...[
      "start.ts",
      "ports.ts",
      "verify.ts",
      "receiptWriter.ts",
      "index.ts",
      "readiness/artifacts.ts",
      "readiness/index.ts",
      "readiness/nodeSurface.ts",
      "readiness/presenter.ts",
      "readiness/server.ts",
    ].map((path) => ({
      path: `tooling/agent-pack/src/${path}`,
      content: source(`tooling/agent-pack/src/${path}`),
    })),
    {
      path: "tooling/quality/check-agent-pack.mts",
      content: source("tooling/quality/check-agent-pack.mts"),
    },
    {
      path: "tooling/quality/check-customer-context.mts",
      content: source("tooling/quality/check-customer-context.mts"),
    },
    {
      path: "tooling/quality/check-convex-ai-files.mts",
      content: source("tooling/quality/check-convex-ai-files.mts"),
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
        'import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";\nimport databaseSchema from "../schema";\nimport records from "../../records/records.impl";\n\nexport default RegisteredFunctions.buildForGroup<typeof import("../../records/records.spec")["default"]>(databaseSchema, records, RegisteredConvexFunction.make);\n',
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
