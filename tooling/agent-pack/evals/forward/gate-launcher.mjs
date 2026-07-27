#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, join } from "node:path";
import process from "node:process";

const directGate = (path) => [{ kind: "tsx", path }];
const commandGate = (command, args) => ({ kind: "command", command, args });

const gates = {
  "check:gates": directGate("tooling/quality/check-gates.mts"),
  "check:convex-ai-files": directGate(
    "tooling/quality/check-convex-ai-files.mts",
  ),
  "check:workflow:fast": [
    commandGate("pnpm", ["--dir", "tooling/eslint-plugin-template", "test"]),
    commandGate("pnpm", [
      "--dir",
      "packages/template-core",
      "test",
      "workflow-semantics",
    ]),
    ...directGate("tooling/quality/check-workflow-semantics.mts"),
  ],
  "check:workflow-version-immutability": directGate(
    "tooling/quality/check-workflow-version-immutability.mts",
  ),
  "check:workflow-semantics": directGate(
    "tooling/quality/check-workflow-semantics.mts",
  ),
  "check:promotion-boundary": directGate(
    "tooling/quality/check-promotion-boundary.mts",
  ),
};

const gate = process.argv[2];
if (!gate || process.argv.length !== 3 || !(gate in gates)) {
  process.stderr.write(
    `Usage: node tooling/agent-pack/evals/forward/gate-launcher.mjs <${Object.keys(gates).join("|")}>\n`,
  );
  process.exitCode = 64;
} else {
  for (const step of gates[gate]) {
    const command = step.kind === "tsx" ? process.execPath : step.command;
    const args =
      step.kind === "tsx"
        ? ["--import", resolveTsxLoader(), step.path]
        : step.args;
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    if (result.error) {
      process.stderr.write(`${result.error.message}\n`);
      process.exitCode = 1;
      break;
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
}

function resolveTsxLoader() {
  const path = process.env.PATH;
  if (!path) {
    throw new Error(
      "The frozen gate launcher requires the evaluator's pinned pnpm PATH.",
    );
  }
  const executableNames =
    process.platform === "win32" ? ["tsx.cmd", "tsx.exe", "tsx"] : ["tsx"];
  for (const directory of path.split(delimiter)) {
    if (
      directory.length === 0 ||
      !executableNames.some((name) => existsSync(join(directory, name)))
    ) {
      continue;
    }
    try {
      return createRequire(
        join(directory, "maestro-gate-launcher.cjs"),
      ).resolve("tsx");
    } catch {
      // Keep searching the inherited allowlisted PATH for the pinned package.
    }
  }
  throw new Error(
    "The frozen gate launcher could not resolve tsx from the evaluator's pinned pnpm PATH.",
  );
}
