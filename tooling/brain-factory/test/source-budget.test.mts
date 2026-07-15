import { describe, expect, it } from "vitest";
import {
  changedHandAuthoredSourceLines,
  isHandAuthoredSource,
  validSourceSlices,
} from "../src/source-budget.js";

describe("Brain task source budgets", () => {
  it("counts application and tooling source changes", () => {
    expect(
      changedHandAuthoredSourceLines(
        [
          "20\t2\tpackages/integrations/src/llm.ts",
          "10\t0\tapps/web/src/feature.tsx",
          "5\t1\ttooling/evals/src/index.mts",
        ].join("\n"),
      ),
    ).toBe(38);
  });

  it("excludes tests, fixtures, generated output, docs, and vendored source", () => {
    expect(
      changedHandAuthoredSourceLines(
        [
          "200\t0\tpackages/convex/test/brain.test.ts",
          "200\t0\ttooling/evals/fixtures/cases.ts",
          "200\t0\tpackages/convex/convex/_generated/api.js",
          "200\t0\tdocs/product/brain.md",
          "200\t0\trepos/effect/packages/effect/src/Effect.ts",
        ].join("\n"),
      ),
    ).toBe(0);
  });

  it("recognizes only hand-authored source roots", () => {
    expect(isHandAuthoredSource("packages/search/src/index.ts")).toBe(true);
    expect(isHandAuthoredSource("scripts/tool.mjs")).toBe(false);
  });

  it("allows at most four individually bounded source slices", () => {
    expect(validSourceSlices([280, 300, 90])).toBe(true);
    expect(validSourceSlices([301])).toBe(false);
    expect(validSourceSlices([10, 20, 30, 40, 50])).toBe(false);
  });

  it("supports an explicit five-slice task contract", () => {
    expect(validSourceSlices([280, 272, 229, 57, 261], 300, 5)).toBe(true);
    expect(validSourceSlices([280, 272, 229, 57, 301], 300, 5)).toBe(false);
    expect(validSourceSlices([1, 2, 3, 4, 5, 6], 300, 5)).toBe(false);
  });
});
