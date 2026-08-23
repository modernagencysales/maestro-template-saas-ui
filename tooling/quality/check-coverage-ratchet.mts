/**
 * check-coverage-ratchet — coverage only rises. Compares the vitest
 * json-summary for the Node-pure workspace packages against
 * coverage-baseline.json: any metric below its baseline fails the build.
 * `--update` rewrites the baseline from the current summary and refuses to
 * lower any metric. Ported from maestro.
 */
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const ROOT = new URL("../..", import.meta.url).pathname;
const SUMMARY = `${ROOT}coverage/coverage-summary.json`;
const BASELINE = `${ROOT}coverage-baseline.json`;
const METRICS = ["lines", "functions", "branches", "statements"] as const;
// Vitest reports two-decimal V8 percentages and one scheduling-dependent
// covered function can move the rounded value by 0.01. Ignore that single
// reporting quantum; a 0.02 drop still fails closed.
const EPSILON = 0.015;

type Metric = (typeof METRICS)[number];
type Totals = Record<Metric, number>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pctOf(value: unknown): number {
  if (!isRecord(value) || typeof value.pct !== "number") {
    throw new Error("coverage summary is missing a numeric pct");
  }
  return value.pct;
}

export function readTotals(path: string, nested: boolean): Totals {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const root = isRecord(parsed) ? parsed : {};
  const source = nested && isRecord(root.total) ? root.total : root;
  const totals: Partial<Totals> = {};
  for (const metric of METRICS) {
    totals[metric] = nested
      ? pctOf(source[metric])
      : typeof source[metric] === "number"
        ? source[metric]
        : Number.NaN;
  }
  return totals as Totals;
}

export function droppedMetrics(actual: Totals, baseline: Totals): Metric[] {
  return METRICS.filter(
    (metric) => actual[metric] < baseline[metric] - EPSILON,
  );
}

function main(): void {
  const actual = readTotals(SUMMARY, true);
  const baseline = readTotals(BASELINE, false);

  if (process.argv.includes("--update")) {
    const lowered = droppedMetrics(actual, baseline);
    if (lowered.length > 0) {
      console.error(
        `✗ refusing to lower the baseline: ${lowered.join(", ")} dropped. Raise coverage instead.`,
      );
      process.exit(1);
    }
    const next = Object.fromEntries(
      METRICS.map((metric) => [metric, actual[metric]]),
    );
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    console.log("✓ coverage baseline updated");
    return;
  }

  const drops = droppedMetrics(actual, baseline);
  if (drops.length > 0) {
    console.error("✗ coverage ratchet: coverage fell below the baseline:");
    for (const metric of drops) {
      console.error(
        `  - ${metric}: ${String(actual[metric])}% < baseline ${String(baseline[metric])}%`,
      );
    }
    process.exit(1);
  }
  console.log(
    `✓ coverage ratchet — ${METRICS.map((m) => `${m} ${String(actual[m])}%`).join(", ")} (baseline held)`,
  );
}

if (process.argv[1]?.endsWith("check-coverage-ratchet.mts")) {
  main();
}
