import type { GeneratedFile } from "../index";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildCurrentRecordsExampleFiles,
  buildCurrentSaasApplicationChassisFiles,
  buildSaasApplicationFiles,
} from "./saasApplication";
import { saasFrontendFoundationFiles } from "./saasFrontendFoundation";
import {
  selectsSaasApplicationPattern,
  type SaasApplicationPatternSelection,
} from "./saasApplicationPatterns";
import {
  buildSaasRegistrationProjections,
  CURRENT_FACTORY_PRODUCT_TABLES,
  currentSource,
} from "./saasRegistrationProjections";

const CURRENT_CUSTOMER_SOURCE_PROJECTIONS = [
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
  selection: SaasApplicationPatternSelection,
  // eslint-disable-next-line complexity -- AP-008 tracks splitting path-specific compatibility projections.
): string => {
  let content = readFileSync(
    new URL(`../../../../${path}`, import.meta.url),
    "utf8",
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
        !path.startsWith("packages/convex/confect/workflows/")),
  ).map((path) => ({
    path,
    content: currentCustomerSource(path, selection),
  }));

const currentContractFiles = (
  options: {
    readonly name: string;
    readonly firstOutcome?: string;
  } & SaasApplicationPatternSelection,
): readonly GeneratedFile[] => {
  const name = options.name.trim() || "My App";
  const firstOutcome = (
    options.firstOutcome?.trim() || "Deliver the first customer outcome"
  ).replace(/\s+/gu, " ");
  return [
    ...(selectsSaasApplicationPattern(options, "records-example")
      ? [
          "apps/web/src/adapters/records/http.ts",
          "features/records.feature",
          "features/step_definitions/records.journeys.ts",
          "features/step_definitions/records.steps.ts",
          "features/support/contracts-scenario.ts",
          "features/support/contracts-runtime.ts",
          "features/support/contracts-world.ts",
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
      : []),
    {
      path: "features/first-outcome.feature",
      content: `@wip
Feature: ${firstOutcome}
  This is the first product promise for ${name}.

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
        "features/step_definitions/records.journeys.ts",
        "features/step_definitions/records.steps.ts",
        "features/support/contracts-scenario.ts",
        "features/support/contracts-runtime.ts",
        "features/support/contracts-world.ts",
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
    [
      "deployment, require `pnpm smoke:hosted`, `pnpm smoke:hosted:browser`,\n   `pnpm smoke:hosted:a11y`, and `pnpm smoke:hosted:visual`. Upload the guarded",
      "deployment, require the deployment owner's hosted liveness, browser,\n   accessibility, and visual canaries. Upload the guarded",
    ],
  ],
  "docs/template/template-maturity-model.md": [
    [
      "**Required commands:** `pnpm check:format`, `pnpm smoke:web-static`,\n`pnpm smoke:hosted:browser`, `pnpm smoke:hosted:a11y`,\n`pnpm smoke:hosted:visual`.",
      "**Required commands:** `pnpm check:format` plus deployment-owned static,\nbrowser, accessibility, and visual canaries.",
    ],
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
  if (selectsSaasApplicationPattern(selection, "workflow-automation"))
    return documented;
  const projected = applyProjectionReplacements(
    documented,
    neutralWorkflowCommandReplacements,
    "Neutral workflow command",
  );
  const managedPath = ".agents/skills/maestro/references/workflow-authoring.md";
  const managed = projected.find(({ path }) => path === managedPath);
  const manifestPath = "docs/template/customer-context.manifest.json";
  const manifestFile = projected.find(({ path }) => path === manifestPath);
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
  const checker = projected.find(({ path }) => path === checkerPath);
  const checksumMarker = /const MANIFEST_SHA256 =\n {2}"sha256:[a-f0-9]{64}";/u;
  if (checker === undefined || !checksumMarker.test(checker.content))
    throw new Error("Neutral workflow customer-context checker is missing.");
  const checkerContent = checker.content.replace(
    checksumMarker,
    `const MANIFEST_SHA256 =\n  "${manifestChecksum}";`,
  );
  return projected.map((file) => {
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
}): readonly GeneratedFile[] => {
  const currentFiles = currentSaasApplicationFiles(options);
  const contractFiles = currentContractFiles(options);
  const registrationFiles = buildSaasRegistrationProjections({
    patterns: options.patterns,
  });
  const existingPaths = new Set(
    [...currentFiles, ...contractFiles, ...registrationFiles].map(
      ({ path }) => path,
    ),
  );
  return projectWorkflowCommandReferences(
    [
      ...currentFiles,
      ...contractFiles,
      ...registrationFiles,
      ...saasFrontendFoundationFiles(currentSource).filter(
        ({ path }) => !existingPaths.has(path),
      ),
      ...currentCustomerSourceProjections(options),
      ...(selectsSaasApplicationPattern(options, "records-example")
        ? [recordsFeatureProvenance()]
        : []),
    ],
    options,
  );
};

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
