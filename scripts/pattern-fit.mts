#!/usr/bin/env tsx
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

type WorkKind = "fixture-to-real" | "pattern-instance" | "template-gap";

type Counts = Record<WorkKind, number>;

const workKinds = new Set<WorkKind>([
  "fixture-to-real",
  "pattern-instance",
  "template-gap",
]);

const emptyCounts = (): Counts => ({
  "fixture-to-real": 0,
  "pattern-instance": 0,
  "template-gap": 0,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const jsonFilesUnder = (path: string): readonly string[] => {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return path.endsWith(".json") ? [path] : [];
  if (!stat.isDirectory()) return [];

  return readdirSync(path).flatMap((entry) =>
    jsonFilesUnder(join(path, entry)),
  );
};

const stackPlanPaths = (args: readonly string[]): readonly string[] => {
  if (args.length > 0) return args.flatMap(jsonFilesUnder);
  return [];
};

const workKind = (value: unknown): WorkKind | undefined =>
  typeof value === "string" && workKinds.has(value as WorkKind)
    ? (value as WorkKind)
    : undefined;

const workPackagesFor = (
  slice: unknown,
): readonly Record<string, unknown>[] => {
  if (!isObject(slice) || !Array.isArray(slice.workPackages)) return [];
  return slice.workPackages.filter(isObject);
};

const countWorkPackages = (
  workPackages: readonly Record<string, unknown>[],
): Counts =>
  workPackages.reduce((counts, workPackage) => {
    const kind = workKind(workPackage.kind);
    if (kind) counts[kind] += 1;
    return counts;
  }, emptyCounts());

const planSlices = (path: string): readonly unknown[] => {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return isObject(parsed) && Array.isArray(parsed.slices) ? parsed.slices : [];
};

const countPlan = (path: string): Counts => {
  const sliceCounts = planSlices(path).map((slice) =>
    countWorkPackages(workPackagesFor(slice)),
  );
  return sliceCounts.reduce(addCounts, emptyCounts());
};

const addCounts = (left: Counts, right: Counts): Counts => ({
  "fixture-to-real": left["fixture-to-real"] + right["fixture-to-real"],
  "pattern-instance": left["pattern-instance"] + right["pattern-instance"],
  "template-gap": left["template-gap"] + right["template-gap"],
});

const paths = stackPlanPaths(process.argv.slice(2));
const counts = paths.map(countPlan).reduce(addCounts, emptyCounts());
const templateBacked = counts["fixture-to-real"] + counts["pattern-instance"];
const total = templateBacked + counts["template-gap"];
const patternFit = total === 0 ? 0 : templateBacked / total;

console.log(
  JSON.stringify(
    {
      files: paths,
      counts,
      patternFit,
      patternFitPercent: `${(patternFit * 100).toFixed(1)}%`,
    },
    null,
    2,
  ),
);
