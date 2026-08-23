import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDataResourceCatalog,
  renderDataResourceRuntime,
} from "@maestro-template/template-core/dataResourceCatalog";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";
import { parseProductTopology } from "@maestro-template/template-core/productTopology";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  buildTemplateQuickstart,
  runGeneratorCli,
  type WorkflowBackedTemplateQuickstart,
  type WorkflowOptionalTemplateQuickstart,
} from "../index";
import {
  buildSaasApplicationAlpha1TargetPlan,
  buildSaasApplicationTargetPlan,
  saasApplicationBlueprint,
} from "./saasApplication";
import { buildSaasApplicationAlpha2TargetPlan } from "./alpha2SaasApplicationPlan";
import { buildFactorySaasApplicationFiles } from "./saasApplicationFactory";
import { isWorkflowAutomationPath } from "./saasApplicationPatterns";
import { saasFrontendFoundationPaths } from "./saasFrontendFoundation";
import { SAAS_APPLICATION_PATTERN_GROUPS } from "./saasApplicationPatterns";
import {
  CUSTOMER_ROOT_SCRIPTS,
  CURRENT_CUSTOMER_CONVEX_TEST_EXCLUSIONS,
  CURRENT_EMAIL_CLOSURE,
  CURRENT_HEADLESS_CONTRACT_SOURCE_CLOSURE,
  CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE,
  CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE,
  CURRENT_GENERATOR_GATE_SCRIPTS,
  REMOVED_CUSTOMER_TEMPLATE_SCRIPTS,
} from "./saasRegistrationProjections";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sourceModule = (path: string) =>
  new URL(
    `../../../../examples/saas-application/seed/source/${path}`,
    import.meta.url,
  ).href;
const CURRENT_CUSTOMER_QUALITY_TEST_EXCLUSIONS = [
  "tooling/quality/ai-gate-scripts.test.mts",
  "tooling/quality/check-agent-pack.test.mts",
  "tooling/quality/check-convex-ai-files.test.mts",
  "tooling/quality/check-deploy-authority.test.mts",
  "tooling/quality/check-docs-freshness.test.mts",
  "tooling/quality/check-recipes.test.mts",
  "tooling/quality/mutation-script.test.mts",
] as const;
const CURRENT_ACCEPTANCE_COPY_REPLACEMENTS = new Set([
  "tooling/acceptance/checkout-state.mts",
  "tooling/acceptance/product-contract.mts",
  "tooling/acceptance/run-acceptance.mts",
  "tooling/acceptance/playwright-report.mts",
]);

describe("workflow automation customer closure", () => {
  it("omits workflow-owned release files without omitting sparse App Map inputs", () => {
    expect(
      [
        "packages/convex/confect/capabilities/_versions/publicationEcho/v1.spec.ts",
        "packages/convex/confect/_generated/registeredFunctions/capabilities/_versions/publicationEcho/v1.ts",
        "packages/convex/convex/capabilities/_versions/publicationEcho/v1.ts",
        "packages/convex/test/fixtures/workflow-release.ts",
        "packages/convex/test/helpers/workflowHarness.ts",
        "packages/convex/test/publicationFixture.workflow.test.ts",
        "packages/convex/test/trust-receipt.test.ts",
        "packages/convex/test/workflow-closure.test.ts",
      ].every(isWorkflowAutomationPath),
    ).toBe(true);
    expect(
      [
        "docs/template/generated/workflow-semantics.md",
        "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
      ].some(isWorkflowAutomationPath),
    ).toBe(false);
  });
});

type ReviewedReleasePath = {
  readonly path: string;
  readonly match: "exact" | "subtree";
  readonly action: "copy" | "generate" | "omit";
};

const reviewedReleasePaths = (
  manifestPath: string,
  visited = new Set<string>(),
): readonly ReviewedReleasePath[] => {
  if (visited.has(manifestPath)) throw new Error("release manifest cycle");
  visited.add(manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    readonly kind?: string;
    readonly paths?: readonly ReviewedReleasePath[];
    readonly baseManifest?: { readonly path: string };
    readonly additionalPaths?: readonly ReviewedReleasePath[];
  };
  if (manifest.kind !== "composed-customer-release")
    return manifest.paths ?? [];
  if (!manifest.baseManifest || !manifest.additionalPaths)
    throw new Error("incomplete composed release manifest");
  return [
    ...reviewedReleasePaths(
      resolve(dirname(manifestPath), manifest.baseManifest.path),
      visited,
    ),
    ...manifest.additionalPaths,
  ];
};

const reviewedBaseWrite = (
  paths: readonly ReviewedReleasePath[],
  path: string,
  sourcePaths: ReadonlySet<string>,
): "copy" | "generate" | undefined => {
  const exact = paths.find(
    (entry) => entry.match === "exact" && entry.path === path,
  );
  const rule =
    exact ??
    paths
      .filter(
        (entry) =>
          entry.match === "subtree" &&
          (path === entry.path || path.startsWith(`${entry.path}/`)),
      )
      .sort((left, right) => right.path.length - left.path.length)[0];
  if (rule?.action === "generate" && rule.match === "exact") return "generate";
  return rule?.action === "copy" && sourcePaths.has(path) ? "copy" : undefined;
};

const verifyReferences = (scripts: Readonly<Record<string, string>>) =>
  (scripts.verify ?? "")
    .split(" && ")
    .map((command) => /^pnpm (\S+)/u.exec(command)?.[1])
    .filter((name): name is string => name !== undefined);

const expectVerifyReferencesResolve = (
  scripts: Readonly<Record<string, string>> | undefined,
) => {
  expect(scripts).toBeDefined();
  const available = scripts ?? {};
  expect(
    verifyReferences(available).filter((name) => available[name] === undefined),
  ).toEqual([]);
};

