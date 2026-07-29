import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/_project-config.mjs");
const bindings = {
  TEMPLATE_STAGING_CONVEX_DEPLOYMENT: "dev:template-staging",
  TEMPLATE_STAGING_CONVEX_URL: "https://template-staging.convex.cloud",
  TEMPLATE_STAGING_HOSTED_URL: "https://staging.example.test",
  TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT: "prod:template-production",
  TEMPLATE_PRODUCTION_CONVEX_URL: "https://template-production.convex.cloud",
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
        TEMPLATE_PRODUCTION_CONVEX_URL: "https://template-staging.convex.site",
      }).status,
    ).not.toBe(0);
  });
});
