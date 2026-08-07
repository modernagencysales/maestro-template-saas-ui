import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cliFailure, cliSuccess } from "../result";
import type { CliResult } from "../types";
import type { FactoryCliHandler } from "./router";

export const CONTRACTS_HELP =
  "maestro contracts add <journey> | check | test [journey|--required]\n";

type RunContractProcess = (
  args: readonly string[],
  cwd: string,
) => CliResult | Promise<CliResult>;

const runContractProcess: RunContractProcess = (args, cwd) => {
  const result = spawnSync("pnpm", [...args], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  return {
    exitCode: result.status === 0 ? 0 : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr || (result.error ? `${result.error.message}\n` : ""),
  };
};

const journeySlug = (value: string | undefined): string | undefined =>
  value !== undefined && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
    ? value
    : undefined;

const addContract = (argv: readonly string[], cwd: string): CliResult => {
  const slug = argv.length === 3 ? journeySlug(argv[2]) : undefined;
  if (slug === undefined) return cliFailure(CONTRACTS_HELP);

  const words = slug.replaceAll("-", " ");
  const title = `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
  const relativePath = `features/${slug}.feature`;
  try {
    mkdirSync(join(cwd, "features"), { recursive: true });
    writeFileSync(
      join(cwd, relativePath),
      `@wip
Feature: ${title}
  Describe the promised outcome in business language.

  Scenario: Complete ${words}
    Given the product is ready
    When the user completes ${words}
    Then the promised outcome is observable
`,
      { encoding: "utf8", flag: "wx" },
    );
    return cliSuccess(`Created ${relativePath}\n`);
  } catch (error) {
    return cliFailure(
      error instanceof Error && "code" in error && error.code === "EEXIST"
        ? `${relativePath} already exists.\n`
        : `Could not create ${relativePath}.\n`,
    );
  }
};

const testContracts = async (
  argv: readonly string[],
  cwd: string,
  run: RunContractProcess,
): Promise<CliResult> => {
  if (argv.length === 2) return run(["--silent", "acceptance:cucumber"], cwd);
  if (argv.length !== 3) return cliFailure(CONTRACTS_HELP);

  const target = argv[2];
  if (target === "--required") {
    const admission = await run(
      ["--silent", "acceptance:required-selection"],
      cwd,
    );
    if (admission.exitCode !== 0) return admission;
    return run(["--silent", "acceptance:cucumber", "--tags", "@required"], cwd);
  }
  const slug = journeySlug(target);
  return slug === undefined
    ? cliFailure(CONTRACTS_HELP)
    : run(["--silent", "acceptance:cucumber", `features/${slug}.feature`], cwd);
};

export const createContractsCliHandler = (
  run: RunContractProcess = runContractProcess,
): FactoryCliHandler => ({
  command: "contracts",
  run: async (argv, cwd) => {
    if (argv[1] === "add") return addContract(argv, cwd);
    if (argv.length === 2 && argv[1] === "check")
      return run(["--silent", "acceptance:check"], cwd);
    if (argv[1] === "test") return testContracts(argv, cwd, run);
    return cliFailure(CONTRACTS_HELP);
  },
});
