import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertRequiredSelection } from "./required-selection.mts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

const project = (feature: string): string => {
  const root = mkdtempSync(join(tmpdir(), "maestro-cucumber-"));
  roots.push(root);
  mkdirSync(join(root, "features"));
  writeFileSync(
    join(root, "cucumber.cjs"),
    "module.exports = { default: {} };\n",
  );
  writeFileSync(join(root, "features", "broken.feature"), feature);
  return root;
};

describe("required Cucumber selection", () => {
  it("accepts a required Scenario selected by Cucumber", async () => {
    const requiredRoot = project(`@required
Feature: Required journey
  Scenario: Deliver the promise
    Given the product is ready
`);

    await expect(
      assertRequiredSelection(requiredRoot),
    ).resolves.toBeUndefined();
  });

  it("rejects draft-only Features without inspecting their undefined steps", async () => {
    const draftOnlyRoot = project(`@wip
Feature: Draft journey
  Scenario: Describe the promise
    Given an undefined draft step
`);

    await expect(assertRequiredSelection(draftOnlyRoot)).rejects.toThrow(
      "@required must select at least one Cucumber Scenario",
    );
  });

  it("formats malformed Gherkin errors from Cucumber", async () => {
    const invalidRoot = project(`Feature: Broken
  Scenario: Broken
    Given a broken table
      | one |
      | one | two |
`);

    await expect(assertRequiredSelection(invalidRoot)).rejects.toThrow(
      /features\/broken\.feature:\d+:/,
    );
  });
});
