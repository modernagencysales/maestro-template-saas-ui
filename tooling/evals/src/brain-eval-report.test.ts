import { describe, expect, it } from "vitest";
import {
  buildBrainEvalReport,
  checkFrozenBrainFixtures,
  wilsonLowerBound95,
} from "./brain-eval-report";

describe("Brain eval report", () => {
  it("builds approved receipts with immutable fixture hashes", () => {
    const report = buildBrainEvalReport();
    expect(report.passed).toBe(true);
    expect(report.fixtureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.suites.map((suite) => suite.suiteName)).toEqual([
      "classification",
      "answers",
      "maintenance",
      "promptInjection",
      "multilingual",
    ]);
  });

  it("checks frozen fixture completeness", () => {
    const receipt = checkFrozenBrainFixtures();
    expect(receipt.passed).toBe(true);
    expect(receipt.fixtureHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses the frozen two-sided 95% Wilson lower-bound algorithm", () => {
    expect(wilsonLowerBound95(500, 500)).toBeGreaterThan(0.99);
    expect(wilsonLowerBound95(90, 100)).toBeLessThan(0.9);
  });
});
