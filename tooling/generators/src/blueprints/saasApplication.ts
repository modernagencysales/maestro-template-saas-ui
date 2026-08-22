import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  parseDataResourceCatalog,
  renderDataResourceRuntime,
} from "@maestro-template/template-core/dataResourceCatalog";
import { parseProductTopology } from "@maestro-template/template-core/productTopology";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";
import type { GeneratedFile, TemplateBlueprint } from "../index";
import {
  buildAlpha1SaasApplicationFiles,
  buildFactorySaasApplicationFiles,
} from "./saasApplicationFactory";
import {
  CURRENT_EMAIL_BASE_COPY_REPLACEMENTS,
  CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE,
  CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE,
} from "./saasRegistrationProjections";
import {
  selectsSaasApplicationPattern,
  type SaasApplicationPatternId,
  type SaasApplicationPatternSelection,
} from "./saasApplicationPatterns";

export const saasApplicationBlueprint = {
  id: "saas-application",
  label: "SaaS Application",
  summary:
    "A neutral workspace-safe SaaS application chassis with explicit optional product patterns and no required automation or live provider.",
  domainNouns: ["workspace", "member"],
  sourceTypes: [],
  defaultCapability: null,
  defaultWorkflow: null,
  defaultAgent: null,
  providerPosture: "fake-first",
  surfaces: ["web", "api", "cli"],
  entity: null,
  mandatorySystems: [
    "workspace tenancy",
    "deployment authority",
    "headless registry",
  ],
  automation: {
    status: "unavailable",
    reason:
      "No automation is generated unless the workflow semantic ledger supports every exact primitive.",
  },
} as const satisfies TemplateBlueprint & {
  readonly entity: null;
  readonly mandatorySystems: readonly [
    "workspace tenancy",
    "deployment authority",
    "headless registry",
  ];
  readonly automation: {
    readonly status: "unavailable";
    readonly reason: string;
  };
};

const jsonFile = (path: string, value: unknown): GeneratedFile => ({
  path,
  content: `${JSON.stringify(value, null, 2)}\n`,
});

const executableSourcePaths = [
  "packages/convex/confect/tables/records.ts",
  "packages/convex/confect/records.spec.ts",
  "packages/convex/confect/records.impl.ts",
  "apps/web/src/adapters/records/contract.ts",
  "apps/web/src/adapters/records/fake.ts",
  "apps/web/src/features/records/model.ts",
  "apps/web/src/features/records/records-surface.tsx",
  "apps/web/src/screens/records-screen.tsx",
  "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
] as const;

const executableSourceFiles = (): readonly GeneratedFile[] =>
  executableSourcePaths.map((path) => ({
    path,
    content: readFileSync(
      new URL(
        `../../../../examples/saas-application/seed/source/${path}`,
        import.meta.url,
      ),
      "utf8",
    ),
  }));

const repositoryJson = (path: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8"),
  ) as unknown;

