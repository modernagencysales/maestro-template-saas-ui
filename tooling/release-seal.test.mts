import { describe, expect, it } from "vitest";
import {
  buildReviewedAdditionalPaths,
  buildReviewedOwnershipInventory,
  parseReviewedFactoryOnlyExclusions,
} from "./release-seal.mjs";

const factoryRule = (path: string, match: "exact" | "subtree") => ({
  path,
  match,
  ownership: "factory-only",
  action: "omit",
  upgrade: "remove",
});

describe("release seal factory-only exclusions", () => {
  it("classifies reviewed customer additions and omits reviewed factory files", () => {
    const sourcePaths = [
      ".claude/settings.json",
      "README.md",
      "docs/agent/host-projection-lifecycle.md",
      "patches/@confect__cli@9.1.5.patch",
      "tooling/app-map/INTEGRATION_REQUEST.md",
      "tooling/app-map/src/mcp.test.ts",
      "tooling/app-map/src/build.ts",
      "tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json",
      "tooling/release-seal.mts",
      "tooling/release-seal.test.mts",
    ];
    const paths = buildReviewedAdditionalPaths({
      value: [],
      sourcePaths,
      protectedCustomerPaths: [],
      basePaths: [
        {
          path: "README.md",
          match: "exact",
          ownership: "customer-extension",
          action: "copy",
          upgrade: "preserve",
        },
      ],
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".claude/settings.json",
          ownership: "generated",
          action: "generate",
        }),
        expect.objectContaining({
          path: "docs/agent",
          ownership: "template-owned",
          action: "copy",
        }),
        expect.objectContaining({
          path: "tooling/app-map/INTEGRATION_REQUEST.md",
          ownership: "factory-only",
          action: "omit",
        }),
        expect.objectContaining({
          path: "tooling/app-map/src/mcp.test.ts",
          ownership: "factory-only",
          action: "omit",
        }),
        expect.objectContaining({
          path: "tooling/app-map",
          ownership: "template-owned",
          action: "copy",
        }),
        expect.objectContaining({
          path: "tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json",
          ownership: "template-owned",
          action: "copy",
        }),
        expect.objectContaining({
          path: "tooling/release-seal.mts",
          ownership: "factory-only",
          action: "omit",
        }),
      ]),
    );
  });
  it("fails closed when a source path has no reviewed classification", () => {
    expect(() =>
      buildReviewedAdditionalPaths({
        value: [],
        sourcePaths: ["unknown/new-root.txt"],
        protectedCustomerPaths: [],
        basePaths: [],
      }),
    ).toThrow(/Unclassified reviewed release source path/);
  });
  it("inherits an identical reviewed exclusion without duplicating authority", () => {
    const inherited = factoryRule(
      "apps/cli/src/factory/adopt.test.ts",
      "exact",
    );
    const paths = buildReviewedAdditionalPaths({
      value: [],
      sourcePaths: ["apps/cli/src/factory/adopt.test.ts"],
      protectedCustomerPaths: [],
      basePaths: [inherited],
    });

    expect(paths).not.toContainEqual(inherited);
  });
  it("derives explicit reviewed exclusions before inventory classification", () => {
    const sourcePaths = [
      "README.md",
      "examples/saas-application/seed/crud-scenario.json",
    ];
    const exclusions = parseReviewedFactoryOnlyExclusions({
      value: [factoryRule("examples/saas-application", "subtree")],
      sourcePaths,
      protectedCustomerPaths: ["apps/web/src/main.tsx"],
    });
    expect(
      buildReviewedOwnershipInventory({ sourcePaths, exclusions }),
    ).toEqual([
      {
        path: "examples/saas-application/seed/crud-scenario.json",
        match: "exact",
        ownership: "factory-only",
        action: "omit",
        upgrade: "remove",
      },
      {
        path: "README.md",
        match: "exact",
        ownership: "customer-extension",
        action: "copy",
        upgrade: "preserve",
      },
    ]);
  });

  it("rejects unsafe, unknown, missing-source, overlapping, and shipped collisions", () => {
    const sourcePaths = ["examples/saas-application/file.json"];
    expect(() =>
      parseReviewedFactoryOnlyExclusions({
        value: [{ ...factoryRule("../escape", "exact") }],
        sourcePaths,
        protectedCustomerPaths: [],
      }),
    ).toThrow(/invalid/);
    expect(() =>
      parseReviewedFactoryOnlyExclusions({
        value: [
          {
            ...factoryRule("examples/saas-application", "subtree"),
            extra: true,
          },
        ],
        sourcePaths,
        protectedCustomerPaths: [],
      }),
    ).toThrow(/invalid/);
    expect(() =>
      parseReviewedFactoryOnlyExclusions({
        value: [factoryRule("missing", "subtree")],
        sourcePaths,
        protectedCustomerPaths: [],
      }),
    ).toThrow(/no source path/);
    expect(() =>
      parseReviewedFactoryOnlyExclusions({
        value: [
          factoryRule("examples", "subtree"),
          factoryRule("examples/saas-application", "subtree"),
        ],
        sourcePaths,
        protectedCustomerPaths: [],
      }),
    ).toThrow(/Overlapping/);
    expect(() =>
      parseReviewedFactoryOnlyExclusions({
        value: [factoryRule("examples/saas-application", "subtree")],
        sourcePaths,
        protectedCustomerPaths: ["examples/saas-application/customer.ts"],
      }),
    ).toThrow(/customer-shipped/);
  });
});
