import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DeployPolicy = {
  readonly schemaVersion: 1;
  readonly primitiveOwner: string;
  readonly packageRoutes: Readonly<Record<string, string>>;
  readonly authority: {
    readonly pipelinePreflightOwner: string;
    readonly guardedDeployOwner: string;
    readonly requiredActions: readonly ["convex", "cloudflare"];
    readonly forbiddenBuildkiteEnv: readonly string[];
  };
  readonly jobs: Readonly<
    Record<
      "staging" | "production",
      {
        readonly preflight: string;
        readonly approval: string;
        readonly deploy: string;
        readonly script: string;
      }
    >
  >;
  readonly credentialSecrets: readonly string[];
};

export const deployPolicySha256 = (source: string): string =>
  `sha256:${createHash("sha256").update(source).digest("hex")}`;
export const deployTrustRootSha256 = (
  members: Readonly<Record<string, string>>,
): string => {
  const manifest = Object.keys(members)
    .sort()
    .map((path) => ({ path, sha256: deployPolicySha256(members[path] ?? "") }));
  return deployPolicySha256(JSON.stringify(manifest));
};

export const validateDeployAuthoritySources = (input: {
  readonly sources: Readonly<Record<string, string>>;
  readonly packageScripts: Readonly<Record<string, string>>;
  readonly pipeline: string;
  readonly selfProtection: string;
  readonly policySource: string;
  readonly trustMembers: Readonly<Record<string, string>>;
  readonly trustedDeployRootSha256?: string;
  readonly buildkite?: boolean;
}): readonly string[] => {
  const failures: string[] = [];
  const expectedTrustMembers = [
    "tooling/quality/check-deploy-authority.mts",
    "tooling/release/deploy-policy.json",
    "tooling/release/keys/deploy-authority-public-key.pem",
  ];
  if (
    JSON.stringify(Object.keys(input.trustMembers).sort()) !==
      JSON.stringify(expectedTrustMembers.sort()) ||
    input.trustMembers["tooling/release/deploy-policy.json"] !==
      input.policySource
  )
    failures.push(
      "deploy trust bundle must contain the exact canonical members",
    );
  let policy: DeployPolicy;
  try {
    policy = JSON.parse(input.policySource) as DeployPolicy;
  } catch {
    return ["deploy policy manifest must be valid JSON"];
  }
  if (
    policy.schemaVersion !== 1 ||
    typeof policy.primitiveOwner !== "string" ||
    !policy.packageRoutes ||
    !policy.authority ||
    policy.authority.pipelinePreflightOwner !==
      "tooling/release/src/deploy/authorityCli.ts" ||
    policy.authority.guardedDeployOwner !== policy.primitiveOwner ||
    JSON.stringify(policy.authority.requiredActions) !==
      JSON.stringify(["convex", "cloudflare"]) ||
    !Array.isArray(policy.authority.forbiddenBuildkiteEnv) ||
    !policy.jobs?.staging ||
    !policy.jobs.production ||
    !Array.isArray(policy.credentialSecrets)
  ) {
    return ["deploy policy manifest has an invalid shape"];
  }

  const actualTrustRoot = deployTrustRootSha256(input.trustMembers);
  if (input.buildkite && !input.trustedDeployRootSha256) {
    failures.push("Buildkite must provide TRUSTED_DEPLOY_ROOT_SHA256");
  } else if (
    input.trustedDeployRootSha256 !== undefined &&
    input.trustedDeployRootSha256 !== actualTrustRoot
  ) {
    failures.push(
      "trusted deploy root does not match verifier, policy, and public-key bytes",
    );
  }

  const primitiveOwners: string[] = [];
  for (const [name, source] of Object.entries(input.sources)) {
    if (!containsDeployPrimitive(source)) continue;
    primitiveOwners.push(name);
    if (name !== policy.primitiveOwner) {
      failures.push(`${name}: raw deploy primitive bypasses the guarded owner`);
    }
  }
  if (!primitiveOwners.includes(policy.primitiveOwner)) {
    failures.push(
      "guarded deploy owner must contain the only raw deploy primitives",
    );
  }
  const owner = input.sources[policy.primitiveOwner] ?? "";
  if (
    !owner.includes("await requestDurableDeployAuthorization") ||
    owner.indexOf("await requestDurableDeployAuthorization") >
      owner.indexOf("const result = spawnSync")
  ) {
    failures.push(
      "guarded deploy owner must consume durable authority before spawning",
    );
  }

  const buildkiteSources = Object.entries(input.sources)
    .filter(([name]) => name.startsWith(".buildkite/"))
    .map(([, source]) => source);
  for (const forbidden of policy.authority.forbiddenBuildkiteEnv) {
    if (
      input.pipeline.includes(forbidden) ||
      buildkiteSources.some((source) => source.includes(forbidden))
    ) {
      failures.push(
        `${forbidden} must remain authority-side and absent from Buildkite`,
      );
    }
  }

  for (const [alias, route] of Object.entries(policy.packageRoutes)) {
    if (input.packageScripts[alias] !== route) {
      failures.push(
        `${alias}: package alias must route exactly through ${route}`,
      );
    }
  }
  for (const [alias, source] of Object.entries(input.packageScripts)) {
    if (containsDeployPrimitive(source)) {
      failures.push(`${alias}: package script contains a raw deploy primitive`);
    }
  }

  for (const [environment, job] of Object.entries(policy.jobs) as [
    "staging" | "production",
    DeployPolicy["jobs"]["staging"],
  ][]) {
    const preflightCall = `${policy.authority.pipelinePreflightOwner} ${environment}`;
    if (countOccurrences(input.pipeline, preflightCall) !== 1) {
      failures.push(
        `pipeline must call the ${environment} authority preflight exactly once`,
      );
    }
    const preflight = pipelineBlock(input.pipeline, job.preflight);
    const deploy = pipelineBlock(input.pipeline, job.deploy);
    if (!preflight) {
      failures.push(`pipeline is missing ${job.preflight}`);
    } else {
      const normalizedPreflight = preflight.replace(/\s+/g, " ");
      if (!preflight.includes(`depends_on: "${job.approval}"`))
        failures.push(`${job.preflight} must depend on ${job.approval}`);
      if (!preflight.includes(preflightCall))
        failures.push(
          `${job.preflight} must call the durable authority preflight`,
        );
      if (
        !normalizedPreflight.includes(
          `${preflightCall} \${BUILDKITE_COMMIT} template-${environment} $(node scripts/_project-config.mjs get ${environment} convexUrl)`,
        )
      )
        failures.push(
          `${job.preflight} must pass the canonical ${environment} Convex URL to the durable authority preflight`,
        );
      if (preflight.includes("secrets:"))
        failures.push(`${job.preflight} must remain secretless`);
    }
    if (!deploy) {
      failures.push(`pipeline is missing ${job.deploy}`);
    } else {
      if (!deploy.includes(`depends_on: "${job.preflight}"`))
        failures.push(`${job.deploy} must depend on ${job.preflight}`);
      if (!deploy.includes(`command: "${job.script}"`))
        failures.push(`${job.deploy} must route through ${job.script}`);
      for (const secret of policy.credentialSecrets) {
        if (!deploy.includes(`- ${secret}`))
          failures.push(`${job.deploy} must retain scoped ${secret}`);
      }
    }
    const script = input.sources[job.script] ?? "";
    if (script.includes("authorityCli.ts")) {
      failures.push(`${job.script} must not consume another preflight`);
    }
    if (
      policy.authority.requiredActions.some(
        (action) =>
          countOccurrences(
            script,
            `${policy.authority.guardedDeployOwner} ${action}`,
          ) !== 1,
      )
    ) {
      failures.push(
        `${job.script} must route both provider actions through the guarded owner exactly once`,
      );
    }
  }

  for (const secret of policy.credentialSecrets) {
    const declarations = input.pipeline.match(
      new RegExp(`^\\s+- ${escapeRegex(secret)}$`, "gm"),
    );
    if ((declarations ?? []).length !== 2)
      failures.push(`${secret} must be scoped only to the two deploy jobs`);
  }
  if (!input.selfProtection.includes("check:deploy-authority")) {
    failures.push(
      "secretless CI self-protection must run check:deploy-authority",
    );
  }
  return failures;
};

