import { describe, expect, it } from "vitest";
import {
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
