import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import {
  buildGoldenSummaryInput,
  runGoldenSummaryCommands,
  writeGoldenSummaries,
} from "./golden-summaries";

function usage(): never {
  throw new Error(
    "Usage: write-golden-summaries.mts --receipt <machine-created-receipt>",
  );
}

function parseArgs(argv: readonly string[]) {
  if (argv.length !== 0) usage();
  return {};
}

export function main(argv = process.argv.slice(2)): void {
  parseArgs(argv);
  const repositoryRoot = process.cwd();
  const receipt = runGoldenSummaryCommands(repositoryRoot);
  const input = buildGoldenSummaryInput({
    repositoryRoot,
    receipt,
  });
  writeGoldenSummaries(
    resolve(repositoryRoot, "artifacts/saas-ui-golden"),
    input,
    repositoryRoot,
  );
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
