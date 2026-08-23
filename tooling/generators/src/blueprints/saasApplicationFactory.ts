import type { GeneratedFile } from "../index";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  renderProductContractJsonSchema,
  renderProductContractMarkdown,
  validateProductContract,
  type ProductContract,
} from "@maestro-template/template-core";
import { resolve } from "node:path";
import {
  buildCurrentRecordsExampleFiles,
  buildCurrentSaasApplicationChassisFiles,
  buildSaasApplicationFiles,
} from "./saasApplication";
import {
  isObsoleteFrontendAuthority,
  saasFrontendFoundationFiles,
} from "./saasFrontendFoundation";
import {
  selectsSaasApplicationPattern,
  type SaasApplicationPatternSelection,
} from "./saasApplicationPatterns";
import {
  buildSaasRegistrationProjections,
  CURRENT_FACTORY_PRODUCT_TABLES,
  currentSource,
  projectCurrentRecordsRouteTree,
} from "./saasRegistrationProjections";

const CURRENT_CUSTOMER_SOURCE_PROJECTIONS = [
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
  "eslint.config.mjs",
  "tooling/eslint-plugin-template/index.mjs",
  "tooling/eslint-plugin-template/rules/acceptance-boundary.mjs",
  "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
  "tooling/quality/src/env-manifest.test.mts",
] as const;

const STARTER_RECEIPT_PATH = "docs/template/saas-ui-starter-files.json";

const bindStarterReceiptToGeneratedFiles = (
  files: readonly GeneratedFile[],
): readonly GeneratedFile[] => {
  const generatedByPath = new Map(files.map((file) => [file.path, file]));
  return files.map((file) => {
    if (file.path !== STARTER_RECEIPT_PATH) return file;
    const receipt = JSON.parse(file.content) as {
      readonly files: readonly (Record<string, unknown> & {
        readonly destination?: unknown;
      })[];
    };
    return {
      ...file,
      content: `${JSON.stringify(
        {
          ...receipt,
          files: receipt.files.map((entry) => {
            if (typeof entry.destination !== "string") return entry;
            const generated = generatedByPath.get(entry.destination);
            return generated === undefined
              ? entry
              : {
                  ...entry,
                  sha256: createHash("sha256")
                    .update(generated.content)
                    .digest("hex"),
                };
          }),
        },
        null,
        2,
      )}\n`,
    };
  });
};

const bindRecordsContractToFrontendRefs = (
  files: readonly GeneratedFile[],
  selected: boolean,
): readonly GeneratedFile[] =>
  selected
    ? files.map((file) =>
        file.path === "packages/convex/src/refs.ts"
          ? {
              ...file,
              content: file.content
                .replace(
                  'import connections from "../confect/integrations/connections.spec";',
                  'import connections from "../confect/integrations/connections.spec";\nimport records from "../confect/records/records.spec";',
                )
                .replace(
                  'GroupSpec.makeAt("integrations").addGroupAt("connections", connections),\n  );',
                  'GroupSpec.makeAt("integrations").addGroupAt("connections", connections),\n  )\n  .addAt("records", GroupSpec.makeAt("records").addGroupAt("records", records));',
                ),
            }
          : file,
      )
    : files;

const customerSourcePath = (path: string): string =>
  path === "packages/convex/confect/workflows/_generated/workflowRegistry.ts"
    ? `const definePublicationRegistry = <const Registry>(\n  registry: Registry,\n): Registry => registry;\n\nexport const workflowPublicationRegistry = definePublicationRegistry({\n  capabilities: [],\n  workflows: [],\n});\n`
    : readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");

const FACTORY_PRODUCT_TABLES = new Set<string>(CURRENT_FACTORY_PRODUCT_TABLES);
const CURRENT_CUSTOMER_EMAIL_TABLES = [
  "emailCampaigns",
  "emailDeliveries",
  "emailSubscribers",
] as const;