const releasedBlueprintJson = (path: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../../releases/v0.2.0-alpha.2/blueprints/saas-application/base/${path}.txt`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as unknown;

const governanceFiles = (
  selection: SaasApplicationPatternSelection,
): readonly GeneratedFile[] => {
  const recordsSelected = selectsSaasApplicationPattern(
    selection,
    "records-example",
  );
  const workflowSelected = selectsSaasApplicationPattern(
    selection,
    "workflow-automation",
  );
  const systems = parseSystemCatalog(
    repositoryJson("docs/template/system-catalog.json"),
  );
  const dataResources = parseDataResourceCatalog(
    repositoryJson("docs/template/data-resources.json"),
  );
  const topology = parseProductTopology(
    repositoryJson("docs/template/product-topology.json"),
  );
  const releasedSystems = parseSystemCatalog(
    releasedBlueprintJson("docs/template/system-catalog.json"),
  );
  const releasedDataResources = parseDataResourceCatalog(
    releasedBlueprintJson("docs/template/data-resources.json"),
  );
  const releasedTopology = parseProductTopology(
    releasedBlueprintJson("docs/template/product-topology.json"),
  );
  const canonicalRouteSystemIds = new Set(
    topology.resources
      .filter(({ kind }) => kind === "route")
      .map(({ system }) => system),
  );
  const retainedSystemIds = new Set(
    releasedSystems.systems
      .filter(
        ({ id }) =>
          workflowSelected ||
          id !== "workflow-runtime" ||
          canonicalRouteSystemIds.has(id),
      )
      .map(({ id }) => id),
  );
  const retainedEmailTableIds = [
    "emailCampaigns",
    "emailDeliveries",
    "emailEvents",
    "emailSubscribers",
    "emailSuppressions",
  ] as const;
  const retainedTableIds = new Set([
    ...releasedSystems.systems
      .filter(({ id }) => workflowSelected || id !== "workflow-runtime")
      .flatMap(({ tables }) => tables),
    "deployAuthorityAuditEvents",
    ...retainedEmailTableIds,
  ]);
  const retainedDataResourceIds = new Set([
    ...releasedDataResources.resources
      .filter(({ system }) => workflowSelected || system !== "workflow-runtime")
      .map(({ id }) => id),
    "deployAuthorityAuditEvents",
    ...retainedEmailTableIds,
  ]);
  const retainedTopologyIds = new Set(
    releasedTopology.resources.map(({ id }) => id),
  );
  const governedSystems = parseSystemCatalog({
    ...systems,
    systems: [
      ...systems.systems
        .filter(({ id }) => retainedSystemIds.has(id))
        .map((system) => ({
          ...system,
          tables: system.tables.filter((table) => retainedTableIds.has(table)),
        })),
      ...(recordsSelected
        ? [
            {
              id: "record-management",
              name: "Record Management",
              kind: "product-system",
              lifecycle: "active",
              implementationStatus: "real",
              summary:
                "Owns the renameable workspace-scoped record CRUD slice shipped by the SaaS application blueprint.",
              responsibilities: [
                "create workspace records",
                "list workspace records",
                "read workspace record details",
              ],
              aliases: ["business records", "crud", "records"],
              tables: ["records"],
              canonicalEntrypoints: [
                "packages/convex/confect/records.spec.ts",
                "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
              ],
              decisionRef:
                "docs/template/system-decisions/record-management.md",
            },
          ]
        : []),
    ],
  });
  const governedDataResources = parseDataResourceCatalog({
    ...dataResources,
    resources: [
      ...dataResources.resources.filter(({ id }) =>
        retainedDataResourceIds.has(id),
      ),
      ...(recordsSelected
        ? [
            {
              id: "records",
              system: "record-management",
              sourcePath: "packages/convex/confect/tables/records.ts",
              tenantScope: "workspace",
              sensitivity: "internal",
              pii: [],
              exportMode: "json",
              deleteMode: "delete",
              retention: "retain-until-workspace-delete",
              appendOnly: false,
              writePosture: "implemented",
              workspaceLifecycle: "managed",
              writeAuthority: "packages/convex/confect/records.spec.ts",
              migrationRef: "docs/template/schema-decisions/records.md",
              detail:
                "Records are workspace-owned application data exported as JSON and removed with the owning workspace.",
            },
          ]
        : []),
    ].sort((left, right) => left.id.localeCompare(right.id)),
  });
  const governedTopology = parseProductTopology({
    ...topology,
    resources: [
      ...topology.resources
        .filter(
          ({ id, system }) =>
            id.startsWith("route:") ||
            (retainedTopologyIds.has(id) &&
              (workflowSelected || system !== "workflow-runtime") &&
              (workflowSelected || !id.startsWith("workflow:"))),
        )
        .map((resource) =>
          workflowSelected
            ? resource
            : {
                ...resource,
                ...(resource.uses
                  ? {
                      uses: resource.uses.filter(
                        (system) => system !== "workflow-runtime",
                      ),
                    }
                  : {}),
              },
        ),
      ...(recordsSelected
        ? [
            {
              id: "route:$workspace/records",
              kind: "route",
              system: "record-management",
              path: "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
              responsibility:
                "present workspace record create, list, and detail states",
              surfaces: ["web"],
              uses: ["access-and-tenancy"],
              lifecycle: "active",
            },
            {
              id: "headless:records-api",
              kind: "headless",
              system: "record-management",
              path: "apps/web/src/adapters/records/http.ts",
              responsibility:
                "serve the generated Records HTTP/API boundary to headless callers",
              surfaces: ["api"],
              uses: ["access-and-tenancy"],
              lifecycle: "active",
            },
          ]
        : []),
    ],
  });
  return [
    jsonFile("docs/template/system-catalog.json", governedSystems),
    jsonFile("docs/template/data-resources.json", governedDataResources),
    jsonFile("docs/template/product-topology.json", governedTopology),
    {
      path: "packages/convex/confect/ops/dataResources.generated.ts",
      content: renderDataResourceRuntime(governedDataResources),
    },
    ...(recordsSelected
      ? [
          {
            path: "docs/template/system-decisions/record-management.md",
            content: `# Record Management System Decision

The SaaS application blueprint introduces \`record-management\` because no base
template system owns generic customer business records. The system owns one
workspace-scoped \`records\` table, its Confect CRUD contract, and the records
route. It reuses \`access-and-tenancy\` for workspace authorization.

Keep this system when the starter noun is renamed. Extend it for adjacent CRUD
behavior; introduce another system only when the new behavior has genuinely
independent authority and lifecycle.
`,
          },
          {
            path: "docs/template/schema-decisions/records.md",
            content: `# Records Schema Decision

Canonical system: \`record-management\`  
Disposition: \`introduce\`  
Status: additive

## Data Contract

- Tenant scope: \`workspace\`
- Sensitivity: \`internal\`
- PII categories: none
- Export: \`json\`
- Delete/redaction: \`delete\`
- Retention: \`retain-until-workspace-delete\`
- Append-only: \`false\`
- Write authority: \`packages/convex/confect/records.spec.ts\`

The table is new and requires no backfill. Rollback removes callers before the
table and preserves workspace isolation throughout the compatibility window.
`,
          },
        ]
      : []),
  ];
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "my-app";

