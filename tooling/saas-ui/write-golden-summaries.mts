import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import {
  buildGoldenSummaryInput,
  readGoldenRunReceipt,
  writeGoldenSummaries,
} from "./golden-summaries";

function usage(): never {
  throw new Error(
    "Usage: write-golden-summaries.mts --receipt <machine-created-receipt>",
  );
}

function parseArgs(argv: readonly string[]) {
  let receiptPath: string | undefined;
  const handlers: Record<string, (value: string) => void> = {
    "--receipt": (value) => {
      receiptPath = value;
    },
    "--input": (value) => {
      receiptPath = value;
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

  if (!receiptPath) usage();
  return { receiptPath };
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseArgs(argv);
  const repositoryRoot = process.cwd();
  const input = buildGoldenSummaryInput({
    repositoryRoot,
    receipt: readGoldenRunReceipt(options.receiptPath),
  });
  writeGoldenSummaries(
    resolve(repositoryRoot, "artifacts/saas-ui-golden"),
    input,
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
