import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/_project-config.mjs");
const bindings = {
  TEMPLATE_STAGING_CONVEX_DEPLOYMENT: "prod:perfect-sparrow-808",
  TEMPLATE_STAGING_CONVEX_URL: "https://perfect-sparrow-808.convex.cloud",
  TEMPLATE_STAGING_HOSTED_URL: "https://staging.example.test",
  TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT: "prod:hearty-peccary-962",
  TEMPLATE_PRODUCTION_CONVEX_URL: "https://hearty-peccary-962.convex.cloud",
  TEMPLATE_PRODUCTION_HOSTED_URL: "https://app.example.test",
};

const run = (args, env = bindings) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

describe("project deploy bindings", () => {
  it("resolves provider values only from environment-specific bindings", () => {
    const result = run(["get", "staging", "convexUrl"]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(bindings.TEMPLATE_STAGING_CONVEX_URL);
  });

  it("accepts distinct staging and production Convex identities", () => {
    expect(run(["assert-isolated-convex"]).status).toBe(0);
  });

  it("fails closed for missing or shared Convex identities", () => {
    expect(
      run(["assert-isolated-convex"], {
        ...bindings,
        TEMPLATE_STAGING_CONVEX_URL: "",
      }).status,
    ).not.toBe(0);
    expect(
      run(["assert-isolated-convex"], {
        ...bindings,
        TEMPLATE_PRODUCTION_CONVEX_URL:
          "https://perfect-sparrow-808.convex.site",
      }).status,
    ).not.toBe(0);
  });

  it("rejects cross-swapped and internally mismatched environment bindings", () => {
    for (const env of [
      {
        ...bindings,
        TEMPLATE_STAGING_CONVEX_DEPLOYMENT:
          bindings.TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT,
        TEMPLATE_STAGING_CONVEX_URL: bindings.TEMPLATE_PRODUCTION_CONVEX_URL,
        TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT:
          bindings.TEMPLATE_STAGING_CONVEX_DEPLOYMENT,
        TEMPLATE_PRODUCTION_CONVEX_URL: bindings.TEMPLATE_STAGING_CONVEX_URL,
      },
      {
        ...bindings,
        TEMPLATE_STAGING_CONVEX_DEPLOYMENT:
          bindings.TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT,
      },
      {
        ...bindings,
        TEMPLATE_PRODUCTION_CONVEX_URL: bindings.TEMPLATE_STAGING_CONVEX_URL,
      },
    ]) {
      expect(run(["assert-isolated-convex"], env).status).not.toBe(0);
    }
  });

  it("rejects a Convex deploy key whose public prefix targets another deployment", () => {
    expect(
      run(["assert-convex-deploy-key", "staging"], {
        ...bindings,
        CONVEX_DEPLOY_KEY: `${bindings.TEMPLATE_STAGING_CONVEX_DEPLOYMENT}|opaque-test-key`,
      }).status,
    ).toBe(0);
    expect(
      run(["assert-convex-deploy-key", "staging"], {
        ...bindings,
        CONVEX_DEPLOY_KEY: `${bindings.TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT}|opaque-test-key`,
      }).status,
    ).not.toBe(0);
  });
});