export const buildSaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => {
  const name = options.name.trim() || "My App";
  const slug = slugify(name);
  const workspaceId = `workspace_${slug.replaceAll("-", "_")}`;
  const firstOutcome = (
    options.firstOutcome?.trim() || "Create and review records"
  ).replace(/\s+/gu, " ");
  const operations = [
    { id: "records.list", kind: "query", workspaceScoped: true },
    { id: "records.read", kind: "query", workspaceScoped: true },
    { id: "records.create", kind: "mutation", workspaceScoped: true },
  ] as const;

  return [
    jsonFile("examples/saas-application/seed/workspace.json", {
      id: workspaceId,
      slug,
      name: `${name} Workspace`,
      memberRole: "owner",
      synthetic: true,
    }),
    jsonFile("examples/saas-application/seed/records.json", [
      {
        id: "record_welcome",
        workspaceId,
        title: "Welcome record",
        detail: "A deterministic fake record that can be renamed or deleted.",
        synthetic: true,
      },
    ]),
    jsonFile("examples/saas-application/seed/source.json", {
      kind: "deterministic-fixture",
      owner: "saas-application",
      dataClassification: "public-synthetic",
      provider: "none",
      liveFallback: false,
    }),
    jsonFile("examples/saas-application/seed/crud-scenario.json", {
      workspaceId,
      initial: { records: [] },
      create: {
        title: "First record",
        detail: "Created in fake mode without provider setup.",
      },
      read: { by: "created-id", expectedTitle: "First record" },
    }),
    ...executableSourceFiles(),
    ...governanceFiles({
      patterns: ["records-example", "workflow-automation"],
    }),
    jsonFile(
      "generated/blueprints/saas-application/application-contract.json",
      {
        schemaVersion: 1,
        blueprint: "saas-application",
        entity: {
          singular: "record",
          renameable: true,
          tenantKey: "workspaceId",
        },
        primitive: "table-route-crud",
        workflowRequired: false,
        personalization: { name, firstOutcome },
        operations,
        uiStates: ["loading", "empty", "error", "list", "detail", "create"],
        layers: {
          table: "packages/convex/confect/tables/records.ts",
          functions: "packages/convex/confect/records.{spec,impl}.ts",
          adapter: "apps/web/src/adapters/records.ts",
          feature: "apps/web/src/features/records/*",
          screen: "apps/web/src/screens/records-screen.tsx",
          route: "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
        },
        governedOperation: {
          generated: false,
          rule: "Use a capability only when an operation requires policy, approval, audit, or another governed boundary.",
        },
      },
    ),
    jsonFile("generated/blueprints/saas-application/surface-contract.json", {
      schemaVersion: 1,
      web: { operations: operations.map(({ id }) => id) },
      headless: { operations: operations.map(({ id }) => id) },
      providers: {
        fake: {
          status: "fake",
          behavior: "in-memory workspace-scoped CRUD",
          firstCreateRead: true,
        },
        local: {
          status: "seam",
          behavior: "Confect refs over local Convex",
          placeholderSuccess: false,
        },
        live: {
          status: "unavailable",
          behavior: "requires explicit provider and deployment review",
          placeholderSuccess: false,
        },
      },
    }),
    jsonFile("generated/blueprints/saas-application/readiness.json", {
      schemaVersion: 1,
      surfaces: [
        { id: "workspace-membership", status: "real" },
        { id: "fake-record-crud", status: "fake" },
        { id: "local-convex-record-crud", status: "seam" },
        { id: "live-provider", status: "unavailable" },
      ],
      automation: saasApplicationBlueprint.automation,
      handoff:
        "Every non-real surface remains labeled until its adapter and focused evidence replace the seam.",
    }),
  ];
};

type CurrentSaasApplicationFileOptions = Readonly<{
  name: string;
  firstOutcome?: string;
}> &
  SaasApplicationPatternSelection;

export const buildCurrentSaasApplicationChassisFiles = (
  options: CurrentSaasApplicationFileOptions,
  // eslint-disable-next-line complexity -- AP-008 tracks splitting the two canonical pattern metadata branches.
): readonly GeneratedFile[] => {
  const name = options.name.trim() || "My App";
  const firstOutcome = (
    options.firstOutcome?.trim() || "Deliver the first customer outcome"
  ).replace(/\s+/gu, " ");
  const recordsSelected = selectsSaasApplicationPattern(
    options,
    "records-example",
  );
  const workflowSelected = selectsSaasApplicationPattern(
    options,
    "workflow-automation",
  );
  const operations = recordsSelected
    ? [
        { id: "records.list", kind: "query", workspaceScoped: true },
        { id: "records.read", kind: "query", workspaceScoped: true },
        { id: "records.create", kind: "mutation", workspaceScoped: true },
      ]
    : [];

  return [
    jsonFile("examples/saas-application/seed/source.json", {
      kind: "deterministic-fixture",
      owner: "saas-application",
      dataClassification: "public-synthetic",
      provider: "none",
      liveFallback: false,
    }),
    ...governanceFiles(options),
    jsonFile(
      "generated/blueprints/saas-application/application-contract.json",
      {
        schemaVersion: 1,
        blueprint: "saas-application",
        selectedPatterns: [...(options.patterns ?? [])].sort(),
        personalization: { name, firstOutcome },
        operations,
        workflowRequired: false,
        automation: workflowSelected
          ? { status: "selected" }
          : saasApplicationBlueprint.automation,
        ...(recordsSelected
          ? {
              entity: {
                singular: "record",
                renameable: true,
                tenantKey: "workspaceId",
              },
              primitive: "table-route-crud",
              uiStates: [
                "loading",
                "empty",
                "error",
                "list",
                "detail",
                "create",
              ],
            }
          : { entity: null, primitive: "product-chassis", uiStates: [] }),
      },
    ),
    jsonFile("generated/blueprints/saas-application/surface-contract.json", {
      schemaVersion: 1,
      web: { operations: operations.map(({ id }) => id) },
      headless: { operations: operations.map(({ id }) => id) },
      providers: {
        fake: {
          status: "fake",
          behavior: recordsSelected
            ? "in-memory workspace-scoped records CRUD"
            : "deterministic product chassis",
          firstCreateRead: recordsSelected,
        },
        local: {
          status: "seam",
          behavior: "Confect refs over local Convex",
          placeholderSuccess: false,
        },
        live: {
          status: "unavailable",
          behavior: "requires explicit provider and deployment review",
          placeholderSuccess: false,
        },
      },
    }),
    jsonFile("generated/blueprints/saas-application/readiness.json", {
      schemaVersion: 1,
      selectedPatterns: [...(options.patterns ?? [])].sort(),
      surfaces: [
        { id: "workspace-membership", status: "real" },
        ...(recordsSelected
          ? [
              { id: "fake-record-crud", status: "fake" },
              { id: "local-convex-record-crud", status: "seam" },
            ]
          : []),
        { id: "live-provider", status: "unavailable" },
      ],
      automation: workflowSelected
        ? { status: "selected" }
        : saasApplicationBlueprint.automation,
      handoff:
        "Every non-real surface remains labeled until its adapter and focused evidence replace the seam.",
    }),
  ];
};

