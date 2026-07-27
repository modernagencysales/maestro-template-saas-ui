#!/usr/bin/env node
import { isGeneratorDirectRun } from "./direct-run";
import { runGeneratorCli } from "./index";

export const runGeneratorCliProcess = (
  argv: readonly string[] = process.argv.slice(2),
): 0 | 1 => {
  const result = runGeneratorCli(argv);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.exitCode;
};

if (isGeneratorDirectRun(import.meta.url)) {
  process.exitCode = runGeneratorCliProcess();
}
