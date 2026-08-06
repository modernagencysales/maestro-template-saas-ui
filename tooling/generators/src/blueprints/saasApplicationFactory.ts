import type { GeneratedFile } from "../index";
import { readFileSync } from "node:fs";
import { buildSaasApplicationFiles } from "./saasApplication";
import {
  buildSaasRegistrationProjections,
  CURRENT_FACTORY_PRODUCT_TABLES,
} from "./saasRegistrationProjections";

const CURRENT_CUSTOMER_SOURCE_PROJECTIONS = [
  "Justfile",
  "apps/web/src/adapters/confect-generated-refs.test.ts",
  "docs/template/env-manifest.json",
  "docs/template/env-manifest.md",
  "docs/template/operations-runbook.md",
  "packages/template-core/src/templateInstance/templateInstance.test.ts",
  "packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json",
  "packages/template-core/src/generated/confectManifest.ts",
  "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts",
  "packages/convex/test/shared-env.test.ts",
  "tooling/generators/src/crud-proof.test.ts",
  "tooling/app-map/src/composition.test.ts",
  "tooling/app-map/src/composition.ts",
  "tooling/app-map/src/schema.ts",
  "tooling/quality/src/env-manifest.test.mts",
] as const;

const FACTORY_PRODUCT_TABLES = new Set<string>(CURRENT_FACTORY_PRODUCT_TABLES);
const CURRENT_CUSTOMER_EMAIL_TABLES = [
  "emailCampaigns",
  "emailDeliveries",
  "emailSubscribers",
] as const;

const currentCustomerSource = (
  path: (typeof CURRENT_CUSTOMER_SOURCE_PROJECTIONS)[number],
): string => {
  let content = readFileSync(
    new URL(`../../../../${path}`, import.meta.url),
    "utf8",
  );
  if (path === "Justfile") {
    const factoryOnlyRecipes = [
      `test-pr-backlog:
    pnpm test:pr-backlog

evals:
    pnpm evals

`,
      `check-workflow-output-smoke:
    pnpm template:workflow-output-smoke

`,
      `mutation:
    bash tooling/ci/mutation.sh

`,
    ] as const;
    for (const recipe of factoryOnlyRecipes) {
      if (!content.includes(recipe))
        throw new Error(
          "customer Justfile factory-only recipe marker is missing",
        );
      content = content.replace(recipe, "");
    }
  }
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
  if (path === "apps/web/src/adapters/confect-generated-refs.test.ts") {
    const replacements = [
      [
        'import type { InvokeReturn, ReactMutation } from "@confect/react";',
        'import type { ReactMutation } from "@confect/react";',
      ],
      [
        "  useTemplateAction,\n  useTemplateMutation,",
        "  useTemplateMutation,",
      ],
      [
        'type EvaluateAppIdeaWithModelRef =\n  TemplateConfectRefs["public"]["capabilities"]["evaluateAppIdea"]["evaluateAppIdeaWithModel"];\n',
        "",
      ],
      [
        "type TemplateActionResult<Action extends Ref.AnyPublicAction> = ReturnType<\n  typeof useTemplateAction<Action>\n>;\n",
        "",
      ],
    ] as const;
    for (const [search, replacement] of replacements) {
      if (!content.includes(search))
        throw new Error("customer generated refs evaluator marker is missing");
      content = content.replace(search, replacement);
    }
    const evaluatorTestStart = content.indexOf(
      '  it("infers generated action args, results, and typed failures"',
    );
    if (evaluatorTestStart < 0 || !content.endsWith("});\n"))
      throw new Error(
        "customer generated refs evaluator test marker is missing",
      );
    content = `${content.slice(0, evaluatorTestStart)}});\n`;
  }
  if (path === "packages/template-core/src/generated/confectManifest.ts") {
    content = content
      .split("\n")
      .filter((line) => {
        const table = /^"([^"]+)",$/.exec(line.trim())?.[1];
        return (
          table === undefined ||
          (!FACTORY_PRODUCT_TABLES.has(table) &&
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
    const tableBoundary = /^(\s*)"transformBlocks",$/gmu;
    const matches = [...content.matchAll(tableBoundary)];
    if (matches.length !== 4)
      throw new Error("customer Confect manifest table markers are missing");
    content = content.replace(
      tableBoundary,
      '$1"records",\n$1"transformBlocks",',
    );
  }
  return content;
};

const currentCustomerSourceProjections = (): readonly GeneratedFile[] =>
  CURRENT_CUSTOMER_SOURCE_PROJECTIONS.map((path) => ({
    path,
    content: currentCustomerSource(path),
  }));

const currentContractFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => {
  const name = options.name.trim() || "My App";
  const firstOutcome = (
    options.firstOutcome?.trim() || "Create and review records"
  ).replace(/\s+/gu, " ");
  return [
    ...[
      "apps/web/src/adapters/records/http.ts",
      "features/records.feature",
      "features/step_definitions/records.steps.ts",
    ].map((path) => ({
      path,
      content: readFileSync(
        new URL(
          `../../../../examples/saas-application/seed/source/${path}`,
          import.meta.url,
        ),
        "utf8",
      ),
    })),
    {
      path: "features/first-outcome.feature",
      content: `@wip
Feature: ${firstOutcome}
  This is the first product promise for ${name}.

  @cross_surface
  Scenario: Deliver ${firstOutcome.toLowerCase()}
    Given the product is ready
    When the first outcome is completed
    Then ${firstOutcome.toLowerCase()} is observable in the app and CLI
`,
    },
  ];
};

const recordsFeatureProvenance = (): GeneratedFile => ({
  path: "docs/template/generated/provenance/add-feature/records.json",
  content: `${JSON.stringify(
    {
      generator: "add-feature",
      commandFamily: "template:add-feature",
      name: "records",
      ownership: { system: "knowledge-brain", disposition: "extend" },
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
        "apps/web/src/routes/_workspace.records.tsx",
        "features/records.feature",
        "features/step_definitions/records.steps.ts",
      ],
    },
    null,
    2,
  )}\n`,
});

const currentSaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] =>
  buildSaasApplicationFiles(options).map((file) => {
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
}): readonly GeneratedFile[] => [
  ...currentSaasApplicationFiles(options),
  ...currentContractFiles(options),
  ...buildSaasRegistrationProjections(),
  ...currentCustomerSourceProjections(),
  recordsFeatureProvenance(),
];

/** Historical projection used only to reproduce the immutable alpha.1 plan. */
export const buildAlpha1SaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...buildSaasApplicationFiles(options).map((file) =>
    file.path ===
    "generated/blueprints/saas-application/application-contract.json"
      ? {
          ...file,
          content: file.content.replace(
            "packages/convex/confect/records.{spec,impl}.ts",
            "packages/convex/confect/records/*",
          ),
        }
      : file,
  ),
  ...buildSaasRegistrationProjections({ current: false }),
];
