#!/usr/bin/env node
import { runCustomerGeneratorCli } from "./customer-dispatcher";
import { isGeneratorDirectRun } from "./direct-run";

export const runCustomerGeneratorCliProcess = (
  argv: readonly string[] = process.argv.slice(2),
): 0 | 1 => {
  const result = runCustomerGeneratorCli(argv);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.exitCode;
};

if (isGeneratorDirectRun(import.meta.url)) {
  process.exitCode = runCustomerGeneratorCliProcess();
}