describe("saas application blueprint", () => {
  it("keeps frontend foundation out of optional pattern metadata", () => {
    expect(Object.keys(SAAS_APPLICATION_PATTERN_GROUPS)).toEqual([
      "records-example",
      "workflow-automation",
    ]);
  });

  it("projects only explicitly selected product patterns", () => {
    const buildSelected = buildSaasApplicationTargetPlan as (options: {
      readonly name: string;
      readonly patterns?: readonly (
        "records-example" | "workflow-automation"
      )[];
    }) => ReturnType<typeof buildSaasApplicationTargetPlan>;
    const paths = (
      patterns?: readonly ("records-example" | "workflow-automation")[],
    ) =>
      new Set(
        buildSelected({
          name: "Selected App",
          ...(patterns ? { patterns } : {}),
        }).entries.map(({ path }) => path),
      );

    const neutral = paths();
    expect(neutral.has("tests/acceptance/records.spec.ts")).toBe(false);
    const rootTsconfig = (
      patterns?: readonly ("records-example" | "workflow-automation")[],
    ) => {
      const entry = buildSelected({
        name: "Selected App",
        ...(patterns ? { patterns } : {}),
      }).entries.find(({ path }) => path === "tsconfig.json");
      if (entry === undefined) throw new Error("missing root tsconfig");
      return JSON.parse(entry.content) as {
        readonly references?: readonly { readonly path?: string }[];
      };
    };

    expect(rootTsconfig().references).not.toContainEqual({
      path: "./tooling/workflow",
    });
    expect(neutral.has("features/records.feature")).toBe(false);
    expect(
      neutral.has("apps/web/src/routes/_app/$workspace/_dashboard/records.tsx"),
    ).toBe(false);
    expect(neutral.has("tooling/workflow/package.json")).toBe(false);
    expect(neutral.has("tooling/workflow/tsconfig.json")).toBe(false);
    expect(
      neutral.has("packages/convex/confect/workflows/graphCurrent.ts"),
    ).toBe(false);
    expect(
      neutral.has("packages/convex/confect/deployAuthority/store.ts"),
    ).toBe(true);

    const records = paths(["records-example"]);
    expect(records.has("tests/acceptance/records.spec.ts")).toBe(true);
    expect(rootTsconfig(["records-example"]).references).not.toContainEqual({
      path: "./tooling/workflow",
    });
    expect(
      records.has("apps/web/src/routes/_app/$workspace/_dashboard/records.tsx"),
    ).toBe(true);
    expect(records.has("tooling/workflow/package.json")).toBe(false);
    expect([...records].some((path) => path.startsWith("features/"))).toBe(
      false,
    );

    const workflow = paths(["workflow-automation"]);
    expect(workflow.has("tests/acceptance/records.spec.ts")).toBe(false);
    expect(rootTsconfig(["workflow-automation"]).references).toContainEqual({
      path: "./tooling/workflow",
    });
    expect(workflow.has("tooling/workflow/package.json")).toBe(true);
    expect(workflow.has("tooling/workflow/tsconfig.json")).toBe(true);
    expect(
      workflow.has("packages/convex/confect/workflows/graphCurrent.ts"),
    ).toBe(true);
  });

  it("projects the typed product contract and native acceptance boundary", () => {
    const neutral = new Map(
      buildSaasApplicationTargetPlan({
        name: "North Star App",
        firstOutcome: "Ship the first customer result",
      }).entries.map(({ path, content }) => [path, content]),
    );
    for (const path of [
      "product.contract.yaml",
      "product.contract.schema.json",
      "docs/template/generated/product-contract.md",
      "playwright.acceptance.config.ts",
      "tooling/acceptance/checkout-state.mts",
      "tooling/acceptance/product-contract.mts",
      "tooling/acceptance/run-acceptance.mts",
    ])
      expect(neutral.has(path), path).toBe(true);
    expect(neutral.get("product.contract.yaml")).toContain(
      "id: north-star-app",
    );
    expect(neutral.get("product.contract.yaml")).toContain("status: draft");
    expect(neutral.get("product.contract.yaml")).toContain(
      "Ship the first customer result",
    );
    expect(neutral.has("tests/acceptance/records.spec.ts")).toBe(false);

    const records = new Map(
      buildSaasApplicationTargetPlan({
        name: "Records App",
        patterns: ["records-example"],
      }).entries.map(({ path, content }) => [path, content]),
    );
    for (const path of [
      "docs/product/records-plan.md",
      "tests/acceptance/records.spec.ts",
      "tests/acceptance/support/fixtures.ts",
      "tests/acceptance/support/runtime.ts",
    ])
      expect(records.has(path), path).toBe(true);
    expect(records.get("tests/acceptance/support/fixtures.ts")).toContain(
      "timeout: CONTRACTS_RUNTIME_STARTUP_TIMEOUT_MS",
    );
    expect(records.get("tests/acceptance/support/fixtures.ts")).toContain(
      "timeout: CONTRACTS_HOOK_TIMEOUT_MS",
    );
    expect(records.get("product.contract.yaml")).toContain("BHV-REC-004");
    expect(records.get("docs/product/records-plan.md")).toContain(
      "route:$workspace/records",
    );
    expect(
      records.get("docs/template/generated/product-contract.md"),
    ).toContain("route:$workspace/records");
    expect(records.get("apps/web/src/routeTree.gen.ts")).toContain(
      "fullPath: '/$workspace/records'",
    );
    expect(
      buildSaasApplicationTargetPlan({
        name: "Records App",
        patterns: ["records-example"],
      }).entries.find(
        ({ path }) =>
          path ===
          "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
      )?.replaces,
    ).toBe("copy");
    const recordsTopology = JSON.parse(
      records.get("docs/template/product-topology.json") ?? "{}",
    ) as {
      readonly resources?: readonly {
        readonly id: string;
        readonly kind: string;
        readonly system: string;
      }[];
    };
    const canonicalFoundationRoutes = parseProductTopology(
      JSON.parse(
        readFileSync(
          join(repoRoot, "docs/template/product-topology.json"),
          "utf8",
        ),
      ),
    )
      .resources.filter(({ kind }) => kind === "route")
      .map(({ id }) => id);
    expect(
      recordsTopology.resources
        ?.filter(({ kind }) => kind === "route")
        .map(({ id }) => id),
    ).toEqual([...canonicalFoundationRoutes, "route:$workspace/records"]);
    const recordsSystemIds = new Set(
      parseSystemCatalog(
        JSON.parse(records.get("docs/template/system-catalog.json") ?? "{}"),
      ).systems.map(({ id }) => id),
    );
    for (const route of recordsTopology.resources?.filter(
      ({ kind }) => kind === "route",
    ) ?? [])
      expect(recordsSystemIds.has(route.system), route.id).toBe(true);
  });

  it("projects a tsconfig for every retained root project reference", () => {
    const selections = [
      { label: "neutral", patterns: [] as const },
      { label: "records", patterns: ["records-example"] as const },
      { label: "workflow", patterns: ["workflow-automation"] as const },
    ];

    const missingBySelection = selections.map(({ label, patterns }) => {
      const plan = buildSaasApplicationTargetPlan({
        name: "Selected App",
        patterns,
      });
      const rootTsconfig = plan.entries.find(
        ({ path }) => path === "tsconfig.json",
      );
      if (rootTsconfig === undefined) throw new Error("missing root tsconfig");
      const root = JSON.parse(rootTsconfig.content) as {
        readonly references?: readonly { readonly path?: string }[];
      };
      const entries = new Set(plan.entries.map(({ path }) => path));
      const missing = (root.references ?? [])
        .map(({ path }) => path?.replace(/^\.\//u, ""))
        .filter(
          (path): path is string =>
            path !== undefined && !entries.has(`${path}/tsconfig.json`),
        );

      return { label, missing };
    });

    expect(
      missingBySelection.filter(({ missing }) => missing.length > 0),
    ).toEqual([]);
  });

  it("replaces only current acceptance paths backed by copied bytes", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan({
        name: "Records App",
        patterns: ["records-example"],
      }).entries.map((entry) => [entry.path, entry]),
    );
    for (const path of CURRENT_ACCEPTANCE_COPY_REPLACEMENTS)
      expect(entries.get(path), path).toMatchObject({ replaces: "copy" });
    for (const path of [
      "product.contract.yaml",
      "product.contract.schema.json",
      "docs/template/generated/product-contract.md",
      "playwright.acceptance.config.ts",
      "docs/product/records-plan.md",
      "tests/acceptance/records.spec.ts",
      "tests/acceptance/support/fixtures.ts",
      "tests/acceptance/support/runtime.ts",
    ])
      expect(entries.get(path), path).not.toHaveProperty("replaces");
  });

  it("projects workflow data resources only when workflow is selected", () => {
    const resources = (patterns: readonly "workflow-automation"[] = []) => {
      const entry = buildSaasApplicationTargetPlan({
        name: "Workflow Governance",
        patterns,
      }).entries.find(
        ({ path }) => path === "docs/template/data-resources.json",
      );
      if (!entry) throw new Error("missing projected data-resource catalog");
      return parseDataResourceCatalog(JSON.parse(entry.content)).resources;
    };

    expect(
      resources().filter(({ system }) => system === "workflow-runtime"),
    ).toEqual([]);
    expect(
      resources(["workflow-automation"]).some(
        ({ system }) => system === "workflow-runtime",
      ),
    ).toBe(true);
  });

  it("retains current customer production ownership beyond the immutable release", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan({ name: "Current Ownership" }).entries.map(
        ({ path, content }) => [path, content],
      ),
    );
    const systems = parseSystemCatalog(
      JSON.parse(entries.get("docs/template/system-catalog.json") ?? "{}"),
    ).systems;
    const dataResources = parseDataResourceCatalog(
      JSON.parse(entries.get("docs/template/data-resources.json") ?? "{}"),
    ).resources;
    const topologyIds = new Set(
      parseProductTopology(
        JSON.parse(entries.get("docs/template/product-topology.json") ?? "{}"),
      ).resources.map(({ id }) => id),
    );

    expect(
      systems.some(
        ({ id, tables }) =>
          id === "provider-integrations" &&
          tables.includes("providerConnections"),
      ),
    ).toBe(true);
    expect(dataResources.some(({ id }) => id === "providerConnections")).toBe(
      true,
    );
    for (const id of [
      "job:workpool",
      "integration:dodo-crypto",
      "integration:dodo-webhook",
      "integration:provider-adapter",
      "integration:provider-registry",
      "integration:admaxxer",
      "integration:email",
      "integration:email-setup",
      "provider:observability",
      "headless:api-key-contract",
      "headless:api-key-runtime",
      "headless:executor",
      "headless:mcp",
      "headless:openapi",
    ])
      expect(topologyIds.has(id), id).toBe(true);
  });

  it("derives scripts and lockfile importers from materialized patterns", () => {
    const buildSelected = buildSaasApplicationTargetPlan as (options: {
      readonly name: string;
      readonly patterns?: readonly "workflow-automation"[];
    }) => ReturnType<typeof buildSaasApplicationTargetPlan>;
    const metadata = (patterns?: readonly "workflow-automation"[]) => {
      const entries = new Map(
        buildSelected({
          name: "Selected App",
          ...(patterns ? { patterns } : {}),
        }).entries.map(({ path, content }) => [path, content]),
      );
      const root = JSON.parse(entries.get("package.json") ?? "{}") as {
        readonly scripts?: Readonly<Record<string, string>>;
      };
      const lock = parseYaml(entries.get("pnpm-lock.yaml") ?? "") as {
        readonly importers?: Readonly<
          Record<
            string,
            { readonly dependencies?: Readonly<Record<string, unknown>> }
          >
        >;
      };
      const contract = JSON.parse(
        entries.get(
          "generated/blueprints/saas-application/application-contract.json",
        ) ?? "{}",
      ) as { readonly selectedPatterns?: readonly string[] };
      const convexPackage = JSON.parse(
        entries.get("packages/convex/package.json") ?? "{}",
      ) as { readonly dependencies?: Readonly<Record<string, string>> };
      const cliPackage = JSON.parse(
        entries.get("apps/cli/package.json") ?? "{}",
      ) as { readonly dependencies?: Readonly<Record<string, string>> };
      const webPackage = JSON.parse(
        entries.get("apps/web/package.json") ?? "{}",
      ) as { readonly dependencies?: Readonly<Record<string, string>> };
      const systems = parseSystemCatalog(
        JSON.parse(entries.get("docs/template/system-catalog.json") ?? "{}"),
      );
      return {
        root,
        lock,
        contract,
        convexPackage,
        cliPackage,
        webPackage,
        systems,
        entries,
      };
    };

    const neutral = metadata();
    expect(neutral.contract.selectedPatterns).toEqual([]);
    for (const script of [
      "test:workflow",
      "check:workflow-semantics",
      "check:workflow-graph-boundary",
      "check:workflow-policy-snapshots",
      "check:workflow-principal-propagation",
    ])
      expect(neutral.root.scripts).not.toHaveProperty(script);
    expectVerifyReferencesResolve(neutral.root.scripts);
    expect(neutral.lock.importers).not.toHaveProperty("tooling/workflow");
    expect(neutral.entries.get("apps/cli/src/headlessRegistry.ts")).toContain(
      "Workflow automation pattern is not selected.",
    );
    for (const path of ["apps/cli/src/index.ts", "apps/cli/src/commands.ts"])
      expect(neutral.entries.get(path), path).toContain(
        'from "./headlessRegistry";',
      );
    expect(
      neutral.entries.get("tooling/generators/src/customer-runtime.ts"),
    ).not.toContain('from "./workflow-files"');
    expect(
      neutral.entries.get("tooling/generators/src/customer-runtime.ts"),
    ).toContain("Workflow automation pattern is not selected.");
    expect(
      neutral.entries.has("tooling/generators/src/workflow-files.ts"),
    ).toBe(false);
    expect(neutral.convexPackage.dependencies).not.toHaveProperty(
      "@convex-dev/workflow",
    );
    for (const packageJson of [
      neutral.cliPackage,
      neutral.webPackage,
      neutral.convexPackage,
    ])
      expect(packageJson.dependencies).not.toHaveProperty(
        "@maestro-template/workflow-tooling",
      );
    for (const importer of ["apps/cli", "apps/web", "packages/convex"])
      expect(
        neutral.lock.importers?.[importer]?.dependencies,
      ).not.toHaveProperty("@maestro-template/workflow-tooling");
    expect(
      neutral.systems.systems.find(({ id }) => id === "workflow-runtime"),
    ).toMatchObject({ tables: [] });
    for (const generatedPath of [
      "packages/convex/confect/_generated/schema.ts",
      "packages/convex/confect/_generated/convexSchema.ts",
      "packages/convex/confect/_generated/spec.ts",
      "packages/convex/confect/_generated/id.ts",
    ])
      expect(neutral.entries.get(generatedPath), generatedPath).not.toMatch(
        /workflowArtifacts|\.\.\/workflows\//u,
      );

    const workflow = metadata(["workflow-automation"]);
    expect(workflow.contract.selectedPatterns).toEqual(["workflow-automation"]);
    expect(workflow.root.scripts).toHaveProperty("test:workflow");
    expectVerifyReferencesResolve(workflow.root.scripts);
    expect(workflow.lock.importers).toHaveProperty("tooling/workflow");
    expect(workflow.entries.has("apps/cli/src/headlessRegistry.ts")).toBe(
      false,
    );
    for (const path of ["apps/cli/src/index.ts", "apps/cli/src/commands.ts"])
      expect(workflow.entries.get(path), path).toContain(
        'from "@maestro-template/workflow-tooling";',
      );
    expect(
      workflow.entries.get("tooling/generators/src/customer-runtime.ts"),
    ).toContain('from "./workflow-files"');
    expect(workflow.convexPackage.dependencies).toHaveProperty(
      "@convex-dev/workflow",
    );
    expect(
      workflow.systems.systems.some(({ id }) => id === "workflow-runtime"),
    ).toBe(true);
  });

  it("reproduces immutable alpha.2 independently from the current candidate", () => {
    const authority = JSON.parse(
      readFileSync(
        join(
          repoRoot,
          "releases/v0.2.0-alpha.2/hardening/saas-application.json",
        ),
        "utf8",
      ),
    ) as {
      readonly schemaVersion: number;
      readonly id: string;
      readonly provenance: string;
      readonly registrations: readonly string[];
      readonly entries: readonly unknown[];
    };
    const alpha2 = buildSaasApplicationAlpha2TargetPlan();
    const entryIdentity = (entry: (typeof alpha2.entries)[number]) => ({
      path: entry.path,
      ownership: entry.ownership,
      action: entry.action,
      upgrade: entry.upgrade,
      sha256: entry.sha256,
      ...(entry.replaces === undefined ? {} : { replaces: entry.replaces }),
    });

    expect({
      schemaVersion: alpha2.schemaVersion,
      id: alpha2.id,
      provenance: alpha2.provenance,
      registrations: alpha2.registrations,
      entries: alpha2.entries.map(entryIdentity),
    }).toEqual({
      schemaVersion: authority.schemaVersion,
      id: authority.id,
      provenance: authority.provenance,
      registrations: authority.registrations,
      entries: authority.entries,
    });
    expect(buildSaasApplicationTargetPlan().digest).not.toBe(alpha2.digest);
  });

  it("binds every alpha.2 base write overlap to reviewed replacement metadata", () => {
    const manifestPath = join(
      repoRoot,
      "releases/v0.2.0-alpha.2/manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      readonly release: { readonly sourceCommit: string };
    };
    const sourceCommit = manifest.release.sourceCommit;
    const sourceAvailable = spawnSync(
      "git",
      ["-C", repoRoot, "cat-file", "-e", `${sourceCommit}^{commit}`],
      { encoding: "utf8" },
    );
    if (sourceAvailable.status !== 0) return;
    const paths = reviewedReleasePaths(manifestPath);
    const sourceTree = spawnSync(
      "git",
      ["-C", repoRoot, "ls-tree", "-r", "--name-only", sourceCommit],
      { encoding: "utf8" },
    );
    expect(sourceTree.status, sourceTree.stderr).toBe(0);
    const sourcePaths = new Set(sourceTree.stdout.trim().split("\n"));
    const mismatches = buildSaasApplicationTargetPlan().entries.flatMap(
      (entry) => {
        if (saasFrontendFoundationPaths().includes(entry.path)) return [];
        if (CURRENT_ACCEPTANCE_COPY_REPLACEMENTS.has(entry.path)) return [];
        const baseWrite = reviewedBaseWrite(paths, entry.path, sourcePaths);
        return baseWrite === entry.replaces
          ? []
          : [{ path: entry.path, baseWrite, replaces: entry.replaces }];
      },
    );

    expect(mismatches).toEqual([]);
  });

  it("keeps current notification email tables canonically owned", () => {
    const entry = buildSaasApplicationTargetPlan().entries.find(
      ({ path }) => path === "docs/template/system-catalog.json",
    );
    if (!entry) throw new Error("missing generated system catalog");

    const catalog = parseSystemCatalog(JSON.parse(entry.content) as unknown);
    const notifications = catalog.systems.find(
      ({ id }) => id === "notifications",
    );
    expect(notifications?.tables).toEqual(
      expect.arrayContaining([
        "emailCampaigns",
        "emailDeliveries",
        "emailEvents",
        "emailSubscribers",
        "emailSuppressions",
      ]),
    );
  });

  it("keeps retained template-core tests independent of factory release fixtures", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan({
        name: "Selected App",
        patterns: ["records-example", "workflow-automation"],
      }).entries.map((entry) => [entry.path, entry]),
    );
    const testPath =
      "packages/template-core/src/templateInstance/templateInstance.test.ts";
    const fixturePath =
      "packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json";
    const testEntry = entries.get(testPath);
    const fixtureEntry = entries.get(fixturePath);

    expect(testEntry).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      replaces: "copy",
    });
    expect(fixtureEntry).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    if (!testEntry || !fixtureEntry)
      throw new Error("missing package-owned provider posture test closure");
    expect(testEntry.content).toContain(
      '"./__fixtures__/provider-posture-v1-to-v2.contract.json"',
    );
    expect(testEntry.content).not.toContain(
      "../../../../tooling/release/__fixtures__/upgrade",
    );
    expect(JSON.parse(fixtureEntry.content)).toMatchObject({
      schemaVersion: 1,
      before: { providerMode: "live", providerIds: ["email", "llm"] },
    });
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this declarative cross-artifact assertion.
  it("projects exact customer tooling test and coverage closures", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan({
        name: "Selected App",
        patterns: ["records-example", "workflow-automation"],
      }).entries.map((entry) => [entry.path, entry]),
    );
    const neutralEntries = new Map(
      buildSaasApplicationTargetPlan({
        name: "Neutral App",
        patterns: [],
      }).entries.map((entry) => [entry.path, entry]),
    );
    const root = JSON.parse(entries.get("package.json")?.content ?? "{}") as {
      readonly scripts?: Readonly<Record<string, string>>;
    };
    const generators = JSON.parse(
      entries.get("tooling/generators/package.json")?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    const quality = JSON.parse(
      entries.get("tooling/quality/package.json")?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    const convex = JSON.parse(
      neutralEntries.get("packages/convex/package.json")?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };

    expect(generators.scripts?.test).toContain("vitest run");
    expect(generators.scripts?.test).not.toContain("--exclude");
    expect(quality.scripts?.test).toBe(quality.scripts?.["test:customer"]);
    expect(convex.scripts?.test).toBe(convex.scripts?.["test:customer"]);
    for (const path of CURRENT_CUSTOMER_CONVEX_TEST_EXCLUSIONS) {
      expect(convex.scripts?.test, path).toContain(
        `--exclude ${path.replace("packages/convex/", "")}`,
      );
    }
    expect(root.scripts?.["check:coverage-ratchet"]).not.toContain(
      "workflow-publication-generation.test.ts",
    );
    for (const path of CURRENT_CUSTOMER_QUALITY_TEST_EXCLUSIONS) {
      expect(quality.scripts?.test, path).toContain(
        `--exclude ${path.replace("tooling/quality/", "")}`,
      );
      expect(root.scripts?.["check:coverage-ratchet"], path).toContain(
        `--exclude ${path}`,
      );
    }

    const crudTest = entries.get("tooling/generators/src/crud-proof.test.ts");
    const envTest = entries.get("tooling/quality/src/env-manifest.test.mts");
    const envManifest = entries.get("docs/template/env-manifest.json");
    const envManifestDocs = entries.get("docs/template/env-manifest.md");
    const operationsRunbook = entries.get(
      "docs/template/operations-runbook.md",
    );
    const appMapComposition = entries.get("tooling/app-map/src/composition.ts");
    const appMapCompositionTest = entries.get(
      "tooling/app-map/src/composition.test.ts",
    );
    const appMapSchema = entries.get("tooling/app-map/src/schema.ts");
    const confectManifest = entries.get(
      "packages/template-core/src/generated/confectManifest.ts",
    );
    expect(crudTest).toMatchObject({ replaces: "copy" });
    expect(crudTest?.content).toContain(
      '"apps/web/src/adapters/records/fake.ts"',
    );
    expect(crudTest?.content).not.toContain(
      "examples/saas-application/seed/source/apps/web",
    );
    expect(envTest).toMatchObject({ replaces: "copy" });
    expect(envTest?.content).toContain(
      'readText("tooling/generators/src/customer-runtime.ts")',
    );
    expect(envTest?.content).not.toContain(
      'readText("tooling/generators/src/index.ts")',
    );
    expect(envTest?.content).toContain(
      'import { existsSync, readFileSync } from "node:fs";',
    );
    expect(envTest?.content).toContain(
      'existsSync(resolve(repoRoot, ".woodpecker/deploy.yml"))',
    );
    expect(envTest?.content).not.toContain(
      'const pipeline = readText(".woodpecker/deploy.yml")',
    );
    expect(envManifest).toMatchObject({ replaces: "copy" });
    expect(envManifest?.content).toContain(
      '"name": "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL"',
    );
    for (const projection of [envManifestDocs, operationsRunbook]) {
      expect(projection).toMatchObject({ replaces: "copy" });
      expect(projection?.content).toContain(
        "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL",
      );
    }
    expect(confectManifest).toMatchObject({ replaces: "copy" });
    expect(confectManifest?.content.match(/\n\s+"records",/gu)).toHaveLength(4);
    expect(
      confectManifest?.content.match(
        /\n(\s*)"emailCampaigns",\n\1"emailDeliveries",\n\1"emailSubscribers",\n\1"entitlements",/gu,
      ),
    ).toHaveLength(4);
    for (const factoryProductTable of [
      "buildPacks",
      "evaluationSessions",
      "maestroCredits",
      "supportIncidents",
    ])
      expect(confectManifest?.content).not.toContain(
        `"${factoryProductTable}",`,
      );
    for (const projection of [
      appMapComposition,
      appMapCompositionTest,
      appMapSchema,
    ])
      expect(projection).toMatchObject({ replaces: "copy" });
    expect(appMapComposition?.content).toContain('generator === "add-feature"');
    expect(appMapComposition?.content).toContain(
      'value.name.text === "fullPath"',
    );
    expect(appMapCompositionTest?.content).toContain(
      "projects reviewed add-feature provenance to its generated route",
    );
    expect(appMapSchema?.content).toMatch(
      /"generator-provenance-facts"[\s\S]*?ownershipTargets:\s*\[[^\]]*"route"[^\]]*\]/u,
    );
  });

  it("projects canonical ownership provenance for the records vertical", () => {
    const entry = buildSaasApplicationTargetPlan({
      name: "Records Example",
      patterns: ["records-example"],
    }).entries.find(
      ({ path }) =>
        path === "docs/template/generated/provenance/add-feature/records.json",
    );
    expect(entry).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    if (!entry) throw new Error("missing records feature provenance");
    expect(JSON.parse(entry.content)).toMatchObject({
      generator: "add-feature",
      commandFamily: "template:add-feature",
      name: "$workspace/records",
      ownership: { system: "record-management", disposition: "extend" },
      generatedPaths: expect.arrayContaining([
        "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
      ]),
    });
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this declarative cross-artifact assertion.
  it("projects only the supported customer generator scripts", () => {
    const plan = buildSaasApplicationTargetPlan({
      name: "Records Example",
      patterns: ["records-example"],
    });
    const packageEntry = plan.entries.find(
      ({ path }) => path === "package.json",
    );
    if (!packageEntry) throw new Error("missing projected package.json");
    const scripts = (
      JSON.parse(packageEntry.content) as { scripts: Record<string, string> }
    ).scripts;
    expect(scripts["template:add-table"]).toContain("customer-cli.ts");
    expect(scripts["template:publish-workflow"]).toContain("customer-cli.ts");
    expect(scripts["template:smoke"]).toContain("customer-cli.ts");
    for (const name of CURRENT_GENERATOR_GATE_SCRIPTS) {
      expect(scripts[name]).toContain("customer-cli.ts");
    }
    for (const required of [
      "template:quickstart",
      "template:seed-demo",
      "template:handoff",
      "template:add-client-domain",
      "template:systems",
      "template:prototype",
      "template:add-feature",
      "template:configure-shell",
      "template:private-package:dry-run",
      "template:private-package:import",
      "check:system-catalog",
    ]) {
      expect(scripts).toHaveProperty(required);
    }
    for (const name of [
      "template:init",
      "template:intake",
      "template:workflow-output-smoke",
      "template:upgrade",
    ]) {
      expect(scripts).not.toHaveProperty(name);
    }
    expect(plan.entries.map(({ path }) => path)).not.toContain(
      "tooling/generators/src/index.ts",
    );
    for (const path of [
      "apps/cli/package.json",
      "apps/web/package.json",
      "packages/convex/package.json",
      "tooling/generators/package.json",
    ]) {
      const manifest = plan.entries.find((entry) => entry.path === path);
      if (!manifest) throw new Error(`missing projected ${path}`);
      const dependencies = (
        JSON.parse(manifest.content) as {
          readonly dependencies?: Readonly<Record<string, string>>;
        }
      ).dependencies;
      expect(dependencies).not.toHaveProperty(
        "@maestro-template/release-tooling",
      );
      expect(dependencies).not.toHaveProperty(
        "@maestro-template/stack-tooling",
      );
      expect(dependencies).not.toHaveProperty(
        "@maestro-template/app-idea-evaluator",
      );
    }
    const lockfile = plan.entries.find(({ path }) => path === "pnpm-lock.yaml");
    if (!lockfile) throw new Error("missing projected pnpm-lock.yaml");
    const importer = (start: string, end: string): string => {
      const startIndex = lockfile.content.indexOf(start);
      const endIndex = lockfile.content.indexOf(end);
      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(endIndex).toBeGreaterThan(startIndex);
      return lockfile.content.slice(startIndex, endIndex);
    };
    const cliImporter = importer("  apps/cli:", "  apps/web:");
    const webImporter = importer(
      "  apps/web:",
      "  packages/app-idea-evaluator:",
    );
    const convexImporter = importer(
      "  packages/convex:",
      "  packages/editor-core:",
    );
    const generatorImporter = importer(
      "  tooling/generators:",
      "  tooling/quality:",
    );
    const integrationsImporter = importer(
      "  packages/integrations:",
      "  packages/notifications:",
    );
    expect(cliImporter).not.toContain("@maestro-template/release-tooling");
    expect(cliImporter).not.toContain("@maestro-template/stack-tooling");
    expect(generatorImporter).not.toContain(
      "@maestro-template/release-tooling",
    );
    for (const importer of [webImporter, convexImporter, generatorImporter])
      expect(importer).not.toContain("@maestro-template/app-idea-evaluator");
    expect(lockfile.content).not.toContain(
      '"@maestro-template/app-idea-evaluator":',
    );
    expect(integrationsImporter).toContain(
      "dodopayments:\n        specifier: ^2.44.0\n        version: 2.44.0",
    );
    const systemCatalogEntry = plan.entries.find(
      ({ path }) => path === "docs/template/system-catalog.json",
    );
    const dataResourcesEntry = plan.entries.find(
      ({ path }) => path === "docs/template/data-resources.json",
    );
    const lifecycleEntry = plan.entries.find(
      ({ path }) =>
        path === "packages/convex/confect/ops/dataResources.generated.ts",
    );
    const topologyEntry = plan.entries.find(
      ({ path }) => path === "docs/template/product-topology.json",
    );
    if (
      !systemCatalogEntry ||
      !dataResourcesEntry ||
      !lifecycleEntry ||
      !topologyEntry
    )
      throw new Error("missing SaaS ownership and lifecycle projections");
    const systems = parseSystemCatalog(JSON.parse(systemCatalogEntry.content));
    const resources = parseDataResourceCatalog(
      JSON.parse(dataResourcesEntry.content),
    );
    const topology = parseProductTopology(JSON.parse(topologyEntry.content));
    for (const table of ["records", "deployAuthorityAuditEvents"]) {
      expect(systems.systems.some(({ tables }) => tables.includes(table))).toBe(
        true,
      );
      expect(resources.resources.some(({ id }) => id === table)).toBe(true);
    }
    for (const table of [
      "emailCampaigns",
      "emailDeliveries",
      "emailEvents",
      "emailSubscribers",
      "emailSuppressions",
    ]) {
      expect(systems.systems.some(({ tables }) => tables.includes(table))).toBe(
        true,
      );
      expect(resources.resources.some(({ id }) => id === table)).toBe(true);
    }
    for (const table of [
      "emailVerificationChallenges",
      "reportOwnerships",
      "evaluationAnswers",
      "evaluationReportVersions",
      "evaluationReports",
      "evaluationSessions",
      "evaluationShares",
      "buildPackExports",
      "buildPackStages",
      "buildPacks",
      "buildPackEntitlements",
      "checkoutSessions",
      "commerceRevocations",
      "maestroCredits",
      "purchases",
      "modelReceipts",
      "supportIncidents",
    ]) {
      expect(systems.systems.some(({ tables }) => tables.includes(table))).toBe(
        false,
      );
      expect(resources.resources.some(({ id }) => id === table)).toBe(false);
    }
    for (const id of [
      "route:build-pack/$packId",
      "route:build-pack/$packId/",
      "route:checkout/$reportId",
      "route:checkout/fake-hosted/$sessionId",
      "route:checkout/return",
      "route:dashboard",
      "route:evaluate",
      "route:build-pack/$packId/generating",
      "route:library",
      "route:maestro/$packId",
      "route:privacy",
      "route:report/$evaluationId",
      "route:share/$token",
      "route:support",
      "route:terms",
      "route:verify-report",
    ])
      expect(topology.resources.some((resource) => resource.id === id)).toBe(
        false,
      );
    expect(lifecycleEntry.content).toBe(renderDataResourceRuntime(resources));
    expect(lifecycleEntry.content).toContain('id: "records"');
    expect(
      plan.entries.find(
        ({ path }) => path === "docs/template/agent-pack-privacy.md",
      ),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      replaces: "copy",
      content: readFileSync(
        join(repoRoot, "docs/template/agent-pack-privacy.md"),
        "utf8",
      ),
    });
    expect(
      plan.entries.find(({ path }) => path === "docs/template/preflight.md"),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      content: readFileSync(
        join(repoRoot, "docs/template/preflight.md"),
        "utf8",
      ),
    });
    expect(plan.entries.find(({ path }) => path === "README.md")).toMatchObject(
      {
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
        content: expect.stringContaining(
          "This is a customer application generated from an immutable Maestro release.",
        ),
      },
    );
    expect(
      plan.entries.find(({ path }) => path === "README.md")?.content,
    ).not.toContain("maestro -- create");
    expect(plan.entries.find(({ path }) => path === "README.md")).toMatchObject(
      { replaces: "copy" },
    );
    expect(
      plan.entries.find(({ path }) => path === "README.md")?.content,
    ).toContain(
      "API/CLI/MCP -> headless registry -> same capabilities/workflows as web",
    );
    expect(
      plan.entries.find(({ path }) => path === "README.md")?.content,
    ).toContain("focused verification -> commit reviewed change");
    expect(
      plan.entries.find(({ path }) => path === "README.md")?.content,
    ).toContain('git commit -m "feat: add reviewed Maestro change"');
    const agentInstructions = plan.entries.find(
      ({ path }) => path === "AGENTS.md",
    )?.content;
    expect(agentInstructions).toContain("pnpm check:product-contract");
    expect(agentInstructions).toContain("pnpm acceptance:required");
    const prettierIgnore = plan.entries.find(
      (entry) => entry.path === ".prettierignore",
    );
    expect(prettierIgnore).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    expect(prettierIgnore).toMatchObject({ replaces: "copy" });
    expect(prettierIgnore?.content).toContain("product.contract.schema.json");
    expect(prettierIgnore?.content).toContain(
      "docs/template/generated/product-contract.md",
    );
    expect(
      plan.entries.find(
        (entry) => entry.path === "tooling/confect-manifest/tsconfig.json",
      ),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      replaces: "copy",
    });
  });

  it("keeps historical alpha.1 personalization inert", () => {
    const plan = buildSaasApplicationAlpha1TargetPlan();
    expect(
      buildSaasApplicationAlpha1TargetPlan({
        name: "Compatibility Only",
        firstOutcome: "Must not rewrite historical output",
      }),
    ).toEqual(plan);
  });

  it("limits current personalization to reviewed app identity files", () => {
    expect(buildSaasApplicationTargetPlan().parameterizedEntries).toEqual([
      "product.contract.yaml",
      "docs/template/generated/product-contract.md",
      "generated/blueprints/saas-application/application-contract.json",
    ]);
    expect(buildSaasApplicationAlpha1TargetPlan().parameterizedEntries).toEqual(
      [],
    );
  });

  it("turns the requested first outcome into a draft product contract", () => {
    const contract = buildSaasApplicationTargetPlan({
      name: "Collections Desk",
      firstOutcome: "Reconcile disputed invoices",
    }).entries.find(({ path }) => path === "product.contract.yaml");

    expect(parseYaml(contract?.content ?? "")).toMatchObject({
      product: { id: "collections-desk", name: "Collections Desk" },
      behaviors: [
        {
          id: "BHV-OUTCOME-001",
          status: "draft",
          title: "Reconcile disputed invoices",
          action: "The member completes reconcile disputed invoices.",
          outcomes: ["Reconcile disputed invoices is observable in the app."],
        },
      ],
    });
  });

  it("projects typed product-contract and runtime acceptance without the retired runner", () => {
    const rootPackage = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as {
      readonly devDependencies?: Readonly<Record<string, string>>;
      readonly scripts: Readonly<Record<string, string>>;
    };
    const entries = buildSaasApplicationTargetPlan({
      name: "Records Example",
      patterns: ["records-example"],
    }).entries;
    const projectedPaths = entries.map(({ path }) => path);
    const projectedPackage = JSON.parse(
      entries.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };

    const retiredRunner = ["cu", "cumber"].join("");
    expect(rootPackage.devDependencies).not.toHaveProperty(
      `@${retiredRunner}/${retiredRunner}`,
    );
    expect(rootPackage.devDependencies?.["@playwright/test"]).toBe("1.61.1");
    expect(rootPackage.scripts.verify).toContain("pnpm check:product-contract");
    expect(rootPackage.scripts.verify).toContain("pnpm acceptance:required");
    expect(projectedPackage.scripts?.verify).toContain(
      "pnpm check:product-contract",
    );
    expect(projectedPackage.scripts?.verify).toContain(
      "pnpm acceptance:required",
    );
    expect(projectedPackage.scripts?.verify).not.toMatch(
      new RegExp(`${retiredRunner}|contracts\\s+test`, "iu"),
    );
    expect(projectedPaths).not.toContain(`${retiredRunner}.cjs`);
    expect(projectedPaths.some((path) => path.startsWith("features/"))).toBe(
      false,
    );
  });

  it("projects each pre-existing workflow artifact schema binding once", () => {
    const entries = buildSaasApplicationTargetPlan({
      name: "Workflow App",
      patterns: ["workflow-automation"],
    }).entries;
    const databaseSchema = entries.find(
      ({ path }) => path === "packages/convex/confect/_generated/schema.ts",
    )?.content;
    const convexSchema = entries.find(
      ({ path }) =>
        path === "packages/convex/confect/_generated/convexSchema.ts",
    )?.content;
    if (!databaseSchema || !convexSchema)
      throw new Error("missing projected Convex schemas");

    expect(
      databaseSchema.match(
        /import workflowArtifacts from "\.\/tables\/workflowArtifacts";/gu,
      ),
    ).toHaveLength(1);
    expect(databaseSchema.match(/\n {2}workflowArtifacts,\n/gu)).toHaveLength(
      1,
    );
    expect(
      convexSchema.match(
        /import workflowArtifacts from "\.\/tables\/workflowArtifacts";/gu,
      ),
    ).toHaveLength(1);
    expect(
      convexSchema.match(
        /\n {2}workflowArtifacts: workflowArtifacts\.tableDefinition,\n/gu,
      ),
    ).toHaveLength(1);
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this immutable-authority assertion.
  it("matches the sealed alpha.1 manifest to its historical assets and current structure", () => {
    const plan = buildSaasApplicationTargetPlan();
    expect(new Set(plan.registrations).size).toBe(plan.registrations.length);
    const postAlphaCurrentPaths = new Set<string>([
      ...CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE,
      ...CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE,
      ...CURRENT_HEADLESS_CONTRACT_SOURCE_CLOSURE,
      "apps/cli/package.json",
      "apps/web/package.json",
      "apps/cli/src/factory/mcp.ts",
      "docs/template/data-resources.json",
      "docs/template/env-manifest.json",
      "docs/template/env-manifest.md",
      "docs/template/operations-runbook.md",
      "docs/template/system-catalog.json",
      "examples/generic-ai-ops/template-package.json",
      "lefthook.yml",
      "pnpm-lock.yaml",
      "packages/template-core/src/templateInstance/templateInstance.test.ts",
      "packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json",
      "packages/template-core/src/generated/confectManifest.ts",
      "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts",
      "tooling/app-map/src/composition.test.ts",
      "tooling/app-map/src/composition.ts",
      "tooling/app-map/src/schema.ts",
      "tooling/generators/src/crud-proof.test.ts",
      "tooling/quality/package.json",
      "tooling/quality/src/env-manifest.test.mts",
      "docs/template/generated/provenance/add-feature/records.json",
      "tooling/agent-pack/src/mcp/projection.ts",
      "tooling/agent-pack/src/mcp/protocol.ts",
      "tooling/agent-pack/src/mcp/server.ts",
      "tooling/agent-pack/package.json",
      "tooling/agent-pack/src/customerTestClosure.test.ts",
      "tooling/agent-pack/src/customerTestClosure.ts",
      "tooling/agent-pack/src/mcp/projection.test.ts",
      "tooling/agent-pack/src/mcp/protocol.test.ts",
      "tooling/agent-pack/src/mcp/server.test.ts",
      "tooling/agent-pack/src/nodeAdapters.test.ts",
      "tooling/generators/src/private-package.ts",
      "tooling/quality/contract-review-rubric.md",
      "tooling/quality/taste-review.mts",
      "packages/convex/confect/_generated/registeredFunctions/records/records.ts",
      "packages/convex/convex/records/records.ts",
      "apps/web/src/features/records/records-surface.tsx",
    ]);
    const releaseRoot = join(
      repoRoot,
      "releases/v0.2.0-alpha.1/blueprints/saas-application",
    );
    const manifest = JSON.parse(
      readFileSync(
        join(
          repoRoot,
          "releases/v0.2.0-alpha.1/blueprints/saas-application.json",
        ),
        "utf8",
      ),
    ) as {
      readonly schemaVersion: number;
      readonly id: string;
      readonly provenance: string;
      readonly registrations: readonly string[];
      readonly projectionSource: {
        readonly sourceCommit: string;
        readonly assets: readonly {
          readonly path: string;
          readonly sha256: string;
        }[];
      };
      readonly entries: readonly {
        readonly path: string;
        readonly ownership: "generated" | "customer-extension";
        readonly action: "generate" | "copy";
        readonly upgrade: "regenerate" | "preserve";
        readonly sha256: string;
        readonly replaces?: "copy" | "generate";
      }[];
    };

    expect(plan).toMatchObject({
      schemaVersion: manifest.schemaVersion,
      id: manifest.id,
      provenance: manifest.provenance,
    });

    const assets = new Map(
      manifest.projectionSource.assets.map((asset) => [asset.path, asset]),
    );
    for (const asset of assets.values()) {
      const bytes = readFileSync(join(releaseRoot, asset.path));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(
        asset.sha256,
      );
    }
    const selectedCurrentEntries = new Map(
      buildSaasApplicationTargetPlan({
        name: "Selected App",
        patterns: ["records-example", "workflow-automation"],
      }).entries.map((entry) => [entry.path, entry]),
    );
    for (const path of postAlphaCurrentPaths) {
      expect(
        selectedCurrentEntries.has(path),
        `missing current projection for ${path}`,
      ).toBe(true);
    }
    const historicalEntries = new Map(
      buildSaasApplicationAlpha1TargetPlan().entries.map((entry) => [
        entry.path,
        entry,
      ]),
    );
    const currentEntries = new Map(
      plan.entries.map((entry) => [entry.path, entry]),
    );
    const sourceCommit = manifest.projectionSource.sourceCommit;
    expect(sourceCommit).toMatch(/^[0-9a-f]{40}$/u);
    const sourceAvailable = spawnSync(
      "git",
      ["-C", repoRoot, "cat-file", "-e", `${sourceCommit}^{commit}`],
      { encoding: "utf8" },
    );
    for (const entry of manifest.entries) {
      const asset = assets.get(`base/${entry.path}.txt`);
      const currentEntry = currentEntries.get(entry.path);
      const projectionEntry = historicalEntries.get(entry.path) ?? currentEntry;
      const source =
        sourceAvailable.status === 0
          ? [entry.path, `examples/saas-application/seed/source/${entry.path}`]
              .map((path) =>
                spawnSync(
                  "git",
                  ["-C", repoRoot, "show", `${sourceCommit}:${path}`],
                  { encoding: null },
                ),
              )
              .find(({ status }) => status === 0)
          : undefined;
      const sourceSha256 =
        source?.status === 0 && Buffer.isBuffer(source.stdout)
          ? `sha256:${createHash("sha256").update(source.stdout).digest("hex")}`
          : undefined;
      expect(
        [asset?.sha256, sourceSha256, projectionEntry?.sha256].filter(Boolean),
        `missing historical hash authority for ${entry.path}`,
      ).toContain(entry.sha256);
    }

    if (sourceAvailable.status === 0) {
      expect(
        spawnSync(
          "git",
          ["-C", repoRoot, "merge-base", "--is-ancestor", sourceCommit, "HEAD"],
          { encoding: "utf8" },
        ).status,
      ).toBe(0);
      const tag = "maestro-template-v0.2.0-alpha.1^{}";
      const tagAvailable = spawnSync(
        "git",
        ["-C", repoRoot, "cat-file", "-e", tag],
        { encoding: "utf8" },
      );
      if (tagAvailable.status === 0) {
        expect(
          spawnSync(
            "git",
            ["-C", repoRoot, "merge-base", "--is-ancestor", sourceCommit, tag],
            { encoding: "utf8" },
          ).status,
        ).toBe(0);
      }
    }
  }, 30_000);

  it("materializes the current disclosure and customer support surface", () => {
    const targetRoot = mkdtempSync(
      join(tmpdir(), "maestro-current-customer-projection-"),
    );
    try {
      const plan = buildSaasApplicationTargetPlan();
      for (const entry of plan.entries) {
        const target = join(targetRoot, entry.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, entry.content, { flag: "wx" });
      }

      expect(
        readFileSync(
          join(targetRoot, "docs/template/agent-pack-privacy.md"),
          "utf8",
        ),
      ).toBe(
        readFileSync(
          join(repoRoot, "docs/template/agent-pack-privacy.md"),
          "utf8",
        ),
      );
      expect(
        plan.entries
          .map(({ path }) => path)
          .filter((path) =>
            /privacy\.noNetwork|runtimeNetworkInterceptor/.test(path),
          ),
      ).toEqual([]);
      for (const path of [
        "apps/cli/src/factory/mcp.ts",
        "apps/cli/src/factory/supportBundle.ts",
        "tooling/agent-pack/src/mcp/protocol.ts",
        "tooling/agent-pack/src/mcp/projection.ts",
        "tooling/agent-pack/src/mcp/server.ts",
        "tooling/agent-pack/src/privacy/supportBundle.ts",
        "tooling/agent-pack/src/privacy/supportBundleCommand.ts",
        "tooling/agent-pack/src/privacy/nodeSupportBundleExporter.ts",
      ]) {
        expect(plan.entries.map((entry) => entry.path)).toContain(path);
        expect(existsSync(join(targetRoot, path))).toBe(true);
      }
      expect(
        readFileSync(
          join(targetRoot, "apps/cli/src/factory/customerComposition.ts"),
          "utf8",
        ),
      ).toContain("createSupportBundleCliHandler");
      const customerAgentPackEntry = readFileSync(
        join(targetRoot, "tooling/agent-pack/src/index.ts"),
        "utf8",
      );
      for (const exportedMcpModule of [
        "./mcp/protocol.js",
        "./mcp/projection.js",
        "./mcp/server.js",
      ]) {
        expect(customerAgentPackEntry).toContain(
          `export * from "${exportedMcpModule}";`,
        );
      }
      const mcpEntry = plan.entries.find(
        ({ path }) => path === "apps/cli/src/factory/mcp.ts",
      );
      expect(mcpEntry).toMatchObject({
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
      });
      expect(mcpEntry).not.toHaveProperty("replaces");
      for (const path of [
        "tooling/agent-pack/src/mcp/protocol.ts",
        "tooling/agent-pack/src/mcp/projection.ts",
        "tooling/agent-pack/src/mcp/server.ts",
      ]) {
        expect(plan.entries.find((entry) => entry.path === path)).toMatchObject(
          {
            ownership: "generated",
            action: "generate",
            upgrade: "regenerate",
          },
        );
        expect(
          plan.entries.find((entry) => entry.path === path),
        ).not.toHaveProperty("replaces");
      }
    } finally {
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it("projects the pinned onboarding preview assets into generated targets", () => {
    const plan = buildSaasApplicationTargetPlan();
    for (const path of [
      "apps/web/public/img/onboarding/light.svg",
      "apps/web/public/img/onboarding/dark.svg",
    ]) {
      const entry = plan.entries.find((candidate) => candidate.path === path);
      expect(
        entry,
        `missing generated onboarding asset: ${path}`,
      ).toBeDefined();
      expect(entry?.content).toBe(readFileSync(join(repoRoot, path), "utf8"));
    }
  });

  it("keeps current contracts and support files out of frozen alpha.1", () => {
    const historicalEntries = new Map(
      buildSaasApplicationAlpha1TargetPlan().entries.map((entry) => [
        entry.path,
        entry.content,
      ]),
    );
    const currentEntries = new Map(
      buildSaasApplicationTargetPlan({
        name: "Selected App",
        patterns: ["records-example"],
      }).entries.map((entry) => [entry.path, entry.content]),
    );
    const currentOnlyPaths = [
      ".npmrc",
      "apps/cli/src/commands.ts",
      "apps/web/src/adapters/records/http.ts",
      "packages/convex/confect/_generated/registeredFunctions/headless/apiKeys.ts",
      "packages/convex/convex/headless/apiKeys.ts",
      "product.contract.yaml",
      "docs/template/generated/product-contract.md",
      "playwright.acceptance.config.ts",
      "tests/acceptance/records.spec.ts",
    ];

    for (const path of currentOnlyPaths) {
      expect(currentEntries.has(path), `current target: ${path}`).toBe(true);
      expect(historicalEntries.has(path), `alpha.1 target: ${path}`).toBe(
        false,
      );
    }
    expect(historicalEntries.has("docs/template/agent-pack-privacy.md")).toBe(
      false,
    );
    expect(historicalEntries.has("apps/cli/src/factory/supportBundle.ts")).toBe(
      false,
    );
    expect(
      historicalEntries.has("tooling/agent-pack/src/privacy/supportBundle.ts"),
    ).toBe(false);
    const currentPackage = JSON.parse(
      currentEntries.get("package.json") ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    expect(currentPackage.scripts?.verify).toContain(
      "pnpm check:product-contract",
    );
    expect(currentPackage.scripts?.verify).toContain(
      "pnpm acceptance:required",
    );
  });

  it("projects the typed product-contract and runtime acceptance rules", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan().entries.map((entry) => [
        entry.path,
        entry.content,
      ]),
    );

    const retiredRunner = ["cu", "cumber"].join("");
    expect(entries.has(`${retiredRunner}.cjs`)).toBe(false);
    const rootPackage = JSON.parse(entries.get("package.json") ?? "{}") as {
      readonly scripts?: Readonly<Record<string, string>>;
    };
    expect(rootPackage.scripts?.verify).toContain(
      "pnpm check:product-contract",
    );
    expect(rootPackage.scripts?.verify).toContain("pnpm acceptance:required");
    expect(
      Object.keys(rootPackage.scripts ?? {}).some((script) =>
        script.includes(retiredRunner),
      ),
    ).toBe(false);
    expect(entries.get("docs/template/coding-standards.md")).not.toContain(
      "@journey_",
    );
    expect(
      entries.get("docs/template/enforced-engineering-rules.md"),
    ).toContain("`pnpm check:product-contract`");
    expect(
      entries.get("docs/template/enforced-engineering-rules.md"),
    ).toContain(
      "Woodpecker is the blocking CI authority. Qlty remains advisory",
    );
  });

  it("documents workflow checks only when their scripts are emitted", () => {
    const projection = (patterns: readonly "workflow-automation"[] = []) => {
      const projectedEntries = buildSaasApplicationTargetPlan({
        name: "Workflow Docs",
        patterns,
      }).entries;
      const entries = new Map(
        projectedEntries.map((entry) => [entry.path, entry.content]),
      );
      const root = JSON.parse(entries.get("package.json") ?? "{}") as {
        readonly scripts?: Readonly<Record<string, string>>;
      };
      const references = projectedEntries.flatMap(({ path, content }) =>
        [
          ...content.matchAll(
            /pnpm (check:workflow[^\s.`"',&)\\]+)(?=$|[\s`"',&)\\])/gu,
          ),
        ].flatMap((match) =>
          match[1] === undefined ? [] : [{ command: match[1], path }],
        ),
      );
      const scripts = root.scripts ?? {};
      const missingDocumentedScripts = projectedEntries
        .filter(({ path }) => path.endsWith(".md"))
        .flatMap(({ path, content }) =>
          [
            ...content.matchAll(
              /pnpm ((?:acceptance|check|deploy|evals|review|smoke|template|test|verify)[a-z0-9:-]*)/gu,
            ),
          ].flatMap((match) => {
            const command = match[1];
            return command === undefined ||
              command.endsWith(":") ||
              scripts[command] !== undefined
              ? []
              : [{ command, path }];
          }),
        );
      return { missingDocumentedScripts, references, scripts };
    };

    const neutral = projection();
    const selected = projection(["workflow-automation"]);

    expect(neutral.references).toEqual([]);
    expect(neutral.missingDocumentedScripts).toEqual([]);
    expect(selected.missingDocumentedScripts).toEqual([]);
    expect(selected.references.map(({ command }) => command)).toEqual(
      expect.arrayContaining([
        "check:workflow:fast",
        "check:workflow-semantics",
        "check:workflow-graph-boundary",
      ]),
    );
    for (const { command, path } of selected.references) {
      expect(selected.scripts[command], `${path} -> ${command}`).toBeDefined();
    }
  });

  it("runs typed product-contract and required acceptance from generated-customer verification", () => {
    const projectedPackage = JSON.parse(
      buildSaasApplicationTargetPlan().entries.find(
        ({ path }) => path === "package.json",
      )?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };

    expect(projectedPackage.scripts?.verify).toContain(
      "pnpm check:product-contract",
    );
    expect(projectedPackage.scripts?.verify).toContain(
      "pnpm acceptance:required",
    );
  });

  it("defines a neutral workflow-optional application contract", () => {
    expect(saasApplicationBlueprint).toMatchObject({
      id: "saas-application",
      defaultWorkflow: null,
      defaultAgent: null,
      providerPosture: "fake-first",
      entity: null,
      automation: { status: "unavailable" },
    });
    expect(saasApplicationBlueprint.mandatorySystems).toEqual([
      "workspace tenancy",
      "deployment authority",
      "headless registry",
    ]);
    expect(JSON.stringify(saasApplicationBlueprint)).not.toMatch(
      /gtm|agency|customer-specific|plugin|mcp server/i,
    );
  });

  it("derives replacement projections from checked-out repository source", () => {
    const checkoutSpecPath = join(
      repoRoot,
      "packages/convex/confect/_generated/spec.ts",
    );
    const originalCheckoutSpec = readFileSync(checkoutSpecPath, "utf8");
    const selectedOptions = {
      name: "My App",
      patterns: ["records-example", "workflow-automation"],
    } as const;
    const before = buildSaasApplicationTargetPlan(selectedOptions);
    let after: typeof before;
    try {
      writeFileSync(
        checkoutSpecPath,
        `${originalCheckoutSpec}\n// unrelated integration registration\n`,
      );
      after = buildSaasApplicationTargetPlan(selectedOptions);
    } finally {
      writeFileSync(checkoutSpecPath, originalCheckoutSpec);
    }

    expect(after).not.toEqual(before);
    expect(after.digest).not.toBe(before.digest);
    const projectedSpec = after.entries.find(
      ({ path }) => path === "packages/convex/confect/_generated/spec.ts",
    );
    expect(projectedSpec?.content).toContain(
      'import ops_versioning from "../ops/versioning.spec";',
    );
    expect(projectedSpec?.content).toContain(
      'import records_records from "../records/records.spec";',
    );
    expect(projectedSpec?.content).toContain(
      "// unrelated integration registration",
    );
    expect(buildSaasApplicationTargetPlan(selectedOptions)).toEqual(before);
    expect(
      after.entries.find((entry) => entry.path === "CLAUDE.md"),
    ).toMatchObject({
      ownership: "customer-extension",
      action: "copy",
      upgrade: "preserve",
    });
    expect(
      after.entries.find((entry) => entry.path === ".claude/settings.json"),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    expect(
      after.entries.find((entry) => entry.path === ".claude/settings.json"),
    ).toMatchObject({ replaces: "generate" });
    expect(
      after.entries.find((entry) => entry.path === "skills-lock.json"),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    const currentPolicySnapshot = after.entries.find(
      (entry) =>
        entry.path ===
        "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts",
    );
    expect(currentPolicySnapshot).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    expect(currentPolicySnapshot).not.toHaveProperty("replaces");
    for (const path of [
      "tooling/generators/src/workflow-predeploy.ts",
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
      "packages/convex/confect/capabilities/_kit/workspaceAccess.ts",
      "packages/convex/confect/workflows/lifecycle.spec.ts",
      "packages/convex/confect/workflows/lifecycle.impl.ts",
    ]) {
      expect(after.entries.find((entry) => entry.path === path)).toMatchObject({
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
        replaces: "copy",
      });
    }
    expect(
      after.entries.find(
        (entry) => entry.path === "tooling/generators/src/workflow-files.ts",
      ),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    expect(after.entries).toContainEqual(
      expect.objectContaining({
        path: "AGENTS.md",
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
      }),
    );
    expect(
      after.entries.find((entry) => entry.path === "AGENTS.md"),
    ).toMatchObject({ replaces: "copy" });
  });

  it("projects the current graph runner copy target exactly once", () => {
    const runnerPath =
      "packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts";
    const entries = buildSaasApplicationTargetPlan({
      name: "Workflow App",
      patterns: ["workflow-automation"],
    }).entries.filter(({ path }) => path === runnerPath);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: runnerPath, replaces: "copy" });
  });

  it("projects the current web manifest with the current customer lockfile", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan().entries.map((entry) => [
        entry.path,
        entry,
      ]),
    );
    const webManifest = entries.get("apps/web/package.json");
    expect(webManifest).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      replaces: "copy",
    });
    const expectedWebManifest = JSON.parse(
      readFileSync(join(repoRoot, "apps/web/package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    delete expectedWebManifest.dependencies[
      "@maestro-template/app-idea-evaluator"
    ];
    delete expectedWebManifest.dependencies[
      "@maestro-template/workflow-tooling"
    ];
    expect(webManifest?.content).toBe(
      `${JSON.stringify(expectedWebManifest, null, 2)}\n`,
    );
    expect(entries.get("pnpm-lock.yaml")).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      replaces: "copy",
    });
  });

  it("projects a complete customer Git hook closure", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan().entries.map((entry) => [
        entry.path,
        entry,
      ]),
    );
    for (const path of [
      "lefthook.yml",
      "tooling/quality/contract-review-rubric.md",
      "tooling/quality/taste-review.mts",
    ]) {
      expect(entries.get(path)).toMatchObject({
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
        content: readFileSync(join(repoRoot, path), "utf8"),
        replaces: "copy",
      });
    }
  });

  it("projects only the customer-safe Agent Pack test closure", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan().entries.map((entry) => [
        entry.path,
        entry,
      ]),
    );
    const agentPackPackage = JSON.parse(
      entries.get("tooling/agent-pack/package.json")?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    expect(agentPackPackage.scripts?.test).toBe(
      agentPackPackage.scripts?.["test:customer"],
    );
    expect(
      entries.get("tooling/agent-pack/src/nodeAdapters.test.ts"),
    ).toMatchObject({ replaces: "copy" });
    for (const path of [
      "tooling/agent-pack/src/customerTestClosure.ts",
      "tooling/agent-pack/src/customerTestClosure.test.ts",
      "tooling/agent-pack/src/mcp/projection.test.ts",
      "tooling/agent-pack/src/mcp/protocol.test.ts",
      "tooling/agent-pack/src/mcp/server.test.ts",
    ]) {
      expect(entries.get(path)).toMatchObject({
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
      });
      expect(entries.get(path)).not.toHaveProperty("replaces");
    }
    expect(
      entries.has("tooling/agent-pack/src/nodeAdapters.factory.test.ts"),
    ).toBe(false);
  });

  it("introduces private-package closure without false release replacements", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan().entries.map((entry) => [
        entry.path,
        entry,
      ]),
    );
    expect(
      entries.get("tooling/generators/src/private-package.ts"),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    expect(
      entries.get("tooling/generators/src/private-package.ts"),
    ).not.toHaveProperty("replaces");
    expect(
      entries.get("examples/generic-ai-ops/template-package.json"),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      replaces: "copy",
    });
  });

  it("replaces only deployment-authority files present in the base release", () => {
    const entries = new Map(
      buildSaasApplicationTargetPlan().entries.map((entry) => [
        entry.path,
        entry,
      ]),
    );

    for (const path of [
      "packages/convex/confect/deploy/authority.impl.ts",
      "packages/convex/confect/deploy/authority.spec.ts",
      "packages/convex/confect/deploy/authority.ts",
      "packages/convex/confect/deployAuthority/http.ts",
      "packages/convex/confect/deployAuthority/store.ts",
      "packages/convex/confect/http.ts",
      "packages/convex/confect/shared/env.ts",
      "packages/convex/confect/_generated/tables/deployAuthorityIssuers.ts",
      "packages/convex/confect/tables/deployActionConsumptions.ts",
      "packages/convex/confect/tables/deployApprovals.ts",
      "packages/convex/confect/tables/deployAuthorityIssuers.ts",
      "packages/convex/confect/tables/deployCensusSnapshots.ts",
      "packages/convex/confect/tables/deployVerdicts.ts",
      "packages/convex/convex/convex.config.ts",
      "packages/convex/convex/deploy/authority.ts",
      "packages/convex/test/deploy-authority.test.ts",
    ]) {
      expect(entries.get(path), path).toMatchObject({
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
        replaces: "copy",
      });
    }
    for (const path of [
      "packages/convex/confect/_generated/tables/deployAuthorityAuditEvents.ts",
      "packages/convex/confect/deployAuthority/env.ts",
      "packages/convex/confect/deployAuthority/admin.ts",
      "packages/convex/confect/tables/deployAuthorityAuditEvents.ts",
    ]) {
      expect(entries.get(path), path).not.toHaveProperty("replaces");
    }
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this declarative projection assertion.
  it("emits deterministic workspace-safe CRUD and readiness contracts", async () => {
    const selectedOptions = {
      name: "My App",
      patterns: ["records-example", "workflow-automation"],
    } as const;
    const first = buildFactorySaasApplicationFiles(selectedOptions);
    const second = buildFactorySaasApplicationFiles(selectedOptions);
    expect(first).toEqual(second);
    const customerContext = JSON.parse(
      first.find(
        ({ path }) => path === "docs/template/customer-context.manifest.json",
      )?.content ?? "{}",
    ) as { readonly files: readonly { readonly path: string }[] };
    const customerContextTargets = [
      "docs/template/customer-context.manifest.json",
      ...customerContext.files
        .filter(({ path }) => path !== "AGENTS.md")
        .map(({ path }) => path),
    ];
    expect(
      first
        .map(({ path }) => path)
        .filter((path) => !saasFrontendFoundationPaths().includes(path)),
    ).toEqual(
      [
        "examples/saas-application/seed/source.json",
        "docs/template/system-catalog.json",
        "docs/template/data-resources.json",
        "docs/template/product-topology.json",
        "packages/convex/confect/ops/dataResources.generated.ts",
        "docs/template/system-decisions/record-management.md",
        "docs/template/schema-decisions/records.md",
        "generated/blueprints/saas-application/application-contract.json",
        "generated/blueprints/saas-application/surface-contract.json",
        "generated/blueprints/saas-application/readiness.json",
        "examples/saas-application/seed/workspace.json",
        "examples/saas-application/seed/records.json",
        "examples/saas-application/seed/crud-scenario.json",
        "packages/convex/confect/tables/records.ts",
        "packages/convex/confect/records/records.spec.ts",
        "packages/convex/confect/records/records.impl.ts",
        "apps/web/src/adapters/records/contract.ts",
        "apps/web/src/adapters/records/fake.ts",
        "apps/web/src/features/records/model.ts",
        "apps/web/src/features/records/records-surface.tsx",
        "apps/web/src/screens/records-screen.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
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
        "apps/web/src/adapters/records/http.ts",
        "README.md",
        "docs/template/agent-pack-privacy.md",
        "docs/template/preflight.md",
        "docs/template/coding-standards.md",
        "docs/template/enforced-engineering-rules.md",
        "tooling/workflow/package.json",
        "tooling/workflow/tsconfig.json",
        "AGENTS.md",
        "docs/template/agent-worker-playbook.md",
        "docs/template/how-this-relates-to-maestro.md",
        "agent-patterns/effect-confect.md",
        "docs/template/repo-map.md",
        "docs/template/template-maturity-model.md",
        "maestro-template.mjs",
        "scripts/maestro-bootstrap.mjs",
        "scripts/maestro-bootstrap.test.mjs",
        "scripts/configure-postmark.mts",
        "apps/web/scripts/check-client-bundle-budget.mjs",
        "apps/web/scripts/check-client-bundle-budget.test.mjs",
        "apps/web/vite.config.ts",
        "pnpm-workspace.yaml",
        "packages/convex/package.json",
        "packages/convex/src/refs.ts",
        "tooling/quality/check-convex-generation.mts",
        "apps/cli/src/factory/customerComposition.ts",
        "apps/cli/src/factory/mcp.ts",
        "apps/cli/src/commands.ts",
        "apps/cli/src/index.ts",
        "tooling/agent-pack/package.json",
        "apps/cli/package.json",
        "apps/cli/tsconfig.customer.json",
        "apps/web/package.json",
        "apps/cli/src/factory/start.ts",
        "apps/cli/src/factory/customerRecipes.ts",
        "apps/cli/src/factory/recipeCatalog.ts",
        "apps/cli/src/factory/recipes.ts",
        "apps/cli/src/factory/supportBundle.ts",
        ".npmrc",
        ".prettierignore",
        "tsconfig.json",
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
        "package.json",
        "pnpm-lock.yaml",
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
        "tooling/confect-manifest/tsconfig.json",
        "tooling/generators/package.json",
        "tooling/convex-compat/package.json",
        "tooling/convex-compat/tsconfig.customer.json",
        "tooling/generators/tsconfig.customer.json",
        "tooling/quality/package.json",
        "examples/generic-ai-ops/template-package.json",
        "lefthook.yml",
        "tooling/quality/contract-review-rubric.md",
        "tooling/quality/taste-review.mts",
        "tooling/quality/install-lefthook-if-git.mjs",
        "tooling/generators/src/customer.ts",
        "tooling/generators/src/customer-runtime.ts",
        "tooling/generators/src/customer-dispatcher.ts",
        "tooling/generators/src/shell-configuration.ts",
        "tooling/generators/src/screen-selection.ts",
        "tooling/generators/src/private-package.ts",
        "tooling/generators/src/customer-cli.ts",
        "tooling/generators/src/crud-proof.ts",
        "tooling/generators/src/direct-run.ts",
        "tooling/generators/src/feature-crud.ts",
        "tooling/generators/src/workflow-release-commands.ts",
        "tooling/generators/src/workflow-source-closure.ts",
        "tooling/generators/src/blueprints/gtmImplementation.ts",
        "tooling/generators/src/workflow-files.ts",
        "tooling/generators/src/workflow-predeploy.ts",
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
        "packages/convex/confect/_generated/tables/workflowArtifacts.ts",
        ...CURRENT_EMAIL_CLOSURE,
        ...CURRENT_HEADLESS_CONTRACT_SOURCE_CLOSURE,
        ...CURRENT_SAAS_DEPLOY_AUTHORITY_TABLE_CLOSURE,
        ...CURRENT_SAAS_DEPLOY_AUTHORITY_SOURCE_CLOSURE,
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
        "tooling/agent-pack/src/start.ts",
        "tooling/agent-pack/src/ports.ts",
        "tooling/agent-pack/src/verify.ts",
        "tooling/agent-pack/src/receiptWriter.ts",
        "tooling/agent-pack/src/recipes.ts",
        "tooling/agent-pack/src/recipeTransaction.ts",
        "tooling/agent-pack/src/index.ts",
        "tooling/agent-pack/src/readiness/artifacts.ts",
        "tooling/agent-pack/src/readiness/index.ts",
        "tooling/agent-pack/src/readiness/nodeSurface.ts",
        "tooling/agent-pack/src/readiness/presenter.ts",
        "tooling/agent-pack/src/readiness/server.ts",
        "tooling/agent-pack/src/mcp/protocol.ts",
        "tooling/agent-pack/src/mcp/projection.ts",
        "tooling/agent-pack/src/mcp/server.ts",
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
        "tooling/quality/check-agent-pack.mts",
        "tooling/quality/check-customer-context.mts",
        "tooling/quality/check-convex-ai-files.mts",
        ...customerContextTargets,
        "packages/convex/confect/_generated/tables/records.ts",
        "packages/convex/confect/_generated/schema.ts",
        "packages/convex/confect/_generated/convexSchema.ts",
        "packages/convex/confect/_generated/spec.ts",
        "packages/convex/confect/_generated/components.ts",
        "packages/convex/confect/_generated/id.ts",
        "packages/convex/confect/_generated/registeredFunctions/records/records.ts",
        "packages/convex/convex/records/records.ts",
        "apps/web/src/routeTree.gen.ts",
        "docs/template/env-manifest.json",
        "docs/template/env-manifest.md",
        "docs/template/operations-runbook.md",
        "packages/template-core/src/templateInstance/templateInstance.test.ts",
        "packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json",
        "packages/template-core/src/generated/confectManifest.ts",
        "packages/convex/confect/agents/assistant.spec.ts",
        "packages/convex/confect/agents/assistant.impl.ts",
        "packages/convex/confect/agents/assistantModel.ts",
        "packages/convex/confect/brain/pages.spec.ts",
        "packages/convex/confect/brain/pages.impl.ts",
        "packages/convex/confect/brain/pageRevision.ts",
        "packages/convex/confect/brain/snapshotVersion.ts",
        "packages/convex/confect/capabilities/_kit/capability.ts",
        "packages/convex/confect/capabilities/_kit/errors.ts",
        "packages/convex/confect/capabilities/_kit/surfaces.ts",
        "packages/convex/confect/capabilities/_kit/principal.ts",
        "packages/convex/confect/integrations/connections.spec.ts",
        "packages/convex/confect/integrations/connections.impl.ts",
        "packages/convex/confect/integrations/connectionLifecycle.ts",
        "packages/convex/confect/tables/brainPages.ts",
        "packages/convex/confect/tables/providerConnections.ts",
        "packages/convex/confect/_generated/tables/brainPages.ts",
        "packages/convex/confect/_generated/tables/providerConnections.ts",
        "packages/convex/confect/_generated/registeredFunctions/agents/assistant.ts",
        "packages/convex/confect/_generated/registeredFunctions/brain/pages.ts",
        "packages/convex/confect/_generated/registeredFunctions/integrations/connections.ts",
        "packages/convex/convex/agents/assistant.ts",
        "packages/convex/convex/brain/pages.ts",
        "packages/convex/convex/integrations/connections.ts",
        "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts",
        "packages/convex/test/shared-env.test.ts",
        "tooling/generators/src/crud-proof.test.ts",
        "tooling/app-map/src/composition.test.ts",
        "tooling/app-map/src/composition.ts",
        "tooling/app-map/src/schema.ts",
        "tooling/app-map/src/build.ts",
        "tooling/app-map/src/gitDiff.ts",
        "tooling/app-map/src/validate.ts",
        "tooling/app-map/package.json",
        "packages/template-core/src/dataResourceCatalog.ts",
        "packages/template-core/src/productTopology.ts",
        "packages/template-core/src/systemCatalog.ts",
        "packages/template-core/src/productContract.ts",
        "packages/template-core/src/workPackage.ts",
        "packages/template-core/src/productPlan.ts",
        "packages/template-core/src/templateInstance/index.ts",
        "docs/template/generated/workflow-semantics.md",
        "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
        "tooling/quality/src/env-manifest.test.mts",
        "docs/template/generated/provenance/add-feature/records.json",
      ].filter((path) => !saasFrontendFoundationPaths().includes(path)),
    );
    expect(
      first.some(({ path }) =>
        path.startsWith("examples/generic-ai-ops/seed/"),
      ),
    ).toBe(false);
    const routeTree = first.find(
      ({ path }) => path === "apps/web/src/routeTree.gen.ts",
    )?.content;
    expect(routeTree).toContain("AppWorkspaceDashboardIndexRouteImport");
    expect(routeTree).not.toContain("saasApplicationRoutes");
    expect(
      first.find(
        ({ path }) => path === "tooling/quality/install-lefthook-if-git.mjs",
      )?.content,
    ).not.toContain("/* global process */");
    expect(
      first.find(({ path }) => path === "eslint.config.mjs")?.content,
    ).toContain('"**/.output/**"');
    expect(
      first.find(({ path }) => path === "tooling/convex-compat/package.json")
        ?.content,
    ).toContain("tsconfig.customer.json --noEmit");
    expect(
      first.find(
        ({ path }) => path === "tooling/convex-compat/tsconfig.customer.json",
      )?.content,
    ).toContain('"src/matrix.ts"');
    expect(
      first.find(({ path }) => path === ".prettierignore")?.content,
    ).toContain(".maestro/");
    expect(
      first.find(({ path }) => path === ".prettierignore")?.content,
    ).toContain(".claude/settings.json");
    expect(
      first.find(
        ({ path }) => path === "tooling/confect-manifest/tsconfig.json",
      )?.content,
    ).toContain("../../packages/convex/confect/**/*.json");

    const contract = JSON.parse(
      first.find(({ path }) => path.endsWith("application-contract.json"))
        ?.content ?? "{}",
    );
    expect(contract).toMatchObject({
      entity: {
        singular: "record",
        renameable: true,
        tenantKey: "workspaceId",
      },
      primitive: "table-route-crud",
      workflowRequired: false,
      operations: [
        { id: "records.list", kind: "query" },
        { id: "records.read", kind: "query" },
        { id: "records.create", kind: "mutation" },
      ],
      uiStates: ["loading", "empty", "error", "list", "detail", "create"],
    });
    expect(
      contract.operations.every(
        (operation: { workspaceScoped: boolean }) => operation.workspaceScoped,
      ),
    ).toBe(true);
    const executablePaths = new Set([
      "packages/convex/confect/tables/records.ts",
      "packages/convex/confect/records/records.spec.ts",
      "packages/convex/confect/records/records.impl.ts",
      "apps/web/src/adapters/records/contract.ts",
      "apps/web/src/adapters/records/fake.ts",
      "apps/web/src/features/records/model.ts",
      "apps/web/src/features/records/records-surface.tsx",
      "apps/web/src/screens/records-screen.tsx",
      "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
    ]);
    const executable = first.filter(({ path }) => executablePaths.has(path));
    for (const file of executable) {
      const transpiled = transpileModule(file.content, {
        compilerOptions: {
          jsx: JsxEmit.ReactJSX,
          module: ModuleKind.ESNext,
          target: ScriptTarget.ES2022,
        },
        fileName: file.path,
        reportDiagnostics: true,
      });
      expect(transpiled.diagnostics ?? []).toEqual([]);
    }
    const spec = first.find(({ path }) => path.endsWith("records.spec.ts"));
    for (const operation of contract.operations) {
      expect(spec?.content).toContain(`operationId: "${operation.id}"`);
    }

    const surfaces = JSON.parse(
      first.find(({ path }) => path.endsWith("surface-contract.json"))
        ?.content ?? "{}",
    );
    expect(surfaces.web.operations).toEqual(surfaces.headless.operations);
    const { recordOperationContract } = (await import(
      sourceModule("apps/web/src/adapters/records/contract.ts")
    )) as {
      readonly recordOperationContract: readonly {
        readonly operationId: string;
      }[];
    };
    expect(
      recordOperationContract.map(({ operationId }) => operationId),
    ).toEqual(surfaces.web.operations);
    expect(surfaces.providers.fake).toMatchObject({
      status: "fake",
      behavior: "in-memory workspace-scoped records CRUD",
    });
    expect(surfaces.providers.local).toMatchObject({
      status: "seam",
      placeholderSuccess: false,
    });

    const readiness = JSON.parse(
      first.find(({ path }) => path.endsWith("readiness.json"))?.content ??
        "{}",
    );
    expect(
      readiness.surfaces.every((surface: { status: string }) =>
        ["real", "fake", "seam", "unavailable"].includes(surface.status),
      ),
    ).toBe(true);
    expect(readiness.automation).toMatchObject({
      status: "selected",
    });
  });

  it("projects the hosted auth deployment checklist", () => {
    const maturityModel = buildFactorySaasApplicationFiles({
      name: "My App",
    }).find(
      ({ path }) => path === "docs/template/template-maturity-model.md",
    )?.content;

    expect(maturityModel).toContain(
      "Register the exact hosted callback in WorkOS",
    );
    expect(maturityModel).toContain(
      "Confirm `WORKOS_CLIENT_ID` matches in the web host and Convex deployment",
    );
    expect(maturityModel).toContain(
      "Redeploy `packages/convex/convex/auth.config.ts`",
    );
    expect(maturityModel).toContain("complete one real sign-in through");
    expect(maturityModel).toContain("`access/provisioning:ensureProvisioned`");
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this generated-layout assertion.
  it("projects the CRUD registration in Confect's codegen-stable layout", () => {
    const files = new Map(
      buildFactorySaasApplicationFiles({
        name: "My App",
        patterns: ["records-example"],
      }).map((file) => [file.path, file.content]),
    );

    expect(
      files.get(
        "packages/convex/confect/_generated/registeredFunctions/records/records.ts",
      ),
    ).toContain('import databaseSchema from "../../schema";');
    expect(files.get("packages/convex/convex/records/records.ts")).toContain(
      'import registeredFunctions from "../../confect/_generated/registeredFunctions/records/records";',
    );
    expect(
      files.has(
        "packages/convex/confect/_generated/registeredFunctions/records.ts",
      ),
    ).toBe(false);
    expect(files.has("packages/convex/convex/records.ts")).toBe(false);
    expect(files.has("packages/convex/confect/records/records.spec.ts")).toBe(
      true,
    );
    expect(files.has("packages/convex/confect/records/records.impl.ts")).toBe(
      true,
    );
    expect(files.has("packages/convex/confect/records.spec.ts")).toBe(false);
    expect(files.has("packages/convex/confect/records.impl.ts")).toBe(false);
    const recordsSpec =
      files.get("packages/convex/confect/records/records.spec.ts") ?? "";
    expect(recordsSpec).toContain('from "../_generated/tables/records"');
    expect(recordsSpec).toContain('from "../capabilities/_kit/capability"');
    expect(recordsSpec).not.toContain('from "./_generated/');
    const recordsImpl =
      files.get("packages/convex/confect/records/records.impl.ts") ?? "";
    expect(recordsImpl).toContain('from "../_generated/schema"');
    expect(recordsImpl).toContain(
      'from "../capabilities/_kit/workspaceAccess"',
    );
    expect(recordsImpl).not.toContain('from "./_generated/');

    const spec = files.get("packages/convex/confect/_generated/spec.ts") ?? "";
    expect(spec).toContain(
      'import records_records from "../records/records.spec";',
    );
    expect(spec).toContain(
      'GroupSpec.makeAt("records").addGroupAt("records", records_records)',
    );
    for (const factoryProductGroup of [
      "buildPacks",
      "evaluateAppIdea",
      "manageEvaluationReport",
      "commerce",
      "generateCompleteBuildPack",
    ])
      expect(spec).not.toContain(factoryProductGroup);
    expect(spec).not.toContain("demo_showcase");
    expect(spec).not.toContain('.addAt("demo",');

    const components =
      files.get("packages/convex/confect/_generated/components.ts") ?? "";
    expect(components).not.toContain('"workflow"');
    expect(components).not.toContain('"workflowAdmission"');
    expect(components).not.toContain('"workflowDeadline"');

    const convexApi =
      files.get("packages/convex/convex/_generated/api.d.ts") ?? "";
    expect(convexApi).not.toContain("demo_showcase");
    expect(convexApi).not.toContain('"demo/showcase"');

    const databaseSchema =
      files.get("packages/convex/confect/_generated/schema.ts") ?? "";
    const convexSchema =
      files.get("packages/convex/confect/_generated/convexSchema.ts") ?? "";
    for (const factoryProductTable of [
      "buildPacks",
      "evaluationSessions",
      "maestroCredits",
      "supportIncidents",
    ]) {
      expect(databaseSchema).not.toContain(factoryProductTable);
      expect(convexSchema).not.toContain(factoryProductTable);
    }

    const docs = files.get("packages/convex/confect/_generated/docs.ts") ?? "";
    expect(docs).toContain("export type RecordsDoc =");
    expect(docs).toContain("  records: RecordsDoc;");
    expect(docs).not.toContain("BuildPacksDoc");
    expect(docs).not.toContain("EvaluationSessionsDoc");

    const ids = files.get("packages/convex/confect/_generated/id.ts") ?? "";
    expect(ids.match(/\| "records"/g)).toHaveLength(1);
    expect(ids).not.toContain('| "workflowArtifacts"');
    expect(ids).not.toContain('"buildPacks"');
    expect(ids).not.toContain('"evaluationSessions"');

    const sharedEnvTest =
      files.get("packages/convex/test/shared-env.test.ts") ?? "";
    expect(sharedEnvTest).toContain('describe("TemplateRuntimeConfig"');
    expect(sharedEnvTest).not.toContain("loadLlmGatewayEnvConfig");
    expect(sharedEnvTest).not.toContain("confect/evaluator/providerConfig");

    const generatedRefsTest =
      files.get("apps/web/src/adapters/confect-generated-refs.test.ts") ?? "";
    expect(generatedRefsTest).toBe("");

    for (const evaluatorSourcePath of [
      "apps/web/src/providers/posthog.test.tsx",
      "apps/web/src/public-routes.test.tsx",
      "apps/web/src/routes/build-pack.$packId.tsx",
    ])
      expect(files.has(evaluatorSourcePath), evaluatorSourcePath).toBe(false);

    const recordsSurface =
      files.get("apps/web/src/features/records/records-surface.tsx") ?? "";
    expect(recordsSurface).toContain(
      "templateConfectRefs.public.records.records.list",
    );
    expect(recordsSurface).toContain(
      "templateConfectRefs.public.records.records.create",
    );
    expect(recordsSurface).toContain("useConvexQuery");
    expect(recordsSurface).toContain("listState.isError");
    expect(recordsSurface).not.toMatch(
      /templateConfectRefs\.public\.records\.(?:list|create)/u,
    );
    for (const obsoleteSeam of [
      "../../adapters/confect-state",
      "../../env",
      "../../providers/workspace",
    ])
      expect(recordsSurface).not.toContain(obsoleteSeam);

    const recordsRoute =
      files.get("apps/web/src/routes/_app/$workspace/_dashboard/records.tsx") ??
      "";
    expect(recordsRoute).toContain(
      'createFileRoute("/_app/$workspace/_dashboard/records")',
    );
    expect(recordsRoute).not.toContain("BusinessAppShell");
    expect(recordsRoute).not.toContain("BusinessPageRoot");

    const routeTree = files.get("apps/web/src/routeTree.gen.ts") ?? "";
    expect(routeTree).toContain("AppWorkspaceDashboardIndexRouteImport");
    expect(routeTree).not.toContain("saasApplicationRoutes");
    for (const obsoletePath of [
      "apps/web/src/bundle-policy.ts",
      "apps/web/src/bundle-policy.test.ts",
      "apps/web/src/routes/index.tsx",
      "apps/web/src/providers/posthog.tsx",
    ])
      expect(files.has(obsoletePath), obsoletePath).toBe(false);
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this declarative script-closure assertion.
  it("projects a customer-only root script closure", () => {
    const files = buildFactorySaasApplicationFiles({
      name: "My App",
      patterns: ["records-example", "workflow-automation"],
    });
    for (const path of [
      "AGENTS.md",
      "docs/template/agent-worker-playbook.md",
      "docs/template/how-this-relates-to-maestro.md",
      "docs/template/repo-map.md",
      "docs/template/template-maturity-model.md",
      "maestro-template.mjs",
      "scripts/maestro-bootstrap.mjs",
      "scripts/maestro-bootstrap.test.mjs",
      "scripts/configure-postmark.mts",
      "apps/web/package.json",
      "apps/web/scripts/check-client-bundle-budget.mjs",
      "apps/web/scripts/check-client-bundle-budget.test.mjs",
      "apps/web/vite.config.ts",
      "pnpm-workspace.yaml",
      "pnpm-lock.yaml",
      "packages/convex/package.json",
      "tooling/quality/check-convex-generation.mts",
    ]) {
      expect(
        files.some((file) => file.path === path),
        path,
      ).toBe(true);
    }
    expect(
      files.find(({ path }) => path === "pnpm-workspace.yaml")?.content,
    ).toContain("onlyBuiltDependencies:");
    expect(
      files.find(({ path }) => path === "pnpm-lock.yaml")?.content,
    ).not.toContain('"@maestro-template/release-tooling":');
    const customerContext = JSON.parse(
      files.find(
        ({ path }) => path === "docs/template/customer-context.manifest.json",
      )?.content ?? "{}",
    ) as { readonly files: readonly { readonly path: string }[] };
    const root = JSON.parse(
      files.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as {
      readonly packageManager: string;
      readonly scripts: Readonly<Record<string, string>>;
      readonly devDependencies: Readonly<Record<string, string>>;
    };
    const cliPackage = JSON.parse(
      files.find(({ path }) => path === "apps/cli/package.json")?.content ??
        "{}",
    ) as { readonly dependencies: Readonly<Record<string, string>> };
    const convexPackage = JSON.parse(
      files.find(({ path }) => path === "packages/convex/package.json")
        ?.content ?? "{}",
    ) as { readonly dependencies: Readonly<Record<string, string>> };
    const generatorPackage = JSON.parse(
      files.find(({ path }) => path === "tooling/generators/package.json")
        ?.content ?? "{}",
    ) as { readonly dependencies: Readonly<Record<string, string>> };
    expect(cliPackage.dependencies).not.toHaveProperty(
      "@maestro-template/release-tooling",
    );
    expect(cliPackage.dependencies).not.toHaveProperty(
      "@maestro-template/stack-tooling",
    );
    expect(generatorPackage.dependencies).not.toHaveProperty(
      "@maestro-template/release-tooling",
    );
    for (const packageName of [
      "@confect/cli",
      "@confect/core",
      "@confect/server",
      "@confect/test",
    ]) {
      expect(convexPackage.dependencies[packageName]).toBe("10.0.0-next.9");
    }
    expect(convexPackage.dependencies.effect).toBe("4.0.0-beta.102");
    expect(convexPackage.dependencies["@effect/platform-node"]).toBe(
      "4.0.0-beta.102",
    );
    expect(convexPackage.dependencies.ioredis).toBe("5.11.1");
    expect(convexPackage.dependencies).not.toHaveProperty("@effect/platform");
    expect(convexPackage.dependencies).not.toHaveProperty("@effect/cluster");
    const emittedSource = files
      .filter(({ path }) => /\.(?:ts|tsx|mts|mjs)$/.test(path))
      .map(({ content }) => content)
      .join("\n");
    expect(emittedSource).not.toContain('from "effect/Either"');
    expect(emittedSource).not.toContain("decodeUnknownEither");
    expect(emittedSource).not.toContain('from "repos/');
    expect(emittedSource).not.toContain('from "../../repos/');
    const omittedPaths = [
      "tooling/evals",
      "tooling/pr-backlog",
      "tooling/release",
      "tooling/stack",
      "experiments",
      ".woodpecker",
    ];
    const omittedScripts = new Set([
      "test:pr-backlog",
      "test:stack",
      "stack:check",
      "stack:status",
      "stack:submit",
      "stack:sync",
      "stack:preflight",
      "stack:merge",
      "evals:agent-pack",
      "evals",
      "release:seal",
      "smoke:web-static",
      "smoke:hosted",
      "smoke:hosted:browser",
      "smoke:hosted:a11y",
      "smoke:hosted:visual",
      "smoke:golden",
      "smoke:golden:browser",
      "smoke:golden:a11y",
      "smoke:golden:visual",
      "review:readiness",
      "review:completion",
      "deploy:doctor",
      "deploy:cloudflare",
      "convex:deploy",
      "check:deploy-authority",
      "test:mutation",
      "test:chassis-ci",
      "test:acceptance-tooling",
      "test:release-filesystem",
      "check:recipes",
      "check:workflow-version-immutability",
      "check:workflow-publication-generation",
      "saas-ui:materialize",
    ]);
    const factory = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as typeof root;
    expect(Object.keys(root.scripts)).toEqual([
      ...CUSTOMER_ROOT_SCRIPTS,
      "maestro:crud-proof",
      "template:smoke",
    ]);
    const rewritten = new Set([
      "acceptance:features",
      "product-contract:generate",
      "check:product-contract",
      "acceptance:all",
      "acceptance:required",
      "test",
      "test:tooling",
      "check:coverage-ratchet",
      "coverage:update-baseline",
      "check:agent-pack",
      "check:layer-boundaries",
      "prepare",
      "verify",
    ]);
    for (const [name, command] of Object.entries(factory.scripts)) {
      if (
        name.startsWith("template:") &&
        (!REMOVED_CUSTOMER_TEMPLATE_SCRIPTS.includes(
          name as (typeof REMOVED_CUSTOMER_TEMPLATE_SCRIPTS)[number],
        ) ||
          CURRENT_GENERATOR_GATE_SCRIPTS.includes(
            name as (typeof CURRENT_GENERATOR_GATE_SCRIPTS)[number],
          ))
      ) {
        expect(root.scripts[name]).toBe(
          command
            .replace(
              "tooling/generators/src/index.ts",
              "tooling/generators/src/customer-cli.ts",
            )
            .replace(
              "tooling/generators/src/cli.ts",
              "tooling/generators/src/customer-cli.ts",
            ),
        );
        continue;
      }
      if (
        root.scripts[name] !== undefined &&
        !omittedScripts.has(name) &&
        !rewritten.has(name) &&
        (!REMOVED_CUSTOMER_TEMPLATE_SCRIPTS.includes(
          name as (typeof REMOVED_CUSTOMER_TEMPLATE_SCRIPTS)[number],
        ) ||
          CURRENT_GENERATOR_GATE_SCRIPTS.includes(
            name as (typeof CURRENT_GENERATOR_GATE_SCRIPTS)[number],
          ))
      )
        expect(root.scripts[name]).toBe(command);
    }
    expect(root.scripts["template:smoke"]).toBe(
      "tsx tooling/generators/src/customer-cli.ts smoke",
    );
    expect(root.scripts.test).toBe(
      "turbo run test --filter='./packages/*' --filter=@maestro-template/web && pnpm test:tooling",
    );
    expect(root.scripts["test:tooling"]).toBe(
      "pnpm test:bootstrap && pnpm --dir tooling/workflow test && pnpm --dir tooling/generators exec vitest run src/customer-runtime.test.ts src/templateInstanceMigration.test.ts src/workflow-publication-generation.test.ts src/workflow-release-commands.test.ts --maxWorkers=1 --no-file-parallelism",
    );
    for (const name of CURRENT_GENERATOR_GATE_SCRIPTS) {
      expect(root.scripts[name]).toContain(
        "tooling/generators/src/customer-cli.ts",
      );
    }
    expect(JSON.stringify(root.scripts)).not.toMatch(
      new RegExp(omittedPaths.join("|")),
    );
    for (const name of omittedScripts) {
      for (const command of Object.values(root.scripts))
        expect(command).not.toContain(`pnpm ${name}`);
    }
    expect(root.scripts.verify).toBe(
      [
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
        "check:product-contract",
        "acceptance:required",
      ]
        .map((name) => `pnpm ${name}`)
        .join(" && "),
    );
    const agentPackCheck = files.find(
      ({ path }) => path === "tooling/quality/check-agent-pack.mts",
    )?.content;
    expect(agentPackCheck).toContain("customerContextFindings(repoRoot)");
    expect(agentPackCheck).toContain("verificationArtifactFindings(repoRoot)");
    expect(agentPackCheck).toContain("forbiddenMcpFindings(repoRoot)");
    expect(agentPackCheck).not.toContain("checkSkillProjections");
    expect(agentPackCheck).not.toContain("factoryWiringFindings");
    expect(root.scripts["check:agent-pack"]).toBe(
      "tsx tooling/quality/check-agent-pack.mts",
    );
    const convexCheck = files.find(
      ({ path }) => path === "tooling/quality/check-convex-ai-files.mts",
    )?.content;
    expect(convexCheck).toContain("Installed Convex AI targets");
    expect(convexCheck).not.toContain("validateOfficialConvexBundle");
    const customerContextCheck = files.find(
      ({ path }) => path === "tooling/quality/check-customer-context.mts",
    )?.content;
    expect(customerContextCheck).toContain("customer-context:extra:");
    expect(customerContextCheck).toContain("safeClaudeSettings");
    expect(customerContextCheck).toContain("sha256(installed) !== item.sha256");
    expect(customerContextCheck).toContain("hasClaudeInclude(content)");
    expect(
      customerContext.files.find(
        ({ path }) => path === ".claude/settings.json",
      ),
    ).toMatchObject({
      sha256:
        "sha256:7825364f57b5c5f07c64d5c5bbbaa8046a6c1c21d3216112cc86f99d2e5b6ccc",
      validation: "safe-claude-settings",
    });
    const generatedSettings = files.find(
      ({ path }) => path === ".claude/settings.json",
    )?.content;
    expect(
      createHash("sha256")
        .update(generatedSettings ?? "")
        .digest("hex"),
    ).toBe("7825364f57b5c5f07c64d5c5bbbaa8046a6c1c21d3216112cc86f99d2e5b6ccc");
    for (const required of [
      "CLAUDE.md",
      ".claude/skills/convex/SKILL.md",
      ".agents/skills/maestro/SKILL.md",
      ".agents/skills/maestro-convex/SKILL.md",
      ".agents/skills/convex/SKILL.md",
      "skills-lock.json",
    ])
      expect(customerContext.files.map(({ path }) => path)).toContain(required);
    expect(root.packageManager).toBe(factory.packageManager);
    expect(root.devDependencies).toEqual(factory.devDependencies);
  });

  it("executes fake create, list, and read with workspace isolation", async () => {
    const { createFakeRecordAdapter } = (await import(
      sourceModule("apps/web/src/adapters/records/fake.ts")
    )) as {
      readonly createFakeRecordAdapter: () => {
        readonly list: (workspaceId: string) => Promise<readonly unknown[]>;
        readonly read: (workspaceId: string, id: string) => Promise<unknown>;
        readonly create: (input: {
          readonly workspaceId: string;
          readonly title: string;
          readonly detail: string;
        }) => Promise<{ readonly id: string }>;
      };
    };
    const adapter = createFakeRecordAdapter();
    expect(await adapter.list("workspace_a")).toEqual([]);
    const created = await adapter.create({
      workspaceId: "workspace_a",
      title: "First record",
      detail: "Created without provider setup.",
    });
    expect(await adapter.list("workspace_a")).toEqual([created]);
    expect(await adapter.read("workspace_a", created.id)).toEqual(created);
    expect(await adapter.list("workspace_b")).toEqual([]);
    expect(await adapter.read("workspace_b", created.id)).toBeNull();
  });

  it("presents loading, empty, error, list, detail, and create states", async () => {
    const { presentRecords } = (await import(
      sourceModule("apps/web/src/features/records/model.ts")
    )) as {
      readonly presentRecords: (state: {
        readonly status: string;
        readonly [key: string]: unknown;
      }) => { readonly status: string };
    };
    const record = {
      id: "record_1",
      workspaceId: "workspace_a",
      title: "First record",
      detail: "Readable detail",
      createdAt: 1,
      updatedAt: 1,
    };
    const states = [
      { status: "loading" as const },
      { status: "empty" as const },
      { status: "error" as const, message: "Unavailable" },
      { status: "list" as const, records: [record] },
      { status: "detail" as const, record },
      { status: "create" as const },
    ];
    expect(states.map((state) => presentRecords(state).status)).toEqual([
      "loading",
      "empty",
      "error",
      "list",
      "detail",
      "create",
    ]);
  });

  it("enumerates every dry-run target and collision without mutation", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-saas-blueprint-"));
    try {
      const initial = runGeneratorCli(
        ["quickstart", "--blueprint", "saas-application", "--name", "My App"],
        cwd,
      );
      expect(initial.exitCode).toBe(0);
      const preview = JSON.parse(initial.stdout);
      expect(preview.targets).toEqual(
        preview.files.map((file: { path: string }) => file.path),
      );
      expect(preview.collisions).toEqual([]);

      const occupied = preview.targets[4] as string;
      const occupiedPath = join(cwd, occupied);
      mkdirSync(dirname(occupiedPath), { recursive: true });
      writeFileSync(occupiedPath, "owned\n");
      const collided = JSON.parse(
        runGeneratorCli(
          ["quickstart", "--blueprint", "saas-application", "--name", "My App"],
          cwd,
        ).stdout,
      );
      expect(collided.collisions).toEqual([occupied]);
      const refused = runGeneratorCli(
        [
          "quickstart",
          "--blueprint",
          "saas-application",
          "--name",
          "My App",
          "--write",
        ],
        cwd,
      );
      expect(refused).toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining("Refusing to overwrite"),
      });
      expect(readFileSync(occupiedPath, "utf8")).toBe("owned\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes every executable source target into a separate empty target", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-saas-write-"));
    try {
      const result = runGeneratorCli(
        [
          "quickstart",
          "--blueprint",
          "saas-application",
          "--name",
          "My App",
          "--write",
        ],
        cwd,
      );
      expect(result.exitCode).toBe(0);
      const written = JSON.parse(result.stdout);
      for (const path of written.targets as readonly string[]) {
        expect(readFileSync(join(cwd, path), "utf8")).toBe(
          written.files.find((file: { path: string }) => file.path === path)
            ?.content,
        );
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("discriminates legacy workflow-backed and SaaS workflow-optional output", () => {
    const quickstart: WorkflowOptionalTemplateQuickstart =
      buildTemplateQuickstart({
        blueprint: "saas-application",
        name: "My App",
        generatedAt: "2026-07-25T00:00:00.000Z",
      });
    expect(quickstart).toMatchObject({
      blueprint: "saas-application",
      firstCapability: null,
      firstWorkflow: null,
      firstAgent: null,
    });
    expect(quickstart.instance.modules).toEqual([
      "workspace",
      "records",
      "web",
      "api",
      "cli",
    ]);
    expect(quickstart.nextCommands).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/workflow|agent|mcp|provider/i),
      ]),
    );
    expect(quickstart.nextCommands).toEqual([
      'pnpm maestro -- create ../my-app --name "My App" --outcome "Create and review records" --write',
      "pnpm --dir ../my-app maestro -- start --mode fake",
    ]);
    const legacyIds = [
      "source-grounded-gtm-brain",
      "gtm-implementation",
    ] as const;
    for (const blueprint of legacyIds) {
      const legacy: WorkflowBackedTemplateQuickstart = buildTemplateQuickstart({
        blueprint,
        generatedAt: "2026-07-25T00:00:00.000Z",
      });
      expect(legacy.firstCapability).toEqual(expect.any(String));
      expect(legacy.firstWorkflow).toEqual(expect.any(String));
      expect(legacy.firstAgent).toEqual(expect.any(String));
      expect(legacy).not.toHaveProperty("targets");
      expect(legacy).not.toHaveProperty("collisions");
      expectTypeOf(legacy.firstWorkflow).toEqualTypeOf<string>();
    }
  });
});
