import { readFileSync } from "node:fs";

const EXPECTED_CONFIG = `module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};\n`;

const EXPECTED_PACKAGES = {
  "@cucumber/cucumber": "13.2.0",
  "@cucumber/gherkin": "41.0.0",
  "@cucumber/messages": "34.0.1",
} as const;

export function validateCucumberContracts(
  configSource: string,
  packages: Readonly<Record<string, string>>,
): string[] {
  const findings =
    configSource === EXPECTED_CONFIG
      ? []
      : ["cucumber.cjs differs from the pinned deterministic configuration"];
  for (const [name, version] of Object.entries(EXPECTED_PACKAGES)) {
    if (packages[name] !== version)
      findings.push(`${name} must be pinned to ${version}`);
  }
  return findings;
}

function main(): void {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  const findings = validateCucumberContracts(
    readFileSync("cucumber.cjs", "utf8"),
    manifest.devDependencies ?? {},
  );
  if (findings.length > 0) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("check-contracts.mts")) main();