const currentCustomerSource = (
  path: (typeof CURRENT_CUSTOMER_SOURCE_PROJECTIONS)[number],
  selection: SaasApplicationPatternSelection,
  // eslint-disable-next-line complexity -- AP-008 tracks splitting path-specific compatibility projections.
): string => {
  let content = customerSourcePath(path);
  if (
    (path === "docs/template/generated/workflow-semantics.md" ||
      path.startsWith("tooling/eslint-plugin-template/rules/")) &&
    !selectsSaasApplicationPattern(selection, "workflow-automation")
  )
    content = content.replaceAll(
      "pnpm check:workflow:fast",
      "the workflow semantic check",
    );
  if (
    path === "docs/template/generated/workflow-semantics.md" ||
    path.startsWith("tooling/eslint-plugin-template/rules/")
  )
    content = content.replaceAll(
      "pnpm check:workflow:fast.",
      "pnpm check:workflow:fast",
    );
  if (path === "tooling/generators/src/crud-proof.test.ts") {
    const factoryFixture =
      "examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts";
    if (!content.includes(factoryFixture))
      throw new Error("customer CRUD proof fixture marker is missing");
    content = content.replaceAll(
      factoryFixture,
      "apps/web/src/adapters/records/fake.ts",
    );
  }
  if (path === "tooling/quality/src/env-manifest.test.mts") {
    const factoryGenerator = "tooling/generators/src/index.ts";
    if (!content.includes(factoryGenerator))
      throw new Error("customer env-manifest generator marker is missing");
    content = content.replace(
      factoryGenerator,
      "tooling/generators/src/customer-runtime.ts",
    );
    const fsImport = 'import { readFileSync } from "node:fs";';
    if (!content.includes(fsImport))
      throw new Error("customer env-manifest fs import marker is missing");
    content = content.replace(
      fsImport,
      'import { existsSync, readFileSync } from "node:fs";',
    );
    const factoryPipelineAssertion = `    const pipeline = readText(".woodpecker/deploy.yml");
    expect(pipeline).not.toContain(
      "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL",
    );
    expect(pipeline).not.toContain("PROMOTION_AUTHORITY_MODE");`;
    if (!content.includes(factoryPipelineAssertion))
      throw new Error(
        "customer env-manifest pipeline assertion marker is missing",
      );
    content = content.replace(
      factoryPipelineAssertion,
      `    expect(
      existsSync(resolve(repoRoot, ".woodpecker/deploy.yml")),
    ).toBe(false);`,
    );
  }
  if (path === "packages/convex/test/shared-env.test.ts") {
    const evaluatorImport =
      'import { loadLlmGatewayEnvConfig } from "../confect/evaluator/providerConfig";\n';
    if (!content.includes(evaluatorImport))
      throw new Error("customer shared env evaluator import marker is missing");
    content = content.replace(evaluatorImport, "");
    const evaluatorTestStart = content.indexOf(
      '  it("loads the allowlisted LLM gateway environment through Effect config"',
    );
    const retainedTestStart = content.indexOf(
      '  it("loads fake localhost defaults when no provider values are set"',
      evaluatorTestStart,
    );
    if (evaluatorTestStart < 0 || retainedTestStart <= evaluatorTestStart)
      throw new Error("customer shared env evaluator test markers are missing");
    content = `${content.slice(0, evaluatorTestStart)}${content.slice(retainedTestStart)}`;
  }
  if (path === "packages/template-core/src/generated/confectManifest.ts") {
    content = content
      .split("\n")
      .filter((line) => {
        const table = /^"([^"]+)",$/.exec(line.trim())?.[1];
        return (
          table === undefined ||
          (!FACTORY_PRODUCT_TABLES.has(table) &&
            (selectsSaasApplicationPattern(selection, "workflow-automation") ||
              !table.startsWith("workflow")) &&
            !CURRENT_CUSTOMER_EMAIL_TABLES.includes(
              table as (typeof CURRENT_CUSTOMER_EMAIL_TABLES)[number],
            ))
        );
      })
      .join("\n");
    const emailTableBoundary = /^(\s*)"entitlements",$/gmu;
    const emailTableMatches = [...content.matchAll(emailTableBoundary)];
    if (emailTableMatches.length !== 4)
      throw new Error(
        "customer Confect manifest email table markers are missing",
      );
    content = content.replace(
      emailTableBoundary,
      `$1${CURRENT_CUSTOMER_EMAIL_TABLES.map((table) => `"${table}",`).join(
        "\n$1",
      )}\n$1"entitlements",`,
    );
    if (selectsSaasApplicationPattern(selection, "records-example")) {
      const tableBoundary = /^(\s*)"transformBlocks",$/gmu;
      const matches = [...content.matchAll(tableBoundary)];
      if (matches.length !== 4)
        throw new Error("customer Confect manifest table markers are missing");
      content = content.replace(
        tableBoundary,
        '$1"records",\n$1"transformBlocks",',
      );
    }
  }
  return content;
};