const containsDeployPrimitive = (source: string): boolean => {
  const normalized = source
    .replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$|^\s*#.*$/gm, " ")
    .replace(/["'`,()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return (
    /\bconvex\s+deploy\b/.test(normalized) ||
    /\bwrangler(?:@[^\s]+)?\s+pages\s+deploy\b/.test(normalized)
  );
};

const pipelineBlock = (pipeline: string, key: string): string | undefined => {
  const lines = pipeline.split("\n");
  const keyIndex = lines.findIndex((line) => line.trim() === `key: "${key}"`);
  if (keyIndex < 0) return undefined;
  let start = keyIndex;
  while (start > 0 && !lines[start]?.startsWith("  - ")) start -= 1;
  let end = keyIndex + 1;
  while (end < lines.length && !lines[end]?.startsWith("  - ")) end += 1;
  return lines.slice(start, end).join("\n");
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countOccurrences = (source: string, value: string): number =>
  source.split(value).length - 1;

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.cwd();
  const policySource = readFileSync(
    resolve(root, "tooling/release/deploy-policy.json"),
    "utf8",
  );
  const trustBundleSource = readFileSync(
    resolve(root, "tooling/release/deploy-trust-bundle.json"),
    "utf8",
  );
  const trustBundle = JSON.parse(trustBundleSource) as {
    readonly schemaVersion: number;
    readonly members: readonly string[];
  };
  if (trustBundle.schemaVersion !== 1 || !Array.isArray(trustBundle.members))
    throw new Error("deploy trust bundle manifest has an invalid shape");
  const trustMembers = Object.fromEntries(
    trustBundle.members.map((name) => [
      name,
      readFileSync(resolve(root, name), "utf8"),
    ]),
  );
  const executableFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .trim()
    .split("\n")
    .filter(
      (name) =>
        /(?:^|\/)(?:[^/]+\.)?(?:sh|ts|mts|cts|js|mjs|cjs)$/.test(name) &&
        !name.includes("/_generated/") &&
        !/(?:^|\/)(?:test|tests|__tests__)(?:\/|\.)|\.(?:test|spec)\./.test(
          name,
        ) &&
        !name.endsWith("check-deploy-authority.mts"),
    );
  const sources = Object.fromEntries(
    executableFiles.map((name) => [
      name,
      readFileSync(resolve(root, name), "utf8"),
    ]),
  );
  const packageJson = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
  ) as { readonly scripts?: Readonly<Record<string, string>> };
  const failures = validateDeployAuthoritySources({
    sources,
    packageScripts: packageJson.scripts ?? {},
    pipeline: readFileSync(resolve(root, ".buildkite/pipeline.yml"), "utf8"),
    selfProtection: readFileSync(
      resolve(root, ".buildkite/scripts/ci-self-protection.sh"),
      "utf8",
    ),
    policySource,
    trustMembers,
    trustedDeployRootSha256: process.env.TRUSTED_DEPLOY_ROOT_SHA256,
    buildkite: process.env.BUILDKITE === "true",
  });
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    `check:deploy-authority passed (${deployTrustRootSha256(trustMembers)})`,
  );
}
