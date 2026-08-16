import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifiedImmutableReceiptPaths } from "./check-saas-ui-typecheck.mts";
import { isDirectRun } from "./src/direct-run.mts";

export const typeCoverageIgnorePaths = (root: string): readonly string[] =>
  [...verifiedImmutableReceiptPaths(root)]
    .filter((path) => /[.]tsx?$/u.test(path))
    .sort();

export const runTypeCoverage = (root = process.cwd()): number => {
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=8192",
      fileURLToPath(import.meta.resolve("type-coverage/bin/type-coverage")),
      "--project",
      "tsconfig.type-coverage.json",
      "--at-least",
      "99.7",
      ...typeCoverageIgnorePaths(root).flatMap((path) => [
        "--ignore-files",
        path,
      ]),
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
};

if (isDirectRun(import.meta.url)) process.exitCode = runTypeCoverage();
