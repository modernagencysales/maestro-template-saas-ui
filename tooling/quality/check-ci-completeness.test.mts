import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import {
  descriptor,
  validateRootVerifyHostTerms,
} from "./check-ci-completeness.mts";

describe("check:ci-completeness", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("pins topology, lifecycle, and promotion enforcement in every required lane", () => {
    const requirements = JSON.stringify(descriptor.requirements);

    expect(requirements).toContain("turbo run typecheck --concurrency=1");
    expect(requirements).toContain(
      "pnpm --dir packages/convex test:workflow-conformance",
    );
    expect(requirements).toContain(
      "pnpm --dir apps/cli test:create-root-integration",
    );
    expect(requirements).toContain(
      "pnpm --dir tooling/agent-pack test:privacy-no-network",
    );
    expect(requirements).toContain(
      "vitest run --passWithNoTests --maxWorkers=1 --no-file-parallelism",
    );
    expect(requirements).toContain("check:system-topology");
    expect(requirements).toContain("check:data-resources");
    expect(requirements).toContain("check:promotion-boundary");
    expect(requirements).not.toContain(".github/workflows/quality.yml");
    expect(requirements).toContain("Justfile");
    expect(requirements).toContain("lefthook.yml");
    expect(requirements).toContain("bounded-ai-review");
    const firewallPipeline = descriptor.requirements.find(
      ({ file }) => file === ".woodpecker/firewall.yml",
    );
    expect(firewallPipeline?.includes).toContain(
      'git archive "origin/$${BASE_BRANCH}"',
    );
    expect(firewallPipeline?.includes).toContain(
      'node --experimental-strip-types --experimental-transform-types "$TRUSTED_TREE/tooling/quality/ai-review-cycle.mts"',
    );
    const firewallScript = descriptor.requirements.find(
      ({ file }) => file === "tooling/ci/firewall.sh",
    );
    expect(firewallScript?.includes).not.toContain("pnpm review:bounded");
  });

  it("rejects concatenated or duplicated host verification terms", () => {
    const valid = [
      "pnpm check:ci-completeness",
      "pnpm check:config-drift",
      "pnpm check:convex-ai-files",
      "pnpm check:agent-pack",
      "pnpm check:deps",
    ].join(" && ");
    expect(validateRootVerifyHostTerms({ scripts: { verify: valid } })).toEqual(
      [],
    );
    expect(
      validateRootVerifyHostTerms({
        scripts: {
          verify: valid.replace(
            "pnpm check:config-drift && pnpm check:convex-ai-files",
            "pnpm check:config-driftpnpm check:convex-ai-files",
          ),
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("exactly one pnpm check:config-drift term"),
        expect.stringContaining("exactly one pnpm check:convex-ai-files term"),
      ]),
    );
    expect(
      validateRootVerifyHostTerms({
        scripts: {
          verify: valid.replace(
            "pnpm check:config-drift",
            "pnpm check:config-drift && pnpm check:config-drift",
          ),
        },
      }),
    ).toContain(
      "package.json scripts.verify must contain exactly one pnpm check:config-drift term",
    );
  });

  it("keeps product journeys out of root verify until repository adoption", () => {
    const verify = [
      "pnpm check:product-journeys",
      "pnpm check:config-drift",
      "pnpm check:convex-ai-files",
      "pnpm check:agent-pack",
    ].join(" && ");
    expect(validateRootVerifyHostTerms({ scripts: { verify } })).toContain(
      "package.json scripts.verify must not run pnpm check:product-journeys before repository adoption",
    );
  });

  it("keeps Qlty advisory outside root verify", () => {
    const verify = [
      "pnpm check:config-drift",
      "pnpm check:convex-ai-files",
      "pnpm check:agent-pack",
      "pnpm check:qlty",
    ].join(" && ");
    expect(validateRootVerifyHostTerms({ scripts: { verify } })).toContain(
      "package.json scripts.verify must keep pnpm check:qlty advisory outside the root verdict",
    );
  });
});
