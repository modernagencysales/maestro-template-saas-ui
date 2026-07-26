import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deployTrustRootSha256,
  validateDeployAuthoritySources,
} from "./check-deploy-authority.mts";

const root = process.cwd();
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
      ".buildkite/scripts/staging-deploy.sh": source(
        ".buildkite/scripts/staging-deploy.sh",
      ),
      ".buildkite/scripts/production-promote.sh": source(
        ".buildkite/scripts/production-promote.sh",
      ),
      "tooling/release/src/deploy/guardedDeploy.ts": source(
        "tooling/release/src/deploy/guardedDeploy.ts",
      ),
    },
    packageScripts: {
      "convex:deploy": "tsx tooling/release/src/deploy/guardedDeploy.ts convex",
      "deploy:cloudflare":
        "VITE_CONVEX_URL=${VITE_CONVEX_URL:-$(node scripts/_project-config.mjs get production convexUrl)} pnpm build && pnpm smoke:web-static && tsx tooling/release/src/deploy/guardedDeploy.ts cloudflare",
    },
    pipeline: source(".buildkite/pipeline.yml"),
    selfProtection: source(".buildkite/scripts/ci-self-protection.sh"),
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

  it("rejects removed or reordered preflights and credential dependency bypass", () => {
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
    ]) {
      expect(validateDeployAuthoritySources({ ...base, pipeline })).not.toEqual(
        [],
      );
    }
  });

  it("rejects credential broadening and missing guarded reauthorization", () => {
    const base = fixture();
    expect(
      validateDeployAuthoritySources({
        ...base,
        pipeline: `${base.pipeline}\n  - TEMPLATE_CONVEX_DEPLOY_KEY\n`,
      }),
    ).not.toEqual([]);
    expect(
      validateDeployAuthoritySources({
        ...base,
        sources: {
          ...base.sources,
          ".buildkite/scripts/staging-deploy.sh": base.sources[
            ".buildkite/scripts/staging-deploy.sh"
          ].replace(/^.*authorityCli\.ts staging.*\n/m, ""),
        },
      }),
    ).not.toEqual([]);
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
