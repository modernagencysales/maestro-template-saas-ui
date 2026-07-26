import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDeployAuthoritySources } from "./check-deploy-authority.mts";

const root = process.cwd();
const source = (name: string) =>
  readFileSync(resolve(root, ".buildkite/scripts", name), "utf8");
const fixture = () => ({
  scripts: {
    "staging-deploy.sh": source("staging-deploy.sh"),
    "production-promote.sh": source("production-promote.sh"),
  },
  pipeline: readFileSync(resolve(root, ".buildkite/pipeline.yml"), "utf8"),
  selfProtection: source("ci-self-protection.sh"),
});

describe("deploy authority self-protection", () => {
  it("rejects removed/reordered authority and approval plus credential broadening", () => {
    const base = fixture();
    expect(validateDeployAuthoritySources(base)).toEqual([]);
    const removed = base.scripts["staging-deploy.sh"].replace(
      /^.*deploy-authority-check.*\n/m,
      "",
    );
    expect(
      validateDeployAuthoritySources({
        ...base,
        scripts: { ...base.scripts, "staging-deploy.sh": removed },
      }),
    ).not.toEqual([]);
    const reordered = base.scripts["production-promote.sh"].replace(
      /(.*deploy-authority-check.*\n)([\s\S]*?)(\(cd packages\/convex && pnpm exec convex deploy -y\)\n)/,
      "$2$3$1",
    );
    expect(
      validateDeployAuthoritySources({
        ...base,
        scripts: { ...base.scripts, "production-promote.sh": reordered },
      }),
    ).not.toEqual([]);
    expect(
      validateDeployAuthoritySources({
        ...base,
        pipeline: base.pipeline.replace(
          'depends_on: "production-approval"',
          'depends_on: "phase-1"',
        ),
      }),
    ).not.toEqual([]);
    expect(
      validateDeployAuthoritySources({
        ...base,
        pipeline: base.pipeline.replace(
          "      - TEMPLATE_CONVEX_DEPLOY_KEY\n",
          "",
        ),
      }),
    ).not.toEqual([]);
  });
});
