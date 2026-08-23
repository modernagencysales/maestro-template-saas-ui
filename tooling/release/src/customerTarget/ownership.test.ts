import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertMaterializableCustomerReleaseManifest,
  resolveCustomerReleasePath,
  validateCustomerReleaseManifest,
} from "./manifest";
import {
  buildCustomerOwnershipInventory,
  classifyCustomerSourcePath,
} from "./ownership";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const sourceCommit = "517b5bc28d1d633bef18f57610cff49800123788";
const sourcePaths = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", "HEAD"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .trim()
  .split("\n");
describe("customer ownership inventory", () => {
  it("pins exact vendored authorities outside customer workspaces", () => {
    const guidePath = resolve(repoRoot, "repos/README.md");
    expect(existsSync(guidePath)).toBe(true);

    const guide = readFileSync(guidePath, "utf8");
    expect(guide).toContain("effect@4.0.0-beta.102");
    expect(guide).toContain("de2a9a69099993087e57c64df58537c765ac0224");
    expect(guide).toContain("@confect/core@10.0.0-next.9");
    expect(guide).toContain("ba0fb82222d487bdf62fde2c429e92628f8a0585");
    expect(
      readFileSync(resolve(repoRoot, "pnpm-workspace.yaml"), "utf8"),
    ).not.toMatch(/repos\/(?:effect|confect)/u);
    expect(
      classifyCustomerSourcePath("repos/effect/package.json"),
    ).toMatchObject({ ownership: "factory-only", action: "omit" });
    expect(
      classifyCustomerSourcePath("repos/confect/packages/core/package.json"),
    ).toMatchObject({ ownership: "factory-only", action: "omit" });
  });

  it("matches the installed Effect and Confect source versions", () => {
    const effectPackage = JSON.parse(
      readFileSync(
        resolve(repoRoot, "repos/effect/packages/effect/package.json"),
        "utf8",
      ),
    ) as { readonly version: string };
    const confectPackage = JSON.parse(
      readFileSync(
        resolve(repoRoot, "repos/confect/packages/core/package.json"),
        "utf8",
      ),
    ) as { readonly version: string };

    expect(effectPackage.version).toBe("4.0.0-beta.102");
    expect(confectPackage.version).toBe("10.0.0-next.9");
  });

  it("classifies every path in the current source tree", () => {
    const inventory = buildCustomerOwnershipInventory(sourcePaths);

    expect(inventory).toHaveLength(sourcePaths.length);
    expect(new Set(inventory.map(({ ownership }) => ownership))).toEqual(
      new Set([
        "template-owned",
        "customer-extension",
        "generated",
        "factory-only",
      ]),
    );
    expect(() =>
      buildCustomerOwnershipInventory([...sourcePaths, "unknown/new-root.txt"]),
    ).toThrow("Unclassified customer release source path");
  });

  it("does not retain removed Just or stack-tooling ownership", () => {
    expect(classifyCustomerSourcePath("Justfile")).toBeUndefined();
    expect(
      classifyCustomerSourcePath("tooling/stack/package.json"),
    ).toBeUndefined();
  });

  it.each([
    [".factory/project.yaml", "template-owned", "copy"],
    ["cucumber.cjs", "factory-only", "omit"],
    ["tooling/acceptance/check-contracts.mts", "template-owned", "copy"],
    [".claude/settings.json", "generated", "generate"],
    ["maestro-template.mjs", "template-owned", "copy"],
    ["apps/web/src/routes/index.tsx", "template-owned", "copy"],
    ["tooling/generators/src/index.ts", "template-owned", "copy"],
    ["tooling/quality/check-generated-files.mts", "template-owned", "copy"],
    ["tooling/app-map/src/build.ts", "template-owned", "copy"],
    ["tooling/app-map/INTEGRATION_REQUEST.md", "factory-only", "omit"],
    ["tooling/release-seal.mts", "factory-only", "omit"],
    ["tooling/release-seal.test.mts", "factory-only", "omit"],
    [
      "tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts",
      "factory-only",
      "omit",
    ],
    [
      "tooling/agent-pack/src/privacy/runtimeNetworkInterceptor.mjs",
      "factory-only",
      "omit",
    ],
    [
      "tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json",
      "factory-only",
      "omit",
    ],
    ["docs/agent/host-projection-lifecycle.md", "template-owned", "copy"],
    ["docs/template/quickstart.md", "template-owned", "copy"],
    ["examples/generic-ai-ops/seed/workspace.json", "template-owned", "copy"],
    ["patches/@confect__cli@9.1.5.patch", "template-owned", "copy"],
    ["project.config.json", "customer-extension", "copy"],
    ["product.contract.yaml", "generated", "generate"],
    ["product.contract.schema.json", "generated", "generate"],
    ["docs/template/generated/product-contract.md", "generated", "generate"],
    ["playwright.acceptance.config.ts", "generated", "generate"],
    ["tooling/acceptance/checkout-state.mts", "generated", "generate"],
    ["tooling/acceptance/product-contract.mts", "generated", "generate"],
    ["tooling/acceptance/run-acceptance.mts", "generated", "generate"],
    ["tooling/acceptance/playwright-report.mts", "generated", "generate"],
    ["docs/product/records-plan.md", "generated", "generate"],
    ["tests/acceptance/records.spec.ts", "generated", "generate"],
    ["tests/acceptance/support/fixtures.ts", "generated", "generate"],
    ["tests/acceptance/support/runtime.ts", "generated", "generate"],
    ["apps/web/src/routeTree.gen.ts", "generated", "generate"],
    ["docs/superpowers/specs/agent-pack.md", "factory-only", "omit"],
    ["docs/template/porting-backlog.md", "factory-only", "omit"],
    ["repos/effect/package.json", "factory-only", "omit"],
    ["tooling/evals/package.json", "factory-only", "omit"],
    ["examples/gtm-implementation/README.md", "factory-only", "omit"],
    ["examples/saas-application/seed/workspace.json", "factory-only", "omit"],
    ["packages/app-idea-evaluator/package.json", "factory-only", "omit"],
    [
      "tooling/generators/src/blueprints/customer/alpha2-plan.json.gz.b64",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/buildPacks/packs.impl.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/evaluator/freeEvaluationRuntime.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/_generated/registeredFunctions/demo/showcase.ts",
      "factory-only",
      "omit",
    ],
    ["packages/convex/convex/demo/showcase.ts", "factory-only", "omit"],
    [
      "packages/convex/confect/capabilities/evaluateAppIdea.impl.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/capabilities/manageEvaluationReport.impl.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/commerce/checkout.impl.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/workflowContracts/generateCompleteBuildPack.spec.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/convex/workflowRunners/generateCompleteBuildPack.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/_generated/registeredFunctions/buildPacks/packs.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/confect/_generated/tables/buildPacks.ts",
      "factory-only",
      "omit",
    ],
    ["packages/convex/confect/tables/buildPacks.ts", "factory-only", "omit"],
    [
      "packages/convex/convex/capabilities/evaluateAppIdea.ts",
      "factory-only",
      "omit",
    ],
    [
      "packages/convex/test/app-idea-funnel-capabilities.test.ts",
      "factory-only",
      "omit",
    ],
    ["packages/convex/test/evaluator-state.test.ts", "factory-only", "omit"],
    ["apps/web/src/routes/evaluate.tsx", "factory-only", "omit"],
    ["apps/web/src/routes/build-pack.$packId.tsx", "factory-only", "omit"],
    ["apps/web/src/routes/privacy.tsx", "factory-only", "omit"],
    ["apps/web/src/routes/support.tsx", "factory-only", "omit"],
    ["apps/web/src/routes/terms.tsx", "factory-only", "omit"],
    ["apps/web/src/providers/posthog.test.tsx", "factory-only", "omit"],
    ["apps/web/src/public-routes.test.tsx", "factory-only", "omit"],
    [
      "apps/web/src/features/public-funnel/intake/intake-view.tsx",
      "factory-only",
      "omit",
    ],
    ["packages/integrations/src/dodo.ts", "template-owned", "copy"],
    [
      "apps/cli/src/factory/customerCandidateFixture.ts",
      "factory-only",
      "omit",
    ],
    [".codex/config.toml", "factory-only", "omit"],
    [".superpowers/sdd/task-2-report.md", "factory-only", "omit"],
  ])("pins %s ownership", (path, ownership, action) => {
    expect(classifyCustomerSourcePath(path)).toMatchObject({
      path,
      ownership,
      action,
    });
  });

  it("binds the complete unpublished fixture to its declared hashes", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(repoRoot, "releases/v0.1.0-alpha.1/manifest.json"),
        "utf8",
      ),
    );
    const shippedFiles = fixture.expectedHashes;
    const shippedPaths = Object.keys(shippedFiles);
    const manifest = validateCustomerReleaseManifest(fixture, shippedFiles);

    expect(manifest.release.sourceCommit).toBe(sourceCommit);
    expect(
      shippedPaths.every((path) =>
        Boolean(resolveCustomerReleasePath(manifest.paths, path)),
      ),
    ).toBe(true);
    expect(manifest.materializationStatus).toBe("fixture-only");
    expect(() =>
      assertMaterializableCustomerReleaseManifest(manifest, {
        tag: manifest.release.tag,
        sourceCommit: manifest.release.sourceCommit,
        sourceChecksum: manifest.release.sourceChecksum,
      }),
    ).toThrow("Release manifest is fixture-only");
  });
});