export const buildCurrentRecordsExampleFiles = (options: {
  readonly name: string;
}): readonly GeneratedFile[] => {
  const name = options.name.trim() || "My App";
  const slug = slugify(name);
  const workspaceId = `workspace_${slug.replaceAll("-", "_")}`;
  return [
    jsonFile("examples/saas-application/seed/workspace.json", {
      id: workspaceId,
      slug,
      name: `${name} Workspace`,
      memberRole: "owner",
      synthetic: true,
    }),
    jsonFile("examples/saas-application/seed/records.json", [
      {
        id: "record_welcome",
        workspaceId,
        title: "Welcome record",
        detail: "A deterministic fake record that can be renamed or deleted.",
        synthetic: true,
      },
    ]),
    jsonFile("examples/saas-application/seed/crud-scenario.json", {
      workspaceId,
      initial: { records: [] },
      create: {
        title: "First record",
        detail: "Created in fake mode without provider setup.",
      },
      read: { by: "created-id", expectedTitle: "First record" },
    }),
    ...executableSourceFiles(),
  ];
};

export type BlueprintTargetPlan = {
  readonly schemaVersion: 1;
  readonly id: "saas-application";
  readonly provenance: "@maestro-template/generators/saas-application@1";
  readonly registrations: readonly string[];
  readonly parameterizedEntries: readonly string[];
  readonly entries: readonly ({
    readonly path: string;
    readonly sha256: string;
    readonly content: string;
    readonly replaces?: "copy" | "generate";
  } & (
    | {
        readonly ownership: "generated";
        readonly action: "generate";
        readonly upgrade: "regenerate";
      }
    | {
        readonly ownership: "customer-extension";
        readonly action: "copy";
        readonly upgrade: "preserve";
      }
  ))[];
  readonly digest: string;
};

type BlueprintTargetPlanOptions = {
  readonly name: string;
  readonly firstOutcome?: string;
  readonly patterns?: readonly SaasApplicationPatternId[];
  readonly sourceRoot?: string;
};

const canonicalTargetPlanOptions = {
  name: "SaaS Application",
  firstOutcome: "Deliver the first customer outcome",
  patterns: [],
} as const satisfies BlueprintTargetPlanOptions;

const historicalTargetPlanOptions = {
  name: "SaaS Application",
  firstOutcome: "Create and review records",
  patterns: [],
} as const satisfies BlueprintTargetPlanOptions;

export const SAAS_APPLICATION_PARAMETERIZED_ENTRIES = [
  "examples/saas-application/seed/crud-scenario.json",
  "examples/saas-application/seed/records.json",
  "examples/saas-application/seed/workspace.json",
  "product.contract.yaml",
  "docs/template/generated/product-contract.md",
  "generated/blueprints/saas-application/application-contract.json",
] as const;

const SAAS_APPLICATION_ALPHA2_BASE_WRITE_REPLACEMENTS = [
  ["apps/cli/tsconfig.json", "copy"],
  ["packages/convex/tsconfig.json", "copy"],
  ["packages/editor-core/tsconfig.json", "copy"],
  ["packages/editor-react/tsconfig.json", "copy"],
  ["packages/workflow-ui/tsconfig.json", "copy"],
  ["packages/template-core/tsconfig.json", "copy"],
  ["packages/integrations/tsconfig.json", "copy"],
  ["packages/notifications/tsconfig.json", "copy"],
  ["packages/storage/tsconfig.json", "copy"],
  ["packages/observability/tsconfig.json", "copy"],
  ["packages/search/tsconfig.json", "copy"],
  ["tooling/agent-pack/tsconfig.json", "copy"],
  ["tooling/quality/tsconfig.json", "copy"],
  ["tooling/generators/tsconfig.json", "copy"],
  [".claude/settings.json", "generate"],
  [".npmrc", "copy"],
  [".prettierignore", "copy"],
  ["apps/web/tsconfig.json", "copy"],
  ["tsconfig.base.json", "copy"],
  ["agent-patterns/effect-confect.md", "copy"],
  ["AGENTS.md", "copy"],
  ["README.md", "copy"],
  ["apps/cli/src/commands.ts", "copy"],
  ["docs/template/coding-standards.md", "copy"],
  ["eslint.config.mjs", "copy"],
  ["packages/convex/confect/headless/auth.ts", "copy"],
  ["tooling/quality/src/check-definitions.mts", "copy"],
  ["tooling/eslint-plugin-template/index.mjs", "copy"],
  ["packages/convex/confect/_generated/tables/workspaces.ts", "copy"],
  ["packages/convex/confect/_generated/refs.ts", "copy"],
  [
    "packages/convex/confect/_generated/registeredFunctions/access/members.ts",
    "copy",
  ],
  [
    "packages/convex/confect/_generated/registeredFunctions/auth/workspaces.ts",
    "copy",
  ],
  ["packages/convex/confect/_generated/services.ts", "copy"],
  ["packages/convex/confect/access/audit.ts", "copy"],
  ["packages/convex/confect/access/email.ts", "copy"],
  ["packages/convex/confect/access/handlerContext.ts", "copy"],
  ["packages/convex/confect/access/lifecycle.ts", "copy"],
  ["packages/convex/confect/access/lifecycleInvitations.ts", "copy"],
  ["packages/convex/confect/access/members.impl.ts", "copy"],
  ["packages/convex/confect/access/members.spec.ts", "copy"],
  ["packages/convex/confect/access/provisioning.spec.ts", "copy"],
  ["packages/convex/confect/access/roles.ts", "copy"],
  ["packages/convex/confect/auth/workspaces.spec.ts", "copy"],
  ["packages/convex/confect/auth/workspaces.impl.ts", "copy"],
  ["packages/convex/confect/errors.ts", "copy"],
  ["packages/convex/confect/tables/workspaces.ts", "copy"],
  ["packages/convex/convex/_generated/api.d.ts", "copy"],
  ["packages/convex/convex/_generated/api.js", "copy"],
  ["packages/convex/convex/access/members.ts", "copy"],
  ["packages/convex/convex/auth/workspaces.ts", "copy"],
  ["packages/convex/src/refs.ts", "copy"],
] as const;

