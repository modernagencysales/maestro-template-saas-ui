import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { GeneratedFile, TemplateBlueprint } from "../index";

export const saasApplicationBlueprint = {
  id: "saas-application",
  label: "SaaS Application",
  summary:
    "A neutral workspace-safe SaaS application with one renameable CRUD record slice and no required automation or live provider.",
  domainNouns: ["workspace", "member", "record"],
  sourceTypes: ["deterministic fixture"],
  defaultCapability: null,
  defaultWorkflow: null,
  defaultAgent: null,
  providerPosture: "fake-first",
  surfaces: ["web", "api", "cli"],
  entity: "record",
  mandatorySystems: [
    "workspace tenancy",
    "table CRUD",
    "web route",
    "headless registry",
  ],
  automation: {
    status: "unavailable",
    reason:
      "No automation is generated unless the workflow semantic ledger supports every exact primitive.",
  },
} as const satisfies TemplateBlueprint & {
  readonly entity: "record";
  readonly mandatorySystems: readonly [
    "workspace tenancy",
    "table CRUD",
    "web route",
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
  "packages/convex/confect/records/records.spec.ts",
  "packages/convex/confect/records/records.impl.ts",
  "apps/web/src/adapters/records/contract.ts",
  "apps/web/src/adapters/records/fake.ts",
  "apps/web/src/features/records/model.ts",
  "apps/web/src/features/records/records-surface.tsx",
  "apps/web/src/screens/records-screen.tsx",
  "apps/web/src/routes/_workspace.records.tsx",
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
  const firstOutcome =
    options.firstOutcome?.trim() || "Create and review records";
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
          functions: "packages/convex/confect/records/*",
          adapter: "apps/web/src/adapters/records.ts",
          feature: "apps/web/src/features/records/*",
          screen: "apps/web/src/screens/records-screen.tsx",
          route: "apps/web/src/routes/_workspace.records.tsx",
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

export type BlueprintTargetPlan = {
  readonly schemaVersion: 1;
  readonly id: "saas-application";
  readonly provenance: "@maestro-template/generators/saas-application@1";
  readonly registrations: readonly string[];
  readonly entries: readonly {
    readonly path: string;
    readonly ownership: "generated";
    readonly action: "generate";
    readonly upgrade: "regenerate";
    readonly sha256: string;
    readonly content: string;
  }[];
  readonly digest: string;
};

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const buildSaasApplicationTargetPlan = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): BlueprintTargetPlan => {
  const entries = buildSaasApplicationFiles(options)
    .filter(({ path }) => path !== "template-instance.json")
    .map(({ path, content }) => ({
      path,
      ownership: "generated" as const,
      action: "generate" as const,
      upgrade: "regenerate" as const,
      sha256: sha256(content),
      content,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const registrations = [
    "packages/convex/confect/tables/records.ts",
    "packages/convex/confect/records/records.spec.ts",
    "packages/convex/confect/records/records.impl.ts",
    "apps/web/src/routes/_workspace.records.tsx",
  ] as const;
  const identity = {
    schemaVersion: 1 as const,
    id: "saas-application" as const,
    provenance: "@maestro-template/generators/saas-application@1" as const,
    registrations,
    entries: entries.map(({ content: _, ...entry }) => entry),
  };
  return { ...identity, entries, digest: sha256(JSON.stringify(identity)) };
};

export const buildSaasApplicationHandoff = (
  name: string,
): string => `# ${name} Handoff Packet

Blueprint: \`saas-application\`

## Useful First Loop

Create a separate customer target with the reviewed SaaS release, then start
from that target so its personalized name and first outcome are available:

\`pnpm maestro -- create ../my-app --name ${JSON.stringify(name)} --outcome "Create and review records" --write\`

\`pnpm --dir ../my-app maestro -- start --mode fake\`

In the target, create a record, return to the list, and open its detail. The
neutral \`record\` noun is intentionally renameable.

## Readiness

- \`real\`: workspace membership and shared web/headless operation IDs.
- \`fake\`: deterministic in-memory record create/list/read.
- \`seam\`: local Convex adapter through generated Confect refs; it never reports placeholder success.
- \`unavailable\`: live providers and workflow automation until separately reviewed.

The base blueprint has no required workflow, agent, plugin, MCP server, live
provider, or product-specific business logic. Optional automation remains
unavailable unless the semantic ledger supports every exact primitive.
`;
