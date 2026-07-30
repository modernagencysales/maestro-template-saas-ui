import type { GeneratedFile } from "../index";
import { readFileSync } from "node:fs";
import { buildSaasApplicationFiles } from "./saasApplication";
import { buildSaasRegistrationProjections } from "./saasRegistrationProjections";

const RECORDS_SURFACE = "apps/web/src/features/records/records-surface.tsx";
const CURRENT_CUSTOMER_SOURCE_PROJECTIONS = [
  "packages/template-core/src/templateInstance/templateInstance.test.ts",
  "packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json",
  "packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts",
  "tooling/generators/src/crud-proof.test.ts",
  "tooling/quality/src/env-manifest.test.mts",
] as const;

const currentCustomerSource = (
  path: (typeof CURRENT_CUSTOMER_SOURCE_PROJECTIONS)[number],
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
  }
  return content;
};

const currentCustomerSourceProjections = (): readonly GeneratedFile[] =>
  CURRENT_CUSTOMER_SOURCE_PROJECTIONS.map((path) => ({
    path,
    content: currentCustomerSource(path),
  }));

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
        "apps/web/src/features/records/model.ts",
        "apps/web/src/features/records/records-surface.tsx",
        "apps/web/src/screens/records-screen.tsx",
        "apps/web/src/routes/_workspace.records.tsx",
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
    if (file.path !== RECORDS_SURFACE) return file;
    const search = "templateConfectRefs.public.records.";
    if (!file.content.includes(search))
      throw new Error("SaaS records surface ref projection marker is missing");
    return {
      ...file,
      content: file.content.replaceAll(
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
  ...buildSaasRegistrationProjections(),
  ...currentCustomerSourceProjections(),
  recordsFeatureProvenance(),
];

/** Historical projection used only to reproduce the immutable alpha.1 plan. */
export const buildAlpha1SaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...buildSaasApplicationFiles(options),
  ...buildSaasRegistrationProjections({ current: false }),
];
