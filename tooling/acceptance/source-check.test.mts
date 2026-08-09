import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertValidSources } from "./source-check.mts";

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

describe("Cucumber source syntax", () => {
  it("accepts draft Features with undefined steps", async () => {
    const draftOnlyRoot = project(`@wip
Feature: Draft journey
  Scenario: Describe the promise
    Given an undefined draft step
`);

    await expect(assertValidSources(draftOnlyRoot)).resolves.toBeUndefined();
  });

  it("formats malformed Gherkin errors from Cucumber", async () => {
    const invalidRoot = project(`Feature: Broken
  Scenario: Broken
    Given a broken table
      | one |
      | one | two |
`);

    await expect(assertValidSources(invalidRoot)).rejects.toThrow(
      /features\/broken\.feature:\d+:/,
    );
  });
});
