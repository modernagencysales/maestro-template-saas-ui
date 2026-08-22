import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Woodpecker firewall and epoch pipelines", () => {
  it("has one fast required PR pipeline and one manual epoch pipeline", () => {
    const firewall = read(".woodpecker/firewall.yml");
    const epoch = read(".woodpecker/epoch.yml");
    expect(firewall).toContain("class: firewall");
    expect(firewall).toContain("event: pull_request");
    expect(firewall).not.toContain("event: manual");
    expect(epoch).toContain("class: epoch");
    expect(epoch).toContain("event: manual");
    expect(epoch).not.toContain("event: pull_request");
  });

  it("keeps full verification out of the firewall and in the epoch", () => {
    const firewall = read("tooling/ci/firewall.sh");
    expect(firewall).not.toContain("pnpm verify");
    expect(firewall).toContain("source tooling/ci/setup.sh");
    expect(firewall).not.toContain("pnpm install --frozen-lockfile");
    expect(read("tooling/ci/epoch.sh")).toContain("pnpm verify");
    expect(read("tooling/ci/firewall.sh")).not.toContain("pnpm review:bounded");
    expect(read("tooling/ci/firewall.sh")).toContain(
      "pnpm check:qlty -- --diff",
    );
  });

  it("keeps Woodpecker as the PR verification authority", () => {
    expect(existsSync(resolve(root, ".github/workflows/quality.yml"))).toBe(
      false,
    );
    expect(existsSync(resolve(root, ".woodpecker/verify.yml"))).toBe(true);
  });

  it("clones complete history for trusted contract bootstrap", () => {
    expect(read(".woodpecker/verify-core.yml")).toContain("depth: 0");
    expect(read(".woodpecker/verify-coverage.yml")).toContain("depth: 0");
    expect(read(".woodpecker/verify.yml")).toContain("depth: 1");
  });

  it("keeps the trusted policy first and exact runner classes", () => {
    const firewall = read(".woodpecker/firewall.yml");
    expect(firewall.indexOf("name: trusted-ci-policy")).toBeLessThan(
      firewall.indexOf("name: firewall"),
    );
    expect(firewall).toContain("role: factory-ci");
    expect(read(".woodpecker/epoch.yml")).toContain("role: factory-ci");
  });

  it("keeps the firewall limited to its deterministic authority", () => {
    const firewall = read(".woodpecker/firewall.yml");
    const steps = [...firewall.matchAll(/^\s*- name: ([^\n]+)/gm)].map(
      ([, name]) => name,
    );
    expect(steps).toEqual(["trusted-ci-policy", "firewall"]);
    expect(firewall).not.toContain("OPENROUTER_API_KEY");
    expect(firewall).not.toContain("ai-review-cycle.mts");
  });

  it("bootstraps from the reviewed lockfile without an uninstalled proxy", () => {
    const setup = read("tooling/ci/setup.sh");
    expect(setup).toContain("candidate-sandbox.mts validate");
    expect(setup).toContain("pnpm fetch --frozen-lockfile --ignore-scripts");
    expect(setup).toContain(
      "pnpm install --offline --frozen-lockfile --ignore-scripts",
    );
    expect(setup).not.toContain("candidate-sandbox.mts install");
  });

  it("keeps deploy guarded and all shell entrypoints executable", () => {
    const deployPipeline = read(".woodpecker/deploy.yml");
    expect(deployPipeline).toContain('CI_PIPELINE_DEPLOY_TARGET == "staging"');
    expect(deployPipeline).toContain("source tooling/ci/setup.sh");
    expect(deployPipeline).not.toContain("corepack enable");
    for (const name of readdirSync(resolve(root, "tooling/ci")).filter((name) =>
      name.endsWith(".sh"),
    )) {
      expect(
        statSync(resolve(root, `tooling/ci/${name}`)).mode & 0o111,
        name,
      ).not.toBe(0);
    }
  });
});
