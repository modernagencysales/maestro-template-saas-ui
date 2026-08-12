import { pathToFileURL } from "node:url";

import {
  buildGoldenSummaryInput,
  readGoldenRunReceipt,
  writeGoldenSummaries,
  type GoldenCommandResult,
} from "./golden-summaries";

function usage(): never {
  throw new Error(
    "Usage: write-golden-summaries.mts --receipt <path> [--output-root <path>] | --generated-at <ISO> --evidence <repo-relative-path> --command <command> --exit-code <n> --completed-at <ISO>",
  );
}

function parseArgs(argv: readonly string[]) {
  let receiptPath: string | undefined;
  let outputRoot = "artifacts/saas-ui-golden";
  let generatedAt: string | undefined;
  const evidencePaths: string[] = [];
  const commands: Array<{
    command?: string;
    exitCode?: number;
    completedAt?: string;
    result?: string;
  }> = [];
  const deviations: unknown[] = [];

  const handlers: Record<string, (value: string) => void> = {
    "--receipt": (value) => {
      receiptPath = value;
    },
    "--input": (value) => {
      receiptPath = value;
    },
    "--output-root": (value) => {
      outputRoot = value;
    },
    "--generated-at": (value) => {
      generatedAt = value;
    },
    "--evidence": (value) => {
      evidencePaths.push(value);
    },
    "--command": (value) => {
      commands.push({ command: value });
    },
    "--exit-code": (value) => {
      const command = commands.at(-1);
      if (!command) usage();
      command.exitCode = Number(value);
    },
    "--completed-at": (value) => {
      const command = commands.at(-1);
      if (!command) usage();
      command.completedAt = value;
    },
    "--result": (value) => {
      const command = commands.at(-1);
      if (!command) usage();
      command.result = value;
    },
    "--deviation": (value) => {
      deviations.push(JSON.parse(value));
    },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || value === undefined) usage();
    const handler = handlers[flag];
    if (!handler) usage();
    handler(value);
    index += 1;
  }

  if (
    receiptPath &&
    (generatedAt || evidencePaths.length > 0 || commands.length > 0)
  )
    throw new Error(
      "Receipt and explicit command arguments cannot be combined",
    );

  return {
    receiptPath,
    outputRoot,
    generatedAt,
    evidencePaths,
    commands: commands.map((command) => command as GoldenCommandResult),
    deviations,
  };
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseArgs(argv);
  const repositoryRoot = process.cwd();
  const input = options.receiptPath
    ? buildGoldenSummaryInput({
        repositoryRoot,
        receipt: readGoldenRunReceipt(options.receiptPath),
      })
    : buildGoldenSummaryInput({
        repositoryRoot,
        generatedAt: options.generatedAt,
        evidencePaths: options.evidencePaths,
        commands: options.commands,
        deviations: options.deviations as never,
      });
  writeGoldenSummaries(options.outputRoot, input);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
