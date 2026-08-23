import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { droppedMetrics, readTotals } from "./check-coverage-ratchet.mts";

const summary = (pct: number) =>
  JSON.stringify({
    total: {
      lines: { pct },
      functions: { pct },
      branches: { pct },
      statements: { pct },
    },
  });

const baseline = (pct: number) =>
  JSON.stringify({
    lines: pct,
    functions: pct,
    branches: pct,
    statements: pct,
  });

describe("check:coverage-ratchet", () => {
  it("reads nested vitest summaries and flat baselines", () => {
    const dir = mkdtempSync(join(tmpdir(), "ratchet-"));
    const summaryPath = join(dir, "coverage-summary.json");
    const baselinePath = join(dir, "coverage-baseline.json");
    writeFileSync(summaryPath, summary(81.25));
    writeFileSync(baselinePath, baseline(80));

    expect(readTotals(summaryPath, true).lines).toBe(81.25);
    expect(readTotals(baselinePath, false).branches).toBe(80);
  });

  it("passes when coverage holds or rises", () => {
    const actual = {
      lines: 82,
      functions: 80,
      branches: 80,
      statements: 82,
    };
    const base = { lines: 80, functions: 80, branches: 80, statements: 80 };

    expect(droppedMetrics(actual, base)).toEqual([]);
  });

  it("flags every metric that fell below the baseline", () => {
    const actual = {
      lines: 79,
      functions: 80,
      branches: 70.5,
      statements: 80,
    };
    const base = { lines: 80, functions: 80, branches: 80, statements: 80 };

    expect(droppedMetrics(actual, base)).toEqual(["lines", "branches"]);
  });

  it("ignores float noise below the epsilon", () => {
    const actual = {
      lines: 79.99,
      functions: 80,
      branches: 80,
      statements: 80,
    };
    const base = { lines: 80, functions: 80, branches: 80, statements: 80 };

    expect(droppedMetrics(actual, base)).toEqual([]);
  });

  it("still rejects the next two-decimal reporting quantum", () => {
    const actual = {
      lines: 79.98,
      functions: 80,
      branches: 80,
      statements: 80,
    };
    const base = { lines: 80, functions: 80, branches: 80, statements: 80 };

    expect(droppedMetrics(actual, base)).toEqual(["lines"]);
  });

  it("throws on malformed summaries instead of passing silently", () => {
    const dir = mkdtempSync(join(tmpdir(), "ratchet-bad-"));
    const summaryPath = join(dir, "coverage-summary.json");
    writeFileSync(summaryPath, JSON.stringify({ total: { lines: {} } }));

    expect(() => readTotals(summaryPath, true)).toThrowError(
      "coverage summary is missing a numeric pct",
    );
  });
});
