import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDirectRun } from "../quality/src/direct-run.mts";

export const CUCUMBER_CONFIGURATION_SOURCE = `module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};
`;

export type CheckedCucumberConfiguration = {
  readonly requireModule: readonly ["tsx/cjs"];
  readonly require: readonly [
    "features/support/**/*.ts",
    "features/step_definitions/**/*.ts",
  ];
  readonly retry: 0;
  readonly parallel: 0;
};

const checkedConfiguration: CheckedCucumberConfiguration = {
  requireModule: ["tsx/cjs"],
  require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
  retry: 0,
  parallel: 0,
};

export function validateCucumberConfigurationSource(
  source: string,
):
  | { readonly ok: true; readonly value: CheckedCucumberConfiguration }
  | { readonly ok: false; readonly findings: readonly string[] } {
  if (source === CUCUMBER_CONFIGURATION_SOURCE) {
    return { ok: true, value: checkedConfiguration };
  }
  return {
    ok: false,
    findings: [
      `cucumber.cjs must byte-match the protected four-key profile; received:\n${source}`,
    ],
  };
}

const expectedVersions = {
  "@cucumber/cucumber": "13.2.0",
  "@cucumber/gherkin": "41.0.0",
  "@cucumber/messages": "34.0.1",
} as const;

const dependencyVersion = (
  manifest: unknown,
  section: "dependencies" | "devDependencies",
  name: string,
): unknown => {
  if (typeof manifest !== "object" || manifest === null) return undefined;
  const dependencies = (manifest as Record<string, unknown>)[section];
  if (typeof dependencies !== "object" || dependencies === null)
    return undefined;
  return (dependencies as Record<string, unknown>)[name];
};

export function validateCucumberPackageVersions(
  rootManifest: unknown,
  templateCoreManifest: unknown,
):
  | { readonly ok: true; readonly versions: typeof expectedVersions }
  | { readonly ok: false; readonly findings: readonly string[] } {
  const actual = {
    "@cucumber/cucumber": dependencyVersion(
      rootManifest,
      "devDependencies",
      "@cucumber/cucumber",
    ),
    "@cucumber/gherkin": dependencyVersion(
      templateCoreManifest,
      "dependencies",
      "@cucumber/gherkin",
    ),
    "@cucumber/messages": dependencyVersion(
      templateCoreManifest,
      "dependencies",
      "@cucumber/messages",
    ),
  };
  const findings = Object.entries(expectedVersions).flatMap(
    ([name, expected]) =>
      actual[name as keyof typeof actual] === expected
        ? []
        : [
            `${name} must be pinned as ${expected} in its owning manifest; received ${String(actual[name as keyof typeof actual])}`,
          ],
  );
  return findings.length === 0
    ? { ok: true, versions: expectedVersions }
    : { ok: false, findings };
}

async function main(): Promise<void> {
  const [source, rootSource, templateCoreSource] = await Promise.all([
    readFile(resolve("cucumber.cjs"), "utf8"),
    readFile(resolve("package.json"), "utf8"),
    readFile(resolve("packages/template-core/package.json"), "utf8"),
  ]);
  const configuration = validateCucumberConfigurationSource(source);
  const versions = validateCucumberPackageVersions(
    JSON.parse(rootSource),
    JSON.parse(templateCoreSource),
  );
  const findings = [
    ...(configuration.ok ? [] : configuration.findings),
    ...(versions.ok ? [] : versions.findings),
  ];
  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Cucumber contracts OK: ${Object.entries(versions.versions)
      .map(([name, version]) => `${name}@${version}`)
      .join(
        ", ",
      )}; keys=${Object.keys(configuration.value).join(",")}; require=${configuration.value.require.join(",")}`,
  );
}

if (isDirectRun(import.meta.url)) {
  await main();
}
