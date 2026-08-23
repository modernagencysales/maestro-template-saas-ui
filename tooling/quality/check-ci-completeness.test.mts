import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import {
  descriptor,
  validateRootVerifyHostTerms,
} from "./check-ci-completeness.mts";
import { checkDescriptors } from "./src/check-definitions.mts";

describe("check:ci-completeness", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("registers the required typed product-contract observations", () => {
    const descriptors: Readonly<Record<string, unknown>> = checkDescriptors;

    expect(descriptors["product-contract"]).toMatchObject({
      gateId: "product-contract",
      posture: "required",
      evidenceClass: "static",
      argv: ["pnpm", "check:product-contract"],
      rerun: ["pnpm", "check:product-contract"],
    });
    expect(descriptors["acceptance-required"]).toMatchObject({
      gateId: "acceptance-required",
      posture: "required",
      evidenceClass: "runtime",
      argv: ["pnpm", "acceptance:required"],
      rerun: ["pnpm", "acceptance:required"],
    });
  });

  it("pins topology, lifecycle, and promotion enforcement in every required lane", () => {
    const requirements = JSON.stringify(descriptor.requirements);

    expect(requirements).toContain(
      "turbo run typecheck --concurrency=1 --filter=!@workspace/ui --filter=!@maestro-template/web && pnpm typecheck:saas-ui",
    );
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
      "node tooling/ci/run-heavyweight-suites.mjs",
    );
    expect(requirements).toContain('process.on(\\"SIGINT\\", onInterrupt)');
    expect(requirements).toContain('process.on(\\"SIGTERM\\", onTerminate)');
    expect(requirements).toContain(
      "vitest run --passWithNoTests --pool=threads --maxWorkers=1 --no-file-parallelism",
    );
    expect(requirements).toContain("check:system-topology");
    expect(requirements).toContain("check:data-resources");
    expect(requirements).toContain("check:promotion-boundary");
    expect(requirements).not.toContain(".github/workflows/quality.yml");
    expect(requirements).not.toContain("Justfile");
    expect(requirements).toContain("lefthook.yml");
    expect(requirements).not.toContain("bounded-ai-review");
    const firewallPipeline = descriptor.requirements.find(
      ({ file }) => file === ".woodpecker/firewall.yml",
    );
    const firewallIncludes = firewallPipeline?.includes;
    expect(firewallIncludes).toContain("trusted-ci-policy");
    expect(firewallIncludes).toContain(
      "node:22.23.2-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a",
    );
    expect(firewallIncludes).toContain("tooling/ci/firewall.sh");
    expect(firewallIncludes).not.toContain("ai-review-cycle.mts");
    const firewallScript = descriptor.requirements.find(
      ({ file }) => file === "tooling/ci/firewall.sh",
    );
    expect(firewallScript?.includes).not.toContain("pnpm review:bounded");
    expect(firewallScript?.includes).toContain(
      "if ! bash tooling/ci/install-qlty.sh",
    );

    const hook = descriptor.requirements.find(
      ({ file }) => file === "lefthook.yml",
    );
    expect(hook?.includes).toEqual(
      expect.arrayContaining([
        "pnpm prettier --write {staged_files}",
        "ESLINT_SHIFT_LEFT=1 pnpm eslint {staged_files}",
        "pnpm check:qlty -- --staged",
      ]),
    );
    expect(hook?.absent).toEqual(
      expect.arrayContaining([
        "pre-push-rubric.sh",
        "pnpm typecheck",
        "pnpm test",
        "check:workflow",
        "check:system",
        "check:data-resources",
        "check:promotion-boundary",
        "acceptance:",
      ]),
    );
  });

  it("pins required-context reachability and unique nested checks", () => {
    const verifyChassis = descriptor.requirements.find(
      ({ file }) => file === "tooling/ci/verify-chassis.sh",
    );
    expect(verifyChassis?.includes).toEqual(
      expect.arrayContaining([
        "bash tooling/ci/install-gitleaks.sh",
        "pnpm verify:without-coverage",
      ]),
    );
    expect(verifyChassis?.absent).toEqual(
      expect.arrayContaining([
        "install-gitleaks.sh || true",
        "if ! bash tooling/ci/install-gitleaks.sh",
        "pnpm --dir tooling/agent-pack test:customer",
        "pnpm --dir tooling/generators test",
        "pnpm --dir tooling/release test",
        "pnpm --dir apps/cli test:create-root-admission",
        "pnpm --dir apps/cli test:create-root-integration",
        "pnpm --dir apps/web typecheck",
        "pnpm --dir apps/web build",
        "pnpm --dir apps/web test:runtime-longevity",
      ]),
    );

    const rootPackage = descriptor.requirements.find(
      ({ file, includes }) =>
        file === "package.json" && includes?.includes('"verify"'),
    );
    expect(rootPackage?.includes).toEqual(
      expect.arrayContaining([
        '"test:heavyweight-customer-artifacts": "node tooling/ci/run-heavyweight-suites.mjs"',
        '"verify:without-coverage"',
        '"check:agent-pack": "tsx tooling/agent-pack/src/syncSkills.ts && tsx tooling/quality/check-agent-pack.mts"',
        '"check:app-map": "pnpm --dir tooling/app-map check"',
        '"check:confect-manifest": "tsx tooling/confect-manifest/src/check.ts"',
      ]),
    );

    const aggregateVerification = descriptor.requirements.find(
      ({ file }) => file === ".woodpecker/verify.yml",
    );
    expect(aggregateVerification?.includes).toEqual(
      expect.arrayContaining([
        "depth: 1",
        "verify-core",
        "verify-coverage",
        "status: [success, failure]",
        "node tooling/ci/verify-aggregate.mjs",
      ]),
    );

    const coverageVerification = descriptor.requirements.find(
      ({ file }) => file === "tooling/ci/verify-coverage.sh",
    );
    expect(coverageVerification?.includes).toEqual(
      expect.arrayContaining([
        "source tooling/ci/setup.sh",
        "bash tooling/ci/install-gitleaks.sh",
        "pnpm exec playwright install --with-deps chromium",
        "pnpm check:coverage-ratchet",
      ]),
    );
    expect(coverageVerification?.absent).toEqual(
      expect.arrayContaining(["strace", "pnpm verify"]),
    );
  });

  it("assigns every protected path to the verified write-enabled operator", () => {
    const rules = readFileSync(
      new URL("../../.github/CODEOWNERS", import.meta.url),
      "utf8",
    )
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));

    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((rule) => rule.endsWith(" @timkeeeeeen"))).toBe(true);
    expect(rules.join("\n")).not.toContain("@kimprobably");
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

  it("keeps focused workspace aliases out of root verify", () => {
    const verify = [
      "pnpm test",
      "pnpm test:workflow",
      "pnpm check:app-map",
      "pnpm check:config-drift",
      "pnpm check:convex-ai-files",
      "pnpm check:agent-pack",
    ].join(" && ");

    expect(validateRootVerifyHostTerms({ scripts: { verify } })).toContain(
      "package.json scripts.verify must not rerun pnpm test:workflow after root test",
    );
    expect(validateRootVerifyHostTerms({ scripts: { verify } })).toContain(
      "package.json scripts.verify must not rerun pnpm check:app-map after root test",
    );
  });
});
