import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  createSaasUiTypecheckBaseline,
  saasUiTypecheckBaselinePath,
} from "./check-saas-ui-typecheck.mts";

const root = process.cwd();
let output = "";
try {
  execFileSync(
    resolve(root, "node_modules/.bin/tsc"),
    [
      "-p",
      "apps/web/tsconfig.json",
      "--noEmit",
      "--incremental",
      "false",
      "--pretty",
      "false",
    ],
    { cwd: root, encoding: "utf8", stdio: "pipe" },
  );
} catch (error) {
  const result = error as {
    stdout?: string | Buffer;
    stderr?: string | Buffer;
  };
  output = `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`;
}

const typescriptPackage = JSON.parse(
  readFileSync(resolve(root, "node_modules/typescript/package.json"), "utf8"),
) as { version?: unknown };
if (typeof typescriptPackage.version !== "string")
  throw new Error("installed TypeScript version is invalid");

const path = resolve(root, saasUiTypecheckBaselinePath);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(
  path,
  `${JSON.stringify(
    createSaasUiTypecheckBaseline(root, output, typescriptPackage.version),
    null,
    2,
  )}\n`,
);