const currentCustomerSourceProjections = (
  selection: SaasApplicationPatternSelection,
): readonly GeneratedFile[] =>
  CURRENT_CUSTOMER_SOURCE_PROJECTIONS.filter(
    (path) =>
      (selectsSaasApplicationPattern(selection, "records-example") ||
        path !== "tooling/generators/src/crud-proof.test.ts") &&
      (selectsSaasApplicationPattern(selection, "workflow-automation") ||
        !path.startsWith("packages/convex/confect/workflows/") ||
        path ===
          "packages/convex/confect/workflows/_generated/workflowRegistry.ts"),
  ).map((path) => ({
    path,
    content: currentCustomerSource(path, selection),
  }));

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/(^-|-$)/gu, "") || "my-app";

const currentContractFiles = (
  options: {
    readonly name: string;
    readonly firstOutcome?: string;
  } & SaasApplicationPatternSelection,
): readonly GeneratedFile[] => {
  const name = options.name.trim() || "My App";
  const productId = slugify(name);
  const firstOutcome = (
    options.firstOutcome?.trim() || "Deliver the first customer outcome"
  ).replace(/\s+/gu, " ");
  const sourceContract = validateProductContract(
    parseYaml(
      readFileSync(
        new URL(
          "../../../../examples/saas-application/seed/source/product.contract.yaml",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const contract: ProductContract = selectsSaasApplicationPattern(
    options,
    "records-example",
  )
    ? {
        ...sourceContract,
        product: { ...sourceContract.product, id: productId, name },
      }
    : {
        schemaVersion: 1,
        product: {
          id: productId,
          name,
          summary: `The first product promise for ${name}.`,
        },
        behaviors: [
          {
            id: "BHV-OUTCOME-001",
            revision: 1,
            status: "draft",
            title: firstOutcome,
            actor: "workspace member",
            surfaces: ["web-ui"],
            preconditions: [],
            action: `The member completes ${firstOutcome.toLowerCase()}.`,
            outcomes: [`${firstOutcome} is observable in the app.`],
          },
        ],
      };
  const links = contract.behaviors.map((behavior) => ({
    behaviorId: behavior.id,
    planPaths: selectsSaasApplicationPattern(options, "records-example")
      ? ["docs/product/records-plan.md"]
      : [],
    appMapTargets: selectsSaasApplicationPattern(options, "records-example")
      ? ["route:$workspace/records", "headless:records-api"]
      : [],
    acceptancePaths: selectsSaasApplicationPattern(options, "records-example")
      ? ["records.spec.ts"]
      : [],
  }));
  const recordsFiles = selectsSaasApplicationPattern(options, "records-example")
    ? [
        "docs/product/records-plan.md",
        "tests/acceptance/records.spec.ts",
        "tests/acceptance/support/fixtures.ts",
        "tests/acceptance/support/runtime.ts",
      ].map((path) => ({
        path,
        content: readFileSync(
          new URL(
            `../../../../examples/saas-application/seed/source/${path}`,
            import.meta.url,
          ),
          "utf8",
        ),
      }))
    : [];
  return [
    {
      path: "product.contract.yaml",
      content: stringifyYaml(contract),
    },
    {
      path: "product.contract.schema.json",
      content: renderProductContractJsonSchema(),
    },
    {
      path: "docs/template/generated/product-contract.md",
      content: renderProductContractMarkdown({ contract, links }),
    },
    {
      path: "playwright.acceptance.config.ts",
      content: readFileSync(
        new URL(
          "../../../../examples/saas-application/seed/source/playwright.acceptance.config.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    },
    {
      path: "tooling/acceptance/checkout-state.mts",
      content: readFileSync(
        new URL(
          "../../../../tooling/acceptance/checkout-state.mts",
          import.meta.url,
        ),
        "utf8",
      ),
    },
    {
      path: "tooling/acceptance/product-contract.mts",
      content: readFileSync(
        new URL(
          "../../../../tooling/acceptance/product-contract.mts",
          import.meta.url,
        ),
        "utf8",
      ),
    },
    {
      path: "tooling/acceptance/run-acceptance.mts",
      content: readFileSync(
        new URL(
          "../../../../tooling/acceptance/run-acceptance.mts",
          import.meta.url,
        ),
        "utf8",
      ),
    },
    {
      path: "tooling/acceptance/playwright-report.mts",
      content: readFileSync(
        new URL(
          "../../../../tooling/acceptance/playwright-report.mts",
          import.meta.url,
        ),
        "utf8",
      ),
    },
    ...recordsFiles,
    ...(selectsSaasApplicationPattern(options, "records-example")
      ? ["apps/web/src/adapters/records/http.ts"].map((path) => ({
          path,
          content: readFileSync(
            new URL(
              `../../../../examples/saas-application/seed/source/${path}`,
              import.meta.url,
            ),
            "utf8",
          ),
        }))
      : []),
  ];
};

const recordsFeatureProvenance = (): GeneratedFile => ({
  path: "docs/template/generated/provenance/add-feature/records.json",
  content: `${JSON.stringify(
    {
      generator: "add-feature",
      commandFamily: "template:add-feature",
      name: "$workspace/records",
      ownership: { system: "record-management", disposition: "extend" },
      generatedPaths: [
        "packages/convex/confect/tables/records.ts",
        "packages/convex/confect/records/records.spec.ts",
        "packages/convex/confect/records/records.impl.ts",
        "apps/web/src/adapters/records/contract.ts",
        "apps/web/src/adapters/records/fake.ts",
        "apps/web/src/adapters/records/http.ts",
        "apps/web/src/features/records/model.ts",
        "apps/web/src/features/records/records-surface.tsx",
        "apps/web/src/screens/records-screen.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
        "product.contract.yaml",
        "product.contract.schema.json",
        "docs/template/generated/product-contract.md",
        "playwright.acceptance.config.ts",
        "tests/acceptance/records.spec.ts",
        "tests/acceptance/support/fixtures.ts",
        "tests/acceptance/support/runtime.ts",
      ],
    },
    null,
    2,
  )}\n`,
});

const neutralWorkflowCommandReplacements: Readonly<
  Record<string, readonly (readonly [string, string])[]>
> = {
  ".agents/skills/maestro/references/workflow-authoring.md": [
    [
      "Run\n`pnpm check:workflow:fast` before broader verification.",
      "Select the\n`workflow-automation` pattern before authoring workflow graphs.",
    ],
  ],
  "AGENTS.md": [
    [
      "- Run `pnpm check:workflow:fast` while authoring. Semantic diagnostics include a\n  stable rule id, reason, repair, and rerun command. The generated support\n  ledger is\n  [workflow-semantics.md](docs/template/generated/workflow-semantics.md).\n",
      "- Select the `workflow-automation` pattern before authoring workflows.\n",
    ],
  ],
  "docs/template/agent-worker-playbook.md": [
    ["- `pnpm check:workflow-graph-boundary`\n", ""],
  ],
  "tooling/generators/src/customer-dispatcher.ts": [
    [
      'focusedGates: ["pnpm check:workflow-graph-boundary"],',
      'focusedGates: ["pnpm check:confect-contracts"],',
    ],
  ],
  "tooling/generators/src/customer-runtime.ts": [
    ['  "pnpm check:workflow-graph-boundary",\n', ""],
    [
      "5. Run \\`pnpm confect:codegen\\`, \\`pnpm check:workflow-graph-boundary\\`, and focused workflow tests.",
      "5. Run \\`pnpm confect:codegen\\` and focused workflow tests after selecting workflow automation.",
    ],
    [
      '"Run pnpm check:workflow-graph-boundary and focused workflow tests.",',
      '"Select workflow automation before running focused workflow tests.",',
    ],
  ],
  "tooling/generators/src/private-package.ts": [
    ['            "pnpm check:workflow-graph-boundary",\n', ""],
  ],
};

const customerDocumentationCommandReplacements: Readonly<
  Record<string, readonly (readonly [string, string])[]>
> = {
  "docs/template/client-intake-wizard.md": [
    [
      '`pnpm template:intake -- --name "Client Brain" --write` creates\n`docs/template/generated/client-intake.md` and updates `template-instance.json`\nwith an `intake` block.',
      "The factory records reviewed intake before generating a customer target.\nGenerated targets retain that accepted intake in `template-instance.json`.",
    ],
    ['pnpm template:intake -- --name "Client Brain" --write\n', ""],
  ],
  "docs/template/env-manifest.md": [
    [
      "`pnpm deploy:doctor` reads `project.config.json` and",
      "The factory deployment doctor reads `project.config.json` and",
    ],
  ],
  "docs/template/how-to-add-notification.md": [
    [
      "Use the notification generator:",
      "Use the emitted feature generator to extend the canonical notification system:",
    ],
    [
      "pnpm template:add-notification -- --name workflowCompleted",
      "pnpm template:add-feature -- --name workflow-completed-notification --system notifications --disposition extend",
    ],
  ],
  "docs/template/operations-runbook.md": [
    [
      "5. Run `pnpm build` and `pnpm smoke:web-static`.",
      "5. Run `pnpm build` and the deployment owner's static smoke.",
    ],
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
  ],
  "docs/template/saas-ui-golden-review.md": [
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
  ],
  "docs/template/investor-reviewer-packet.md": [
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
  ],
  "docs/template/hosting.md": [
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
  ],
  "docs/template/golden-path-business-slice.md": [
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
  ],
  "docs/template/reviewer-guide.md": [
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
  ],
  "docs/template/template-maturity-model.md": [
    ["pnpm smoke:starter-route-parity", "pnpm check:saas-ui-foundation"],
    ["`pnpm review:completion`.", "`pnpm review:contract`."],
    ["`pnpm evals`.", "`pnpm test`."],
    ["`pnpm deploy:doctor`.", "`pnpm verify`."],
    [
      "**Required commands:** `pnpm template:doctor -- --mode live`,\n`pnpm deploy:doctor`, `pnpm verify`, hosted smoke against the client domain, and",
      "**Required commands:** `pnpm template:doctor -- --mode live`, an external\ndeployment-authority doctor, `pnpm verify`, hosted smoke against the client\ndomain, and",
    ],
  ],
};

const applyProjectionReplacements = (
  files: readonly GeneratedFile[],
  replacementsByPath: Readonly<
    Record<string, readonly (readonly [string, string])[]>
  >,
  label: string,
): readonly GeneratedFile[] =>
  files.map((file) => {
    const replacements = replacementsByPath[file.path];
    if (replacements === undefined) return file;
    let content = file.content;
    for (const [search, replacement] of replacements) {
      if (!content.includes(search))
        throw new Error(`${label} projection marker is missing: ${file.path}`);
      content = content.replace(search, replacement);
    }
    return { ...file, content };
  });

const projectWorkflowCommandReferences = (
  files: readonly GeneratedFile[],
  selection: SaasApplicationPatternSelection,
): readonly GeneratedFile[] => {
  const documented = applyProjectionReplacements(
    files,
    customerDocumentationCommandReplacements,
    "Customer documentation command",
  );
  const normalized = documented.map((file) => ({
    ...file,
    content: file.content.replaceAll(
      "pnpm check:workflow:fast.",
      "pnpm check:workflow:fast",
    ),
  }));
  if (selectsSaasApplicationPattern(selection, "workflow-automation"))
    return normalized;
  const projected = applyProjectionReplacements(
    normalized,
    neutralWorkflowCommandReplacements,
    "Neutral workflow command",
  );
  const neutralized = projected.map((file) => ({
    ...file,
    content: file.content
      .replaceAll("pnpm check:workflow:fast", "pnpm check:confect-contracts")
      .replaceAll(
        "pnpm check:workflow-semantics",
        "pnpm check:confect-contracts",
      )
      .replaceAll(
        "pnpm check:workflow-graph-boundary",
        "pnpm check:confect-contracts",
      ),
  }));
  const managedPath = ".agents/skills/maestro/references/workflow-authoring.md";
  const managed = neutralized.find(({ path }) => path === managedPath);
  const manifestPath = "docs/template/customer-context.manifest.json";
  const manifestFile = neutralized.find(({ path }) => path === manifestPath);
  if (managed === undefined || manifestFile === undefined)
    throw new Error("Neutral workflow customer-context projection is missing.");
  const manifest = JSON.parse(manifestFile.content) as {
    readonly schemaVersion: number;
    readonly files: readonly {
      readonly path: string;
      readonly sha256: string;
      readonly validation?: string;
    }[];
  };
  let synchronized = false;
  const manifestContent = `${JSON.stringify(
    {
      ...manifest,
      files: manifest.files.map((file) => {
        if (file.path !== managedPath) return file;
        synchronized = true;
        return {
          ...file,
          sha256: `sha256:${createHash("sha256")
            .update(managed.content)
            .digest("hex")}`,
        };
      }),
    },
    null,
    2,
  )}\n`;
  if (!synchronized)
    throw new Error("Neutral workflow customer-context entry is missing.");
  const manifestChecksum = `sha256:${createHash("sha256")
    .update(manifestContent)
    .digest("hex")}`;
  const checkerPath = "tooling/quality/check-customer-context.mts";
  const checker = neutralized.find(({ path }) => path === checkerPath);
  const checksumMarker = /const MANIFEST_SHA256 =\n {2}"sha256:[a-f0-9]{64}";/u;
  if (checker === undefined || !checksumMarker.test(checker.content))
    throw new Error("Neutral workflow customer-context checker is missing.");
  const checkerContent = checker.content.replace(
    checksumMarker,
    `const MANIFEST_SHA256 =\n  "${manifestChecksum}";`,
  );
  return neutralized.map((file) => {
    if (file.path === manifestPath)
      return { ...file, content: manifestContent };
    if (file.path === checkerPath) return { ...file, content: checkerContent };
    return file;
  });
};

const currentSaasApplicationFiles = (
  options: {
    readonly name: string;
    readonly firstOutcome?: string;
  } & SaasApplicationPatternSelection,
): readonly GeneratedFile[] =>
  [
    ...buildCurrentSaasApplicationChassisFiles(options),
    ...(selectsSaasApplicationPattern(options, "records-example")
      ? buildCurrentRecordsExampleFiles(options)
      : []),
  ].map((file) => {
    let content = file.content
      .replaceAll(
        "packages/convex/confect/records.spec.ts",
        "packages/convex/confect/records/records.spec.ts",
      )
      .replaceAll(
        "packages/convex/confect/records.impl.ts",
        "packages/convex/confect/records/records.impl.ts",
      );
    if (
      file.path === "packages/convex/confect/records.spec.ts" ||
      file.path === "packages/convex/confect/records.impl.ts"
    ) {
      content = content
        .replaceAll('from "./_generated/', 'from "../_generated/')
        .replaceAll('from "./errors"', 'from "../errors"')
        .replaceAll('from "./capabilities/', 'from "../capabilities/');
    }
    const path =
      file.path === "packages/convex/confect/records.spec.ts"
        ? "packages/convex/confect/records/records.spec.ts"
        : file.path === "packages/convex/confect/records.impl.ts"
          ? "packages/convex/confect/records/records.impl.ts"
          : file.path;
    if (file.path !== "apps/web/src/features/records/records-surface.tsx")
      return path === file.path && content === file.content
        ? file
        : { ...file, path, content };
    const search = "templateConfectRefs.public.records.";
    if (!content.includes(search))
      throw new Error("SaaS records surface ref projection marker is missing");
    return {
      ...file,
      path,
      content: content.replaceAll(
        search,
        "templateConfectRefs.public.records.records.",
      ),
    };
  });

/** Current/unreleased customer composition awaiting the next release candidate. */
export const buildFactorySaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
  readonly patterns?: SaasApplicationPatternSelection["patterns"];
  readonly sourceRoot?: string;
}): readonly GeneratedFile[] => {
  const sourceRoot = options.sourceRoot;
  const frontendFiles = saasFrontendFoundationFiles(
    sourceRoot === undefined
      ? currentSource
      : (path) => readFileSync(resolve(sourceRoot, path), "utf8"),
  ).map((file) =>
    file.path === "apps/web/src/routeTree.gen.ts" &&
    selectsSaasApplicationPattern(options, "records-example")
      ? { ...file, content: projectCurrentRecordsRouteTree(file.content) }
      : file,
  );
  const frontendPaths = new Set(frontendFiles.map(({ path }) => path));
  const currentFiles = currentSaasApplicationFiles(options).filter(
    ({ path }) =>
      !frontendPaths.has(path) && !isObsoleteFrontendAuthority(path),
  );
  const contractFiles = currentContractFiles(options);
  const registrationFiles = buildSaasRegistrationProjections({
    patterns: options.patterns,
  }).filter(
    ({ path }) =>
      !frontendPaths.has(path) && !isObsoleteFrontendAuthority(path),
  );
  const existingPaths = new Set(
    [...currentFiles, ...contractFiles, ...registrationFiles].map(
      ({ path }) => path,
    ),
  );
  return bindStarterReceiptToGeneratedFiles(
    bindRecordsContractToFrontendRefs(
      projectWorkflowCommandReferences(
        [
          ...currentFiles,
          ...contractFiles,
          ...registrationFiles,
          ...frontendFiles.filter(({ path }) => !existingPaths.has(path)),
          ...currentCustomerSourceProjections(options).filter(
            ({ path }) =>
              !frontendPaths.has(path) && !isObsoleteFrontendAuthority(path),
          ),
          ...(selectsSaasApplicationPattern(options, "records-example")
            ? [recordsFeatureProvenance()]
            : []),
        ].reduce<GeneratedFile[]>((files, file) => {
          const existing = files.findIndex(({ path }) => path === file.path);
          if (existing >= 0) files[existing] = file;
          else files.push(file);
          return files;
        }, []),
        options,
      ),
      selectsSaasApplicationPattern(options, "records-example"),
    ),
  );
};

/** Historical projection used only to reproduce the immutable alpha.1 plan. */
export const buildAlpha1SaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...buildSaasApplicationFiles(options).map((file) =>
    file.path === "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx"
      ? {
          ...file,
          path: "apps/web/src/routes/_workspace.records.tsx",
          content: file.content
            .replace(
              "../../../../screens/records-screen.js",
              "../screens/records-screen.js",
            )
            .replace(
              "/_app/$workspace/_dashboard/records",
              "/_workspace/records",
            ),
        }
      : file.path ===
          "generated/blueprints/saas-application/application-contract.json"
        ? {
            ...file,
            content: file.content
              .replace(
                "packages/convex/confect/records.{spec,impl}.ts",
                "packages/convex/confect/records/*",
              )
              .replace(
                "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
                "apps/web/src/routes/_workspace.records.tsx",
              ),
          }
        : file,
  ),
  ...buildSaasRegistrationProjections({ current: false }),
];