const targetEntryIdentity = (
  entry: BlueprintTargetPlan["entries"][number],
) => ({
  path: entry.path,
  ownership: entry.ownership,
  action: entry.action,
  upgrade: entry.upgrade,
  sha256: entry.sha256,
  ...(entry.replaces === undefined ? {} : { replaces: entry.replaces }),
});

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export function buildSaasApplicationTargetPlan(
  options: BlueprintTargetPlanOptions,
): BlueprintTargetPlan;
export function buildSaasApplicationTargetPlan(): BlueprintTargetPlan;
export function buildSaasApplicationTargetPlan(
  options: BlueprintTargetPlanOptions = canonicalTargetPlanOptions,
): BlueprintTargetPlan {
  return buildTargetPlan(true, options);
}

export function buildSaasApplicationAlpha1TargetPlan(
  options: BlueprintTargetPlanOptions,
): BlueprintTargetPlan;
export function buildSaasApplicationAlpha1TargetPlan(): BlueprintTargetPlan;
export function buildSaasApplicationAlpha1TargetPlan(): BlueprintTargetPlan {
  return buildTargetPlan(false, historicalTargetPlanOptions);
}

// eslint-disable-next-line complexity -- AP-008 tracks extracting immutable/current entry metadata composition.
function buildTargetPlan(
  current: boolean,
  options: BlueprintTargetPlanOptions,
): BlueprintTargetPlan {
  const replacements = new Map<string, "copy" | "generate">([
    ...(current
      ? ([
          ...SAAS_APPLICATION_ALPHA2_BASE_WRITE_REPLACEMENTS,
          ...CURRENT_EMAIL_BASE_COPY_REPLACEMENTS.map(
            (path) => [path, "copy"] as const,
          ),
          ["tooling/acceptance/checkout-state.mts", "copy"],
          ["tooling/acceptance/product-contract.mts", "copy"],
          ["tooling/acceptance/run-acceptance.mts", "copy"],
          ["tooling/acceptance/playwright-report.mts", "copy"],
          ["docs/template/env-manifest.json", "copy"],
          ["docs/template/env-manifest.md", "copy"],
          ["docs/template/operations-runbook.md", "copy"],
          ["lefthook.yml", "copy"],
          [
            "packages/template-core/src/templateInstance/templateInstance.test.ts",
            "copy",
          ],
          ["packages/template-core/src/generated/confectManifest.ts", "copy"],
          ["packages/convex/test/shared-env.test.ts", "copy"],
          ["tooling/agent-pack/package.json", "copy"],
          ["tooling/agent-pack/src/nodeAdapters.test.ts", "copy"],
          ["tooling/app-map/src/composition.test.ts", "copy"],
          ["tooling/app-map/src/composition.ts", "copy"],
          ["tooling/app-map/src/schema.ts", "copy"],
          ["tooling/app-map/src/build.ts", "copy"],
          ["tooling/app-map/src/gitDiff.ts", "copy"],
          ["tooling/app-map/src/validate.ts", "copy"],
          ["tooling/app-map/package.json", "copy"],
          ["packages/template-core/src/dataResourceCatalog.ts", "copy"],
          ["packages/template-core/src/productTopology.ts", "copy"],
          ["packages/template-core/src/systemCatalog.ts", "copy"],
          ["packages/template-core/src/templateInstance/index.ts", "copy"],
          ["docs/template/generated/workflow-semantics.md", "copy"],
          ["eslint.config.mjs", "copy"],
          ["tooling/eslint-plugin-template/index.mjs", "copy"],
          [
            "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
            "copy",
          ],
          ["tooling/generators/src/crud-proof.test.ts", "copy"],
          ["tooling/quality/package.json", "copy"],
          ["tooling/quality/src/env-manifest.test.mts", "copy"],
          ["tooling/quality/contract-review-rubric.md", "copy"],
          ["tooling/quality/taste-review.mts", "copy"],
        ] as const)
      : []),
    ...(current
      ? ([
          ["docs/template/data-resources.json", "copy"],
          ["docs/template/system-catalog.json", "copy"],
        ] as const)
      : []),
    ["apps/cli/src/index.ts", "copy"],
    ["apps/cli/package.json", "copy"],
    ["apps/cli/src/factory/customerComposition.ts", "copy"],
    ["apps/cli/src/factory/start.ts", "copy"],
    ["apps/cli/src/factory/customerRecipes.ts", "copy"],
    ["apps/cli/src/factory/recipes.ts", "copy"],
    ["apps/cli/src/factory/supportBundle.ts", "copy"],
    ["apps/web/package.json", "copy"],
    ["apps/web/src/server.ts", "copy"],
    ["apps/web/vite.config.ts", "copy"],
    ["docs/template/agent-pack-privacy.md", "copy"],
    ["docs/template/preflight.md", "copy"],
    ["docs/template/agent-worker-playbook.md", "copy"],
    ["docs/template/how-this-relates-to-maestro.md", "copy"],
    ["docs/template/repo-map.md", "copy"],
    ["docs/template/template-maturity-model.md", "copy"],
    ["tsconfig.json", "generate"],
    ["package.json", "generate"],
    ["pnpm-workspace.yaml", "copy"],
    ["pnpm-lock.yaml", "copy"],
    ["packages/convex/package.json", "copy"],
    ["tooling/confect-manifest/tsconfig.json", "copy"],
    ["packages/convex/confect/_generated/tables/workflowArtifacts.ts", "copy"],
    ["packages/convex/confect/tables/workflowArtifacts.ts", "copy"],
    [
      "packages/convex/confect/_generated/tables/deployAuthorityIssuers.ts",
      "copy",
    ],
    ["packages/convex/confect/deploy/authority.impl.ts", "copy"],
    ["packages/convex/confect/deploy/authority.spec.ts", "copy"],
    ["packages/convex/confect/deploy/authority.ts", "copy"],
    ["packages/convex/confect/deployAuthority/http.ts", "copy"],
    ["packages/convex/confect/deployAuthority/store.ts", "copy"],
    ["packages/convex/confect/http.ts", "copy"],
    ["packages/convex/confect/shared/env.ts", "copy"],
    ["packages/convex/confect/tables/deployActionConsumptions.ts", "copy"],
    ["packages/convex/confect/tables/deployApprovals.ts", "copy"],
    ["packages/convex/confect/tables/deployAuthorityIssuers.ts", "copy"],
    ["packages/convex/confect/tables/deployCensusSnapshots.ts", "copy"],
    ["packages/convex/confect/tables/deployVerdicts.ts", "copy"],
    ["packages/convex/convex/convex.config.ts", "copy"],
    ["packages/convex/convex/deploy/authority.ts", "copy"],
    ["packages/convex/test/deploy-authority.test.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/lifecycleSweep.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/payloadBudget.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/workflowArtifacts.ts", "copy"],
    ["packages/convex/confect/workflows/lifecycleInspection.ts", "copy"],
    ["packages/convex/confect/workflows/lifecycleReconciliation.ts", "copy"],
    ["tooling/agent-pack/src/privacy/nodeSupportBundleExporter.ts", "copy"],
    ["tooling/agent-pack/src/privacy/support-bundle.schema.json", "copy"],
    ["tooling/agent-pack/src/privacy/supportBundle.ts", "copy"],
    ["tooling/agent-pack/src/privacy/supportBundleCommand.ts", "copy"],
    ["tooling/agent-pack/src/readiness/artifacts.ts", "copy"],
    ["tooling/agent-pack/src/readiness/index.ts", "copy"],
    ["tooling/agent-pack/src/readiness/nodeSurface.ts", "copy"],
    ["tooling/agent-pack/src/readiness/presenter.ts", "copy"],
    ["tooling/agent-pack/src/readiness/server.ts", "copy"],
    ["tooling/agent-pack/src/receiptWriter.ts", "copy"],
    ["tooling/agent-pack/src/recipes.ts", "copy"],
    ["tooling/agent-pack/src/recipeTransaction.ts", "copy"],
    ["tooling/generators/src/crud-proof.ts", "copy"],
    ["tooling/generators/src/customer-cli.ts", "copy"],
    ["tooling/generators/src/customer-dispatcher.ts", "copy"],
    ["tooling/generators/src/customer-runtime.ts", "copy"],
    ["tooling/generators/src/customer.ts", "copy"],
    ["tooling/generators/src/workflow-files.ts", "copy"],
    ["tooling/generators/src/workflow-release-commands.ts", "copy"],
    ["tooling/generators/src/workflow-source-closure.ts", "copy"],
    ["tooling/quality/check-workflow-policy-snapshots.mts", "copy"],
    ["tooling/quality/check-workflow-principal-propagation.mts", "copy"],
    ["tooling/quality/fixtures/workflow-policy-snapshots.json", "copy"],
    ["tooling/generators/package.json", "copy"],
    ["examples/generic-ai-ops/template-package.json", "copy"],
    ["tooling/generators/src/direct-run.ts", "copy"],
    ["tooling/generators/src/blueprints/gtmImplementation.ts", "copy"],
    ["packages/convex/confect/_generated/schema.ts", "copy"],
    ["packages/convex/confect/_generated/convexSchema.ts", "copy"],
    ["packages/convex/confect/_generated/spec.ts", "copy"],
    ["packages/convex/confect/_generated/id.ts", "copy"],
    ["apps/web/src/routeTree.gen.ts", "generate"],
    ["tooling/agent-pack/src/start.ts", "copy"],
    ["tooling/agent-pack/src/ports.ts", "copy"],
    ["tooling/agent-pack/src/verify.ts", "copy"],
    ["tooling/agent-pack/src/index.ts", "copy"],
    ["tooling/quality/check-agent-pack.mts", "copy"],
    ["tooling/quality/check-convex-ai-files.mts", "copy"],
    ["tooling/generators/src/workflow-predeploy.ts", "copy"],
    ["packages/convex/confect/_generated/docs.ts", "copy"],
    ["packages/convex/confect/ops/dataResources.generated.ts", "copy"],
    ["docs/template/system-catalog.json", "copy"],
    ["docs/template/data-resources.json", "copy"],
    ["docs/template/product-topology.json", "copy"],
    ["packages/convex/confect/tables/workflowRuns.ts", "copy"],
    ["packages/convex/confect/tables/workflowStageRuns.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/defineMaestroWorkflow.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/graphRunnerV2Current.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/observedStageCurrent.ts", "copy"],
    [
      "packages/convex/confect/workflows/_kit/observedStagePayloadCurrent.ts",
      "copy",
    ],
    [
      "packages/convex/confect/workflows/_kit/workflowBuilderCurrent.ts",
      "copy",
    ],
    ["packages/convex/confect/workflows/_kit/workflowSchedule.ts", "copy"],
    [
      "packages/convex/confect/workflows/_kit/workflowScheduledCapability.ts",
      "copy",
    ],
    ["packages/convex/confect/workflows/graphCurrent.ts", "copy"],
    ["packages/convex/confect/workflows/graphNodeSchemaCurrent.ts", "copy"],
    ["packages/convex/confect/workflows/graphSchemaCurrent.ts", "copy"],
    ["packages/convex/confect/workflows/graphValidationCurrent.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/graphRunnerExecution.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/graphRunnerNodes.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/graphRunnerV2.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/lifecycle.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/lifecycleControls.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/lifecycleSafety.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/lifecycleState.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/observedStage.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/observedStagePayload.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/policySnapshot.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/principal.ts", "copy"],
    ["packages/convex/confect/workflows/_kit/subworkflows.ts", "copy"],
    ["packages/convex/confect/workflows/lifecycleAdapters.ts", "copy"],
    ["packages/convex/confect/workflows/lifecycle.impl.ts", "copy"],
    ["packages/convex/confect/workflows/lifecyclePersistence.ts", "copy"],
    ["packages/convex/confect/workflows/lifecycle.spec.ts", "copy"],
    ["packages/convex/confect/capabilities/_kit/workspaceAccess.ts", "copy"],
    ["packages/convex/test/workflow-lifecycle-controls.fixture.ts", "copy"],
    ["packages/convex/test/workflow-lifecycle-registration.test.ts", "copy"],
  ]);
  const customerExtensions = new Set(["CLAUDE.md"]);
  const files = current
    ? buildFactorySaasApplicationFiles(options)
    : buildAlpha1SaasApplicationFiles(options);
  const entries = files
    .filter(({ path }) => path !== "template-instance.json")
    .map(({ path, content }) => {
      const replacement = replacements.get(path);
      return customerExtensions.has(path)
        ? {
            path,
            ownership: "customer-extension" as const,
            action: "copy" as const,
            upgrade: "preserve" as const,
            sha256: sha256(content),
            content,
          }
        : {
            path,
            ownership: "generated" as const,
            action: "generate" as const,
            upgrade: "regenerate" as const,
            sha256: sha256(content),
            content,
            ...(replacement === undefined ? {} : { replaces: replacement }),
          };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const registrationsWithPrivacy = [
    "README.md",
    "AGENTS.md",
    "agent-patterns/effect-confect.md",
    "docs/template/agent-pack-privacy.md",
    ...(current ? ["apps/web/package.json"] : []),
    ...(current
      ? [
          "docs/template/env-manifest.json",
          "docs/template/env-manifest.md",
          "docs/template/operations-runbook.md",
          "packages/template-core/src/templateInstance/templateInstance.test.ts",
          "packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json",
          "packages/template-core/src/generated/confectManifest.ts",
          "packages/convex/test/shared-env.test.ts",
          "tooling/app-map/src/composition.test.ts",
          "tooling/app-map/src/composition.ts",
          "tooling/app-map/src/schema.ts",
          "tooling/app-map/src/build.ts",
          "tooling/app-map/src/gitDiff.ts",
          "tooling/app-map/src/validate.ts",
          "packages/template-core/src/dataResourceCatalog.ts",
          "packages/template-core/src/productTopology.ts",
          "packages/template-core/src/systemCatalog.ts",
          "packages/template-core/src/productContract.ts",
          "packages/template-core/src/workPackage.ts",
          "packages/template-core/src/productPlan.ts",
          "packages/template-core/src/templateInstance/index.ts",
          "docs/template/generated/workflow-semantics.md",
          "eslint.config.mjs",
          "tooling/eslint-plugin-template/index.mjs",
          "tooling/eslint-plugin-template/rules/acceptance-boundary.mjs",
          "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
          "tooling/generators/src/crud-proof.test.ts",
          "tooling/quality/src/env-manifest.test.mts",
          "docs/template/generated/provenance/add-feature/records.json",
        ]
      : []),
    ...(current ? ["tooling/agent-pack/package.json"] : []),
    "apps/cli/src/factory/customerComposition.ts",
    ...(current ? ["apps/cli/src/factory/mcp.ts"] : []),
    "apps/cli/src/index.ts",
    "apps/cli/package.json",
    "apps/cli/src/factory/start.ts",
    "apps/cli/src/factory/customerRecipes.ts",
    "apps/cli/src/factory/recipeCatalog.ts",
    "apps/cli/src/factory/recipes.ts",
    "apps/cli/src/factory/supportBundle.ts",
    "package.json",
    ...(current ? ["pnpm-lock.yaml"] : []),
    "tooling/generators/src/crud-proof.ts",
    ...(current ? ["tooling/quality/package.json"] : []),
    ...(current
      ? [
          "tooling/generators/src/private-package.ts",
          "examples/generic-ai-ops/template-package.json",
          "lefthook.yml",
          "tooling/quality/contract-review-rubric.md",
          "tooling/quality/taste-review.mts",
        ]
      : []),
    "tooling/quality/install-lefthook-if-git.mjs",
    "tooling/generators/src/workflow-files.ts",
    "tooling/generators/src/workflow-predeploy.ts",
    "packages/convex/confect/capabilities/_kit/workspaceAccess.ts",
    "packages/convex/confect/_generated/docs.ts",
    "packages/convex/confect/_generated/tables/workflowArtifacts.ts",
    ...(current ? CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE : []),
    ...(current ? CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE : []),
    "packages/convex/confect/ops/dataResources.generated.ts",
    "docs/template/system-catalog.json",
    "docs/template/data-resources.json",
    "docs/template/product-topology.json",
    "docs/template/system-decisions/record-management.md",
    "docs/template/schema-decisions/records.md",
    "packages/convex/confect/tables/workflowArtifacts.ts",
    "packages/convex/confect/tables/workflowRuns.ts",
    "packages/convex/confect/tables/workflowStageRuns.ts",
    "packages/convex/confect/workflows/_kit/defineMaestroWorkflow.ts",
    ...(current
      ? [
          "packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts",
          "packages/convex/confect/workflows/_kit/graphRunnerV2Current.ts",
          "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts",
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
    "tooling/agent-pack/src/start.ts",
    "tooling/agent-pack/src/ports.ts",
    "tooling/agent-pack/src/verify.ts",
    "tooling/agent-pack/src/receiptWriter.ts",
    "tooling/agent-pack/src/recipes.ts",
    "tooling/agent-pack/src/recipeTransaction.ts",
    "tooling/agent-pack/src/index.ts",
    ...(current
      ? [
          "tooling/agent-pack/src/customerTestClosure.ts",
          "tooling/agent-pack/src/customerTestClosure.test.ts",
          "tooling/agent-pack/src/mcp/projection.test.ts",
          "tooling/agent-pack/src/mcp/protocol.test.ts",
          "tooling/agent-pack/src/mcp/server.test.ts",
          "tooling/agent-pack/src/nodeAdapters.test.ts",
          "tooling/agent-pack/src/mcp/protocol.ts",
          "tooling/agent-pack/src/mcp/projection.ts",
          "tooling/agent-pack/src/mcp/server.ts",
        ]
      : []),
    "tooling/agent-pack/src/readiness/artifacts.ts",
    "tooling/agent-pack/src/readiness/index.ts",
    "tooling/agent-pack/src/readiness/nodeSurface.ts",
    "tooling/agent-pack/src/readiness/presenter.ts",
    "tooling/agent-pack/src/readiness/server.ts",
    "tooling/agent-pack/src/privacy/supportBundle.ts",
    "tooling/agent-pack/src/privacy/supportBundleCommand.ts",
    "tooling/agent-pack/src/privacy/nodeSupportBundleExporter.ts",
    "tooling/agent-pack/src/privacy/support-bundle.schema.json",
    "tooling/quality/check-agent-pack.mts",
    "tooling/quality/check-customer-context.mts",
    "tooling/quality/check-convex-ai-files.mts",
    "docs/template/customer-context.manifest.json",
    "CLAUDE.md",
    ".claude/settings.json",
    "skills-lock.json",
    "packages/convex/confect/tables/records.ts",
    ...(current
      ? [
          "packages/convex/confect/records/records.spec.ts",
          "packages/convex/confect/records/records.impl.ts",
        ]
      : [
          "packages/convex/confect/records.spec.ts",
          "packages/convex/confect/records.impl.ts",
        ]),
    "packages/convex/confect/_generated/tables/records.ts",
    "packages/convex/confect/_generated/schema.ts",
    "packages/convex/confect/_generated/convexSchema.ts",
    "packages/convex/confect/_generated/spec.ts",
    "packages/convex/confect/_generated/id.ts",
    ...(current
      ? [
          "packages/convex/confect/_generated/registeredFunctions/records/records.ts",
          "packages/convex/convex/records/records.ts",
        ]
      : [
          "packages/convex/confect/_generated/registeredFunctions/records.ts",
          "packages/convex/convex/records.ts",
        ]),
    "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
    "apps/web/src/routeTree.gen.ts",
    "apps/web/src/routeRegistry.generated.ts",
  ] as const;
  const currentOnlyRegistrations = new Set([
    "docs/template/agent-pack-privacy.md",
    "apps/cli/src/factory/supportBundle.ts",
    "lefthook.yml",
    "tooling/quality/contract-review-rubric.md",
    "tooling/quality/taste-review.mts",
    "tooling/agent-pack/src/mcp/protocol.ts",
    "tooling/agent-pack/src/mcp/projection.ts",
    "tooling/agent-pack/src/mcp/server.ts",
    "tooling/agent-pack/package.json",
    "tooling/agent-pack/src/customerTestClosure.ts",
    "tooling/agent-pack/src/customerTestClosure.test.ts",
    "tooling/agent-pack/src/mcp/projection.test.ts",
    "tooling/agent-pack/src/mcp/protocol.test.ts",
    "tooling/agent-pack/src/mcp/server.test.ts",
    "tooling/agent-pack/src/nodeAdapters.test.ts",
    "tooling/agent-pack/src/privacy/supportBundle.ts",
    "tooling/agent-pack/src/privacy/supportBundleCommand.ts",
    "tooling/agent-pack/src/privacy/nodeSupportBundleExporter.ts",
    "tooling/agent-pack/src/privacy/support-bundle.schema.json",
  ]);
  const materializedPaths = new Set(entries.map(({ path }) => path));
  const registrations = (
    current
      ? registrationsWithPrivacy
      : registrationsWithPrivacy.filter(
          (path) => !currentOnlyRegistrations.has(path),
        )
  ).filter((path) => materializedPaths.has(path));
  const identity = {
    schemaVersion: 1 as const,
    id: "saas-application" as const,
    provenance: "@maestro-template/generators/saas-application@1" as const,
    registrations,
    entries: entries.map(targetEntryIdentity),
  };
  return {
    ...identity,
    parameterizedEntries: current
      ? SAAS_APPLICATION_PARAMETERIZED_ENTRIES.filter((path) =>
          materializedPaths.has(path),
        )
      : [],
    entries,
    digest: sha256(JSON.stringify(identity)),
  };
}

export const buildSaasApplicationHandoff = (
  name: string,
): string => `# ${name} Handoff Packet

Blueprint: \`saas-application\`

## Useful First Loop

Create a separate customer target with the reviewed SaaS release, then start
from that target so its personalized name and first outcome are available:

\`pnpm maestro -- create ../my-app --name ${JSON.stringify(name)} --outcome "Deliver the first customer outcome" --write\`

\`pnpm --dir ../my-app maestro -- start --mode fake\`

The target begins as a neutral chassis. Implement its first product promise, or
select a maintained example pattern when a concrete reference is useful.

## Readiness

- \`real\`: workspace membership and deployment authority.
- \`fake\`: deterministic local chassis behavior.
- \`seam\`: explicitly selected local adapters; they never report placeholder success.
- \`unavailable\`: live providers and workflow automation until separately reviewed.

The base blueprint has no required workflow, agent, plugin, MCP server, live
provider, or product-specific business logic. Optional automation remains
unavailable unless the semantic ledger supports every exact primitive.
`;
