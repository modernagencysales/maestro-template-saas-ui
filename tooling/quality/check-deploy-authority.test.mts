import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deployTrustRootSha256,
  validateDeployAuthoritySources,
} from "./check-deploy-authority.mts";

const root = resolve(import.meta.dirname, "../..");
const source = (name: string) => readFileSync(resolve(root, name), "utf8");
const policySource = () => source("tooling/release/deploy-policy.json");
const fixture = () => {
  const trustMembers = {
    "tooling/quality/check-deploy-authority.mts": source(
      "tooling/quality/check-deploy-authority.mts",
    ),
    "tooling/release/deploy-policy.json": policySource(),
    "tooling/release/keys/deploy-authority-public-key.pem": source(
      "tooling/release/keys/deploy-authority-public-key.pem",
    ),
  };
  return {
    sources: {
      "scripts/_project-config.mjs": source("scripts/_project-config.mjs"),
      ".buildkite/scripts/staging-deploy.sh": source(
        ".buildkite/scripts/staging-deploy.sh",
      ),
      ".buildkite/scripts/production-promote.sh": source(
        ".buildkite/scripts/production-promote.sh",
      ),
      "tooling/release/src/deploy/guardedDeploy.ts": source(
        "tooling/release/src/deploy/guardedDeploy.ts",
      ),
      ".buildkite/scripts/deploy-canary.sh": source(
        ".buildkite/scripts/deploy-canary.sh",
      ),
      ".buildkite/scripts/rollback-promote.sh": source(
        ".buildkite/scripts/rollback-promote.sh",
      ),
    },
    packageScripts: {
      "convex:deploy": "tsx tooling/release/src/deploy/guardedDeploy.ts convex",
      "deploy:cloudflare":
        "VITE_CONVEX_URL=${VITE_CONVEX_URL:-$(node scripts/_project-config.mjs get production convexUrl)} pnpm build && pnpm smoke:web-static && tsx tooling/release/src/deploy/guardedDeploy.ts cloudflare",
    },
    pipeline: source(".buildkite/pipeline.yml"),
    selfProtection: source(".buildkite/scripts/ci-self-protection.sh"),
    projectConfigSource: source("project.config.json"),
    policySource: policySource(),
    trustMembers,
    trustedDeployRootSha256: deployTrustRootSha256(trustMembers),
    buildkite: true,
  };
};

