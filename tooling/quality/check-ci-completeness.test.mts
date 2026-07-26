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
      "pnpm --dir apps/cli test:create-root-integration",
    );
    expect(requirements).toContain(
      "pnpm --dir tooling/agent-pack test:privacy-no-network",
    );
    expect(requirements).toContain("check:system-topology");
    expect(requirements).toContain("check:data-resources");
    expect(requirements).toContain("check:promotion-boundary");
    expect(requirements).toContain(".github/workflows/quality.yml");
    expect(requirements).toContain("Justfile");
    expect(requirements).toContain("lefthook.yml");
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
});
