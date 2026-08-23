import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type BranchInventoryItem = {
  readonly name: string;
  readonly sha: string;
  readonly committedAt: string;
  readonly mergedIntoBase: boolean;
};

type BranchDisposition = "keep" | "review-archive" | "review-delete";

export type BranchHygieneManifest = {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly baseRef: string;
  readonly staleBefore: string;
  readonly deletionEnabled: false;
  readonly branches: readonly (BranchInventoryItem & {
    readonly disposition: BranchDisposition;
    readonly reasons: readonly string[];
  })[];
  readonly recoveryTags: readonly {
    readonly sha: string;
    readonly tag: string;
    readonly branches: readonly string[];
  }[];
};

const sortText = (left: string, right: string): number =>
  left.localeCompare(right, "en");

const compactDate = (value: string): string =>
  value.slice(0, 10).replaceAll("-", "");

export const buildBranchHygieneManifest = (input: {
  readonly baseRef: string;
  readonly canonicalBranches: readonly string[];
  readonly protectedBranches: readonly string[];
  readonly generatedAt: string;
  readonly staleBefore: string;
  readonly branches: readonly BranchInventoryItem[];
}): BranchHygieneManifest => {
  const canonical = new Set(input.canonicalBranches);
  const protectedNames = new Set(input.protectedBranches);
  const candidateBranchesBySha = new Map<string, string[]>();

  const branches = [...input.branches]
    .sort((left, right) => sortText(left.name, right.name))
    .map((branch) => {
      const reasons: string[] = [];
      let disposition: BranchDisposition = "keep";

      if (canonical.has(branch.name)) reasons.push("canonical");
      if (protectedNames.has(branch.name)) reasons.push("protected");
      if (reasons.length === 0 && branch.committedAt < input.staleBefore) {
        disposition = branch.mergedIntoBase
          ? "review-delete"
          : "review-archive";
        reasons.push(
          branch.mergedIntoBase ? "merged-into-base" : "not-merged-into-base",
          "older-than-stale-threshold",
        );
        const grouped = candidateBranchesBySha.get(branch.sha) ?? [];
        grouped.push(branch.name);
        candidateBranchesBySha.set(branch.sha, grouped);
      } else if (reasons.length === 0) {
        if (!branch.mergedIntoBase) reasons.push("not-merged-into-base");
        reasons.push("recent");
      }

      return { ...branch, disposition, reasons };
    });

  const recoveryTags = [...candidateBranchesBySha.entries()]
    .sort(([left], [right]) => sortText(left, right))
    .map(([sha, names]) => ({
      sha,
      tag: `archive/branch-cleanup-${compactDate(input.generatedAt)}-${sha.slice(0, 12)}`,
      branches: names.sort(sortText),
    }));

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    baseRef: input.baseRef,
    staleBefore: input.staleBefore,
    deletionEnabled: false,
    branches,
    recoveryTags,
  };
};

const valueAfter = (
  args: readonly string[],
  flag: string,
): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const csvValues = (
  value: string | undefined,
  fallback: readonly string[],
): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [...fallback];

const gitLines = (args: readonly string[]): string[] =>
  execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const inventoryRemoteBranches = (input: {
  readonly remote: string;
  readonly base: string;
}): BranchInventoryItem[] => {
  const prefix = `${input.remote}/`;
  const merged = new Set(
    gitLines([
      "for-each-ref",
      `--merged=${input.remote}/${input.base}`,
      "--format=%(refname:short)",
      `refs/remotes/${input.remote}`,
    ]),
  );

  return gitLines([
    "for-each-ref",
    "--format=%(refname:short)%09%(objectname)%09%(committerdate:iso-strict)",
    `refs/remotes/${input.remote}`,
  ])
    .map((line) => line.split("\t"))
    .filter(([ref]) => ref !== input.remote && ref !== `${input.remote}/HEAD`)
    .map(([ref, sha, committedAt]) => {
      if (!ref?.startsWith(prefix) || !sha || !committedAt) {
        throw new Error(
          `Unable to parse remote branch inventory line: ${ref ?? ""}`,
        );
      }
      return {
        name: ref.slice(prefix.length),
        sha,
        committedAt,
        mergedIntoBase: merged.has(ref),
      };
    });
};

const run = (): void => {
  const args = process.argv.slice(2);
  const remote = valueAfter(args, "--remote") ?? "origin";
  const base = valueAfter(args, "--base") ?? "main";
  const staleDaysText = valueAfter(args, "--stale-days") ?? "30";
  const staleDays = Number.parseInt(staleDaysText, 10);
  if (!Number.isInteger(staleDays) || staleDays < 1) {
    throw new Error("--stale-days must be a positive integer");
  }

  const generatedAt = new Date().toISOString();
  const staleBefore = new Date(
    Date.parse(generatedAt) - staleDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const manifest = buildBranchHygieneManifest({
    baseRef: `${remote}/${base}`,
    canonicalBranches: csvValues(valueAfter(args, "--canonical"), [base]),
    protectedBranches: csvValues(valueAfter(args, "--protected"), [base]),
    generatedAt,
    staleBefore,
    branches: inventoryRemoteBranches({ remote, base }),
  });
  const output = `${JSON.stringify(manifest, null, 2)}\n`;
  const outputPath = valueAfter(args, "--write");
  if (outputPath) {
    const absolutePath = resolve(outputPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, output, "utf8");
    process.stdout.write(`${absolutePath}\n`);
    return;
  }
  process.stdout.write(output);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run();