describe("deploy authority self-protection", () => {
  it("accepts the pinned canonical guarded topology", () => {
    expect(validateDeployAuthoritySources(fixture())).toEqual([]);
  });

  it("rejects package aliases and alternate executable wrappers", () => {
    const base = fixture();
    expect(
      validateDeployAuthoritySources({
        ...base,
        packageScripts: {
          ...base.packageScripts,
          "convex:deploy": "convex deploy -y",
        },
      }),
    ).not.toEqual([]);
    expect(
      validateDeployAuthoritySources({
        ...base,
        pipeline: `${base.pipeline}\n  - TEMPLATE_CONVEX_DEPLOY_KEY\n`,
      }),
    ).not.toEqual([]);
    for (const primitive of [
      "await execa('convex', ['deploy'])",
      "pnpm dlx wrangler@latest pages deploy dist",
    ]) {
      expect(
        validateDeployAuthoritySources({
          ...base,
          sources: { ...base.sources, "scripts/bypass.ts": primitive },
        }),
      ).not.toEqual([]);
    }
  });

  it("requires exactly one pipeline preflight per environment in the guarded order", () => {
    const base = fixture();
    for (const pipeline of [
      base.pipeline.replace(
        'key: "staging-authority-preflight"',
        'key: "removed"',
      ),
      base.pipeline.replace(
        'depends_on: "production-approval"',
        'depends_on: "phase-1"',
      ),
      base.pipeline.replace(
        'depends_on: "production-authority-preflight"',
        'depends_on: "production-approval"',
      ),
      base.pipeline.replace(
        "authorityCli.ts staging",
        "authorityCli.ts removed",
      ),
      base.pipeline.replace("staging convexUrl", "production convexUrl"),
      `${base.pipeline}\npnpm exec tsx tooling/release/src/deploy/authorityCli.ts production deadbeef template-production\n`,
    ]) {
      expect(validateDeployAuthoritySources({ ...base, pipeline })).not.toEqual(
        [],
      );
    }
  });

  it("rejects credential broadening, script preflights, and missing guarded provider routes", () => {
    const base = fixture();
    expect(
      validateDeployAuthoritySources({
        ...base,
        pipeline: `${base.pipeline}\n  - TEMPLATE_STAGING_CONVEX_DEPLOY_KEY\n`,
      }),
    ).not.toEqual([]);
    expect(
      validateDeployAuthoritySources({
        ...base,
        sources: {
          ...base.sources,
          ".buildkite/scripts/staging-deploy.sh": `${
            base.sources[".buildkite/scripts/staging-deploy.sh"]
          }\npnpm exec tsx tooling/release/src/deploy/authorityCli.ts staging deadbeef template-staging\n`,
        },
      }),
    ).not.toEqual([]);
    for (const route of [
      "guardedDeploy.ts convex",
      "guardedDeploy.ts cloudflare",
    ]) {
      expect(
        validateDeployAuthoritySources({
          ...base,
          sources: {
            ...base.sources,
            ".buildkite/scripts/production-promote.sh": base.sources[
              ".buildkite/scripts/production-promote.sh"
            ].replace(route, "removed-route"),
          },
        }),
      ).not.toEqual([]);
    }
  });

  it("forbids the authority signing key from every Buildkite surface", () => {
    const base = fixture();
    const privateKeyName = "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL";
    expect(
      validateDeployAuthoritySources({
        ...base,
        pipeline: `${base.pipeline}\nenv:\n  ${privateKeyName}: forbidden\n`,
      }),
    ).not.toEqual([]);
    expect(
      validateDeployAuthoritySources({
        ...base,
        sources: {
          ...base.sources,
          ".buildkite/scripts/staging-deploy.sh": `${
            base.sources[".buildkite/scripts/staging-deploy.sh"]
          }\nexport ${privateKeyName}=forbidden\n`,
        },
      }),
    ).not.toEqual([]);
  });

  it("requires external environment-specific provider bindings and isolation", () => {
    const base = fixture();
    for (const projectConfigSource of [
      base.projectConfigSource.replace(
        '"TEMPLATE_STAGING_CONVEX_URL"',
        '"TEMPLATE_PRODUCTION_CONVEX_URL"',
      ),
      base.projectConfigSource.replace(
        '"requireDistinctConvexDeployments": true',
        '"requireDistinctConvexDeployments": false',
      ),
    ]) {
      expect(
        validateDeployAuthoritySources({ ...base, projectConfigSource }),
      ).not.toEqual([]);
    }
    expect(
      validateDeployAuthoritySources({
        ...base,
        sources: {
          ...base.sources,
          "scripts/_project-config.mjs": base.sources[
            "scripts/_project-config.mjs"
          ].replace(
            'command === "assert-isolated-convex"',
            'command === "removed"',
          ),
        },
      }),
    ).not.toEqual([]);
  });

  it("requires post-deploy backend and hosted canaries before receipts", () => {
    const base = fixture();
    for (const scriptName of [
      ".buildkite/scripts/staging-deploy.sh",
      ".buildkite/scripts/production-promote.sh",
    ] as const) {
      const script = base.sources[scriptName];
      for (const marker of [
        "check-deploy-authority-receipt.mts validate-inputs",
        "deploy-canary.sh backend",
        "deploy-canary.sh hosted",
        "check-deploy-authority-receipt.mts record",
      ]) {
        expect(
          validateDeployAuthoritySources({
            ...base,
            sources: {
              ...base.sources,
              [scriptName]: script.split(marker).join("REMOVED_MARKER"),
            },
          }),
          `${scriptName}:${marker}`,
        ).not.toEqual([]);
      }
    }
  });

  it("requires a guarded rollback path with exact coordinate verification", () => {
    const base = fixture();
    for (const marker of [
      "check-deploy-authority-receipt.mts validate-inputs",
      "check-deploy-authority-receipt.mts verify-rollback",
      "git rev-parse HEAD",
      "git cat-file -e",
      "guardedDeploy.ts convex",
      "deploy-canary.sh backend",
      "guardedDeploy.ts cloudflare",
      "deploy-canary.sh hosted",
    ]) {
      expect(
        validateDeployAuthoritySources({
          ...base,
          sources: {
            ...base.sources,
            ".buildkite/scripts/rollback-promote.sh": base.sources[
              ".buildkite/scripts/rollback-promote.sh"
            ]
              .split(marker)
              .join("REMOVED_MARKER"),
          },
        }),
        marker,
      ).not.toEqual([]);
    }
  });

  it("requires complete hosted launch proof before a receipt", () => {
    const base = fixture();
    for (const marker of [
      "pnpm smoke:hosted",
      "pnpm smoke:hosted:browser",
      "pnpm smoke:hosted:a11y",
      "pnpm smoke:hosted:visual",
    ]) {
      expect(
        validateDeployAuthoritySources({
          ...base,
          sources: {
            ...base.sources,
            ".buildkite/scripts/deploy-canary.sh": base.sources[
              ".buildkite/scripts/deploy-canary.sh"
            ]
              .split(marker)
              .join("REMOVED_MARKER"),
          },
        }),
        marker,
      ).not.toEqual([]);
    }
  });

  it("fails closed without the external root or when verifier, policy, or key co-change", () => {
    const base = fixture();
    expect(
      validateDeployAuthoritySources({
        ...base,
        trustedDeployRootSha256: undefined,
      }),
    ).not.toEqual([]);
    for (const [member, sourceBytes] of Object.entries(base.trustMembers)) {
      const trustMembers = {
        ...base.trustMembers,
        [member]: `${sourceBytes}\nco-edited`,
      };
      expect(
        validateDeployAuthoritySources({
          ...base,
          policySource:
            member === "tooling/release/deploy-policy.json"
              ? trustMembers[member]
              : base.policySource,
          trustMembers,
        }),
      ).not.toEqual([]);
    }
  });
});
