import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEPLOY_NODE_IMAGE =
  "node:22.23.2-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a";

type DeployPolicy = {
  readonly schemaVersion: 1;
  readonly primitiveOwner: string;
  readonly packageRoutes: Readonly<Record<string, string>>;
  readonly authority: {
    readonly pipelinePreflightOwner: string;
    readonly guardedDeployOwner: string;
    readonly requiredActions: readonly ["convex", "cloudflare"];
    readonly forbiddenCiEnv: readonly string[];
    readonly requiredBindings: readonly string[];
  };
  readonly jobs: Readonly<
    Record<
      "staging" | "production",
      {
        readonly preflight: string;
        readonly approval: string;
        readonly deploy: string;
        readonly script: string;
        readonly credentialSecrets: readonly string[];
      }
    >
  >;
  readonly rollbackScript: string;
  readonly rollbackSeedCommitBinding: string;
  readonly trustedSelfProtectionCommitBinding: string;
  readonly legacyCredentialSecretsForbidden: readonly string[];
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

type DeployAuthorityInput = {
  readonly sources: Readonly<Record<string, string>>;
  readonly packageScripts: Readonly<Record<string, string>>;
  readonly pipeline: string;
  readonly selfProtection: string;
  readonly projectConfigSource: string;
  readonly policySource: string;
  readonly trustMembers: Readonly<Record<string, string>>;
  readonly trustedDeployRootSha256?: string;
  readonly ci?: boolean;
};

// eslint-disable-next-line complexity -- AP-008 tracks decomposing this pre-existing fail-closed deploy authority validator.
export function validateDeployAuthoritySources(
  input: DeployAuthorityInput,
): readonly string[] {
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
    !Array.isArray(policy.authority.forbiddenCiEnv) ||
    !policy.jobs?.staging ||
    !policy.jobs.production ||
    !Array.isArray(policy.authority.requiredBindings) ||
    typeof policy.rollbackScript !== "string" ||
    policy.rollbackSeedCommitBinding !== "TRUSTED_ROLLBACK_SEED_COMMIT" ||
    policy.trustedSelfProtectionCommitBinding !==
      "TRUSTED_CI_SELF_PROTECTION_COMMIT" ||
    !Array.isArray(policy.legacyCredentialSecretsForbidden) ||
    !Array.isArray(policy.jobs.staging.credentialSecrets) ||
    !Array.isArray(policy.jobs.production.credentialSecrets)
  ) {
    return ["deploy policy manifest has an invalid shape"];
  }
  failures.push(...canonicalNodeImageFailures(input.pipeline, policy));

  const actualTrustRoot = deployTrustRootSha256(input.trustMembers);
  if (input.ci && !input.trustedDeployRootSha256) {
    failures.push("CI must provide TRUSTED_DEPLOY_ROOT_SHA256");
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

  const ciSources = Object.entries(input.sources)
    .filter(([name]) => name.startsWith("tooling/ci/"))
    .map(([, source]) => source);
  for (const forbidden of policy.authority.forbiddenCiEnv) {
    if (
      input.pipeline.includes(forbidden) ||
      ciSources.some((source) => source.includes(forbidden))
    ) {
      failures.push(
        `${forbidden} must remain authority-side and absent from CI`,
      );
    }
  }

  for (const binding of policy.authority.requiredBindings) {
    const declarations = [
      ...input.pipeline.matchAll(new RegExp(`^\\s+${binding}:\\s*$`, "gmu")),
    ].length;
    const secretMappings = [
      ...input.pipeline.matchAll(
        new RegExp(
          `^\\s+${binding}:\\s*\\n\\s+from_secret:\\s*\\S+\\s*$`,
          "gmu",
        ),
      ),
    ].length;
    if (declarations === 0 || secretMappings !== declarations)
      failures.push(
        `pipeline must bind externally supplied ${binding} from a Woodpecker secret`,
      );
  }
  for (const binding of [
    policy.rollbackSeedCommitBinding,
    policy.trustedSelfProtectionCommitBinding,
  ]) {
    if (!policy.authority.requiredBindings.includes(binding))
      failures.push(`${binding} must be a required external trust binding`);
  }
  for (const legacy of policy.legacyCredentialSecretsForbidden) {
    if (input.pipeline.includes(`- ${legacy}`))
      failures.push(
        `${legacy} must not replace environment-scoped credentials`,
      );
  }

  let projectConfig: {
    readonly requireDistinctConvexDeployments?: boolean;
    readonly environments?: Readonly<
      Record<
        "staging" | "production",
        {
          readonly convexDeployNameEnv?: string;
          readonly convexUrlEnv?: string;
          readonly hostedUrlEnv?: string;
          readonly requiredSecrets?: readonly string[];
        }
      >
    >;
  };
  try {
    projectConfig = JSON.parse(
      input.projectConfigSource,
    ) as typeof projectConfig;
  } catch {
    return ["project config must be valid JSON"];
  }
  const stagingConfig = projectConfig.environments?.staging;
  const productionConfig = projectConfig.environments?.production;
  if (
    projectConfig.requireDistinctConvexDeployments !== true ||
    !stagingConfig ||
    !productionConfig ||
    !["convexDeployNameEnv", "convexUrlEnv", "hostedUrlEnv"].every(
      (field) =>
        typeof stagingConfig[field as keyof typeof stagingConfig] ===
          "string" &&
        typeof productionConfig[field as keyof typeof productionConfig] ===
          "string" &&
        stagingConfig[field as keyof typeof stagingConfig] !==
          productionConfig[field as keyof typeof productionConfig],
    ) ||
    !input.sources["scripts/_project-config.mjs"]?.includes(
      'command === "assert-isolated-convex"',
    )
  ) {
    failures.push(
      "project config must require external, distinct staging and production Convex bindings",
    );
  }

  for (const [alias, route] of Object.entries(policy.packageRoutes)) {
    if (input.packageScripts[alias] !== route) {
      failures.push(
        `${alias}: package alias must route exactly through ${route}`,
      );
    }
  }
  const cloudflarePackageRoute = policy.packageRoutes["deploy:cloudflare"];
  if (
    !cloudflarePackageRoute?.includes(
      'VITE_CONVEX_URL="$(node scripts/_project-config.mjs get production convexUrl)"',
    ) ||
    cloudflarePackageRoute.includes("${VITE_CONVEX_URL:-")
  )
    failures.push(
      "deploy:cloudflare must replace inherited VITE_CONVEX_URL with the canonical production binding",
    );
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
      if (!preflight.includes(`depends_on:\n      - ${job.approval}`))
        failures.push(`${job.preflight} must depend on ${job.approval}`);
      if (!preflight.includes(preflightCall))
        failures.push(
          `${job.preflight} must call the durable authority preflight`,
        );
      if (
        !normalizedPreflight.includes(
          `${preflightCall} "$CI_COMMIT_SHA" template-${environment} "$(node scripts/_project-config.mjs get ${environment} convexUrl)"`,
        )
      )
        failures.push(
          `${job.preflight} must pass the canonical ${environment} Convex URL to the durable authority preflight`,
        );
      for (const secret of job.credentialSecrets) {
        if (preflight.includes(`${secret}:`))
          failures.push(`${job.preflight} must not receive scoped ${secret}`);
      }
    }
    if (!deploy) {
      failures.push(`pipeline is missing ${job.deploy}`);
    } else {
      if (!deploy.includes(`depends_on:\n      - ${job.preflight}`))
        failures.push(`${job.deploy} must depend on ${job.preflight}`);
      if (!deploy.includes(`commands:\n      - ${job.script}`))
        failures.push(`${job.deploy} must route through ${job.script}`);
      for (const secret of job.credentialSecrets) {
        if (!deploy.includes(`${secret}:\n        from_secret:`))
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
    const convexDeploy = script.indexOf(
      `${policy.authority.guardedDeployOwner} convex`,
    );
    const coordinateValidation = script.indexOf(
      "check-deploy-authority-receipt.mts validate-inputs",
    );
    const deployKeyValidation = script.indexOf(
      `scripts/_project-config.mjs assert-convex-deploy-key ${environment}`,
    );
    const backendCanary = script.indexOf("deploy-canary.sh backend");
    const cloudflareDeploy = script.indexOf(
      `${policy.authority.guardedDeployOwner} cloudflare`,
    );
    const hostedCanary = script.indexOf("deploy-canary.sh hosted");
    const receipt = script.indexOf("check-deploy-authority-receipt.mts record");
    if (
      deployKeyValidation < 0 ||
      coordinateValidation <= deployKeyValidation ||
      convexDeploy <= coordinateValidation ||
      backendCanary <= convexDeploy ||
      cloudflareDeploy <= backendCanary ||
      hostedCanary <= cloudflareDeploy ||
      receipt <= hostedCanary
    )
      failures.push(
        `${job.script} must canary backend and hosted deploys before recording the receipt`,
      );
    const canonicalViteBinding = `VITE_CONVEX_URL="$(node scripts/_project-config.mjs get ${environment} convexUrl)"`;
    if (
      !script.includes(canonicalViteBinding) ||
      script.includes("${VITE_CONVEX_URL:-")
    )
      failures.push(
        `${job.script} must override VITE_CONVEX_URL with the selected environment binding`,
      );
    if (
      environment === "production" &&
      !script.includes('STAGED_SHA="${STAGED_SHA:?STAGED_SHA is required}"')
    )
      failures.push("production must require the exact accepted staged SHA");
  }

  for (const secret of [
    ...policy.jobs.staging.credentialSecrets,
    ...policy.jobs.production.credentialSecrets,
  ]) {
    const declarations = input.pipeline.match(
      new RegExp(`^\\s+${escapeRegex(secret)}:$`, "gm"),
    );
    if ((declarations ?? []).length !== 1)
      failures.push(
        `${secret} must be scoped only to its environment deploy job`,
      );
  }
  const rollback = input.sources[policy.rollbackScript] ?? "";
  const rollbackMarkers = [
    ': "${TRUSTED_ROLLBACK_SEED_COMMIT:',
    'git cat-file -e "${TRUSTED_ROLLBACK_SEED_COMMIT}^{commit}"',
    'git rev-parse "${TRUSTED_ROLLBACK_SEED_COMMIT}^{commit}"',
    'git merge-base --is-ancestor "${TRUSTED_ROLLBACK_SEED_COMMIT}" "${CI_COMMIT_SHA}"',
    "git rev-parse HEAD",
    "scripts/_project-config.mjs assert-convex-deploy-key production",
    "check-deploy-authority-receipt.mts validate-inputs",
    "check-deploy-authority-receipt.mts verify-rollback",
    `${policy.authority.guardedDeployOwner} convex`,
    "deploy-canary.sh backend",
    `${policy.authority.guardedDeployOwner} cloudflare`,
    "deploy-canary.sh hosted",
    "check-deploy-authority-receipt.mts record",
  ];
  if (
    rollbackMarkers.some((marker) => !rollback.includes(marker)) ||
    rollbackMarkers.some(
      (marker, index) =>
        index > 0 &&
        rollback.indexOf(marker) <=
          rollback.indexOf(rollbackMarkers[index - 1] ?? ""),
    )
  )
    failures.push(
      "rollback must verify exact prior coordinates, use guarded providers, canary, and record a new receipt",
    );
  const selfProtectionStep = pipelineBlock(input.pipeline, "trusted-ci-policy");
  const selfProtectionCommand =
    /(?:^|\n) {4}commands:\n {6}- \|\n(?<body>[\s\S]*?)\n {4}failure:/u.exec(
      selfProtectionStep ?? "",
    )?.groups?.body ?? "";
  const trustedSelfProtectionMarkers = [
    '$TRUSTED_CI_SELF_PROTECTION_COMMIT" =~ ^[0-9a-f]{40}',
    'git cat-file -e "$TRUSTED_CI_SELF_PROTECTION_COMMIT^{commit}"',
    'git rev-parse "$TRUSTED_CI_SELF_PROTECTION_COMMIT^{commit}"',
    'TRUSTED_SELF_PROTECTION_DIR="$(mktemp -d)"',
    'TRUSTED_SETUP_PATH="$TRUSTED_SELF_PROTECTION_DIR/setup.sh"',
    'TRUSTED_VERIFIER_PATH="$TRUSTED_SELF_PROTECTION_DIR/check-deploy-authority.mts"',
    'TRUSTED_SELF_PROTECTION_PATH="$TRUSTED_SELF_PROTECTION_DIR/ci-self-protection.sh"',
    'git show "$TRUSTED_CI_SELF_PROTECTION_COMMIT:tooling/ci/setup.sh"',
    'git show "$TRUSTED_CI_SELF_PROTECTION_COMMIT:tooling/quality/check-deploy-authority.mts"',
    'git show "$TRUSTED_CI_SELF_PROTECTION_COMMIT:tooling/ci/ci-self-protection.sh"',
    "export npm_config_ignore_scripts=true",
    'source "$TRUSTED_SETUP_PATH"',
    '[[ "$(node --version)" == "v22.23.2" ]]',
    'node --experimental-strip-types "$TRUSTED_VERIFIER_PATH"',
    'TEMPLATE_CI_SETUP=skip bash "$TRUSTED_SELF_PROTECTION_PATH"',
    "unset npm_config_ignore_scripts",
  ];
  if (
    !selfProtectionStep ||
    selfProtectionCommand === "" ||
    policy.jobs.staging.credentialSecrets.some((name) =>
      selfProtectionStep.includes(`${name}:`),
    ) ||
    policy.jobs.production.credentialSecrets.some((name) =>
      selfProtectionStep.includes(`${name}:`),
    ) ||
    selfProtectionStep.includes('pnpm exec tsx "$TRUSTED_VERIFIER_PATH"') ||
    trustedSelfProtectionMarkers.some(
      (marker, index) =>
        !selfProtectionStep.includes(marker) ||
        (index > 0 &&
          selfProtectionStep.indexOf(marker) <=
            selfProtectionStep.indexOf(
              trustedSelfProtectionMarkers[index - 1] ?? "",
            )),
    )
  )
    failures.push(
      "secretless self-protection must run externally pinned bootstrap and verifier bytes",
    );
  const keyedPipelineBlocks = Object.fromEntries(
    pipelineBlocks(input.pipeline)
      .map((block) => {
        const key = /^\s*- name:\s*([^\s]+)$/mu.exec(block)?.[1];
        return key ? [[key, block] as const] : [];
      })
      .flat(),
  );
  const reachesSelfProtection = (
    key: string,
    seen = new Set<string>(),
  ): boolean => {
    if (key === "trusted-ci-policy") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    const block = keyedPipelineBlocks[key];
    const dependency = block
      ? /^\s*depends_on:\s*\n\s+-\s+([^\s]+)$/mu.exec(block)?.[1]
      : undefined;
    return dependency ? reachesSelfProtection(dependency, seen) : false;
  };
  for (const [key, block] of Object.entries(keyedPipelineBlocks)) {
    if (block.includes("from_secret:") && !reachesSelfProtection(key))
      failures.push(
        `${key} must transitively depend on trusted secretless self-protection`,
      );
  }
  const canary = input.sources["tooling/ci/deploy-canary.sh"] ?? "";
  if (
    !canary.includes("convex run ops/health:liveness") ||
    ![
      "pnpm smoke:hosted",
      "pnpm smoke:hosted:browser",
      "pnpm smoke:hosted:a11y",
      "pnpm smoke:hosted:visual",
    ].every((marker) => canary.includes(marker))
  )
    failures.push(
      "deploy canary must check Convex health plus hosted HTTP, browser, accessibility, and visual proof",
    );
  if (!input.selfProtection.includes("check:deploy-authority")) {
    failures.push(
      "secretless CI self-protection must run check:deploy-authority",
    );
  }
  return failures;
}

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
  return pipelineBlocks(pipeline).find((block) =>
    block.split("\n").some((line) => line.trim() === `- name: ${key}`),
  );
};

