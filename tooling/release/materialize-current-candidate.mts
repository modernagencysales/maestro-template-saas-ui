#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCanonicalTemplateInstance,
  buildCandidateReleaseFixture,
  buildNeutralSaasPlan,
  createCurrentTemplateInstanceConsumer,
} from "../../apps/cli/src/factory/customerCandidateFixture";
import { loadCustomerCreateComposition } from "../../apps/cli/src/factory/createComposition";

type CandidateArguments = Readonly<{
  targetRoot: string;
  name: string;
  outcome: string;
}>;

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const candidateOptions = new Set(["--target", "--name", "--outcome"]);

const parseCandidateValues = (argv: readonly string[]): Map<string, string> => {
  if (argv.length % 2 !== 0)
    throw new Error(
      `Current candidate argument needs a value: ${argv.at(-1) ?? ""}`,
    );
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index] ?? "";
    const value = argv[index + 1] ?? "";
    if (!candidateOptions.has(token))
      throw new Error(`Unknown current candidate argument: ${token}`);
    values.set(token, value);
  }
  return values;
};

const requiredCandidateValue = (
  values: ReadonlyMap<string, string>,
  option: string,
): string => {
  const value = values.get(option)?.trim();
  if (!value) throw new Error(`current candidate requires ${option}`);
  return value;
};

export function parseCandidateArguments(
  argv: readonly string[],
): CandidateArguments {
  const values = parseCandidateValues(argv[0] === "--" ? argv.slice(1) : argv);
  const targetRoot = requiredCandidateValue(values, "--target");
  const name = requiredCandidateValue(values, "--name");
  const outcome = requiredCandidateValue(values, "--outcome");
  if (!isAbsolute(targetRoot))
    throw new Error("current candidate --target must be an absolute path");
  return {
    targetRoot: resolve(targetRoot),
    name,
    outcome,
  };
}

const gitText = (root: string, args: readonly string[]): string =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

export function initializeStandaloneCandidateRepository(
  targetRoot: string,
): string {
  if (existsSync(join(targetRoot, ".git")))
    throw new Error(
      `Current candidate target is already a Git repository: ${targetRoot}`,
    );
  execFileSync("git", ["-C", targetRoot, "init", "-q", "-b", "main"]);
  execFileSync("git", ["-C", targetRoot, "add", "-A"]);
  execFileSync(
    "git",
    [
      "-C",
      targetRoot,
      "-c",
      "user.name=Maestro Candidate Materializer",
      "-c",
      "user.email=materializer@maestro.local",
      "commit",
      "-q",
      "-m",
      "chore: materialize current customer candidate",
    ],
    { stdio: "pipe" },
  );
  if (gitText(targetRoot, ["branch", "--show-current"]) !== "main")
    throw new Error("Current candidate repository must initialize on main");
  if (gitText(targetRoot, ["status", "--porcelain", "--untracked-files=all"]))
    throw new Error("Current candidate repository must initialize cleanly");
  return gitText(targetRoot, ["rev-parse", "HEAD"]);
}

export function assertCurrentCandidateSource(input: {
  readonly sourceRoot: string;
  readonly targetRoot: string;
}): void {
  for (const marker of [
    "releases",
    "apps/cli/src/factory/createComposition.ts",
  ])
    if (!existsSync(join(input.sourceRoot, marker)))
      throw new Error(
        `Current candidate source is not a factory: missing ${marker}`,
      );
  if (
    gitText(input.sourceRoot, [
      "status",
      "--porcelain",
      "--untracked-files=all",
    ])
  )
    throw new Error(
      "Current candidate materialization requires a clean source checkout",
    );
  if (existsSync(input.targetRoot))
    throw new Error(
      `Current candidate target already exists: ${input.targetRoot}`,
    );
  const targetFromSource = relative(input.sourceRoot, input.targetRoot);
  if (
    targetFromSource === "" ||
    (!targetFromSource.startsWith("..") && !isAbsolute(targetFromSource))
  )
    throw new Error(
      "Current candidate target must be outside the factory checkout",
    );
  if (!existsSync(dirname(input.targetRoot)))
    throw new Error(
      `Current candidate target parent does not exist: ${dirname(input.targetRoot)}`,
    );
}

export async function materializeCurrentCandidate(
  args: CandidateArguments,
  sourceRoot: string = repositoryRoot,
): Promise<
  Readonly<{ targetRoot: string; sourceCommit: string; tag: string }>
> {
  assertCurrentCandidateSource({ sourceRoot, targetRoot: args.targetRoot });
  const fixture = buildCandidateReleaseFixture({
    repoRoot: sourceRoot,
    name: args.name,
    outcome: args.outcome,
    buildPlan: buildNeutralSaasPlan,
    // The disposable fixture uses the schema provider's supported alpha.1
    // identity while binding sourceCommit/checksum to the current clone. It is
    // never publishable release authority; sealing creates the real identity.
    authority: "alpha.1",
    targetRoot: args.targetRoot,
  });
  try {
    const create = loadCustomerCreateComposition(
      fixture.source,
      buildNeutralSaasPlan,
      createCurrentTemplateInstanceConsumer(),
    );
    const result = await create.run(
      [
        "create",
        fixture.targetRoot,
        "--name",
        args.name,
        "--outcome",
        args.outcome,
        "--demo-only",
        "--write",
        "--json",
      ],
      fixture.candidateRoot,
    );
    if (result.exitCode !== 0)
      throw new Error(
        `Current candidate materialization failed.\n${result.stdout}${result.stderr}`,
      );
    assertCanonicalTemplateInstance(fixture.targetRoot);
    initializeStandaloneCandidateRepository(fixture.targetRoot);
    return {
      targetRoot: fixture.targetRoot,
      sourceCommit: fixture.reviewedSourceCommit,
      tag: fixture.tag,
    };
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  materializeCurrentCandidate(parseCandidateArguments(process.argv.slice(2)))
    .then((result) =>
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
    )
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
