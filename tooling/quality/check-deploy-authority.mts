import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const validateDeployAuthoritySources = (input: {
  readonly scripts: Readonly<Record<string, string>>;
  readonly pipeline: string;
  readonly selfProtection: string;
}): readonly string[] => {
  const failures: string[] = [];
  for (const [name, source] of Object.entries(input.scripts)) {
    const deployOffsets = [
      ...source.matchAll(/convex deploy|pages deploy/g),
    ].map((match) => match.index ?? -1);
    if (deployOffsets.length === 0) continue;
    const gate = source.indexOf("deploy-authority-check");
    if (gate < 0 || deployOffsets.some((offset) => gate >= offset)) {
      failures.push(
        `${name}: deploy authority check must precede every deploy command`,
      );
    }
    if (
      !source.includes('"${BUILDKITE_COMMIT}"') ||
      !source.includes('"${PROMOTION_TARGET_ID}"')
    ) {
      failures.push(
        `${name}: authority check must bind exact Buildkite commit and promotion target`,
      );
    }
  }
  for (const [key, script] of [
    ["staging-deploy", "staging-deploy.sh"],
    ["production-promote", "production-promote.sh"],
  ] as const) {
    if (
      !input.pipeline.includes(`key: "${key}"`) ||
      !input.pipeline.includes(`command: ".buildkite/scripts/${script}"`)
    ) {
      failures.push(`pipeline must route ${key} through ${script}`);
    }
  }
  if (!input.pipeline.includes('depends_on: "production-approval"')) {
    failures.push(
      "production promotion must remain ordered after explicit approval",
    );
  }
  if (
    !input.pipeline.includes('key: "ci-self-protection"') ||
    !input.selfProtection.includes("check:deploy-authority")
  ) {
    failures.push(
      "secretless CI self-protection must run the deploy-authority gate",
    );
  }
  for (const secret of [
    "TEMPLATE_CLOUDFLARE_API_TOKEN",
    "TEMPLATE_CLOUDFLARE_ACCOUNT_ID",
    "TEMPLATE_CONVEX_DEPLOY_KEY",
  ]) {
    const declarations =
      input.pipeline.match(new RegExp(`^\\s+- ${secret}$`, "gm")) ?? [];
    if (declarations.length !== 2)
      failures.push(
        `${secret} must be scoped only to the two gated deploy jobs`,
      );
  }
  return failures;
};

const root = process.cwd();
const scriptsDir = resolve(root, ".buildkite/scripts");
const scripts = Object.fromEntries(
  readdirSync(scriptsDir)
    .filter((name) => name.endsWith(".sh"))
    .map((name) => [name, readFileSync(resolve(scriptsDir, name), "utf8")]),
);
const failures = validateDeployAuthoritySources({
  scripts,
  pipeline: readFileSync(resolve(root, ".buildkite/pipeline.yml"), "utf8"),
  selfProtection: readFileSync(
    resolve(scriptsDir, "ci-self-protection.sh"),
    "utf8",
  ),
});
if (failures.length > 0) throw new Error(failures.join("\n"));
console.log("check:deploy-authority passed");