const pipelineBlocks = (pipeline: string): readonly string[] => {
  const stepsOffset = pipeline.indexOf("\nsteps:\n");
  const lines = pipeline
    .slice(stepsOffset >= 0 ? stepsOffset + 1 : 0)
    .split("\n");
  const blocks: string[] = [];
  let start = lines.findIndex((line) => line.startsWith("  - name:"));
  while (start >= 0) {
    let end = start + 1;
    while (end < lines.length && !lines[end]?.startsWith("  - name:")) end += 1;
    blocks.push(lines.slice(start, end).join("\n"));
    start = end < lines.length ? end : -1;
  }
  return blocks;
};

const canonicalNodeImageFailures = (
  pipeline: string,
  policy: DeployPolicy,
): readonly string[] => {
  const stepNames = [
    "trusted-ci-policy",
    policy.jobs.staging.preflight,
    policy.jobs.staging.deploy,
    policy.jobs.production.preflight,
    policy.jobs.production.deploy,
  ];
  return stepNames.flatMap((stepName) =>
    pipelineBlock(pipeline, stepName)?.includes(`image: ${DEPLOY_NODE_IMAGE}`)
      ? []
      : [`${stepName} must use the canonical Node image`],
  );
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
        existsSync(resolve(root, name)) &&
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
    pipeline: readFileSync(resolve(root, ".woodpecker/deploy.yml"), "utf8"),
    selfProtection: readFileSync(
      resolve(root, "tooling/ci/ci-self-protection.sh"),
      "utf8",
    ),
    projectConfigSource: readFileSync(
      resolve(root, "project.config.json"),
      "utf8",
    ),
    policySource,
    trustMembers,
    trustedDeployRootSha256: process.env.TRUSTED_DEPLOY_ROOT_SHA256,
    ci: process.env.CI === "true",
  });
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    `check:deploy-authority passed (${deployTrustRootSha256(trustMembers)})`,
  );
}
