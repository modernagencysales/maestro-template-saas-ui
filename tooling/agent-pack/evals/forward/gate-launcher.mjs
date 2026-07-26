#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const directGate = (path) => [
  {
    command: process.execPath,
    args: ["--import", "tsx", path],
  },
];

const gates = {
  "check:gates": directGate("tooling/quality/check-gates.mts"),
  "check:convex-ai-files": directGate(
    "tooling/quality/check-convex-ai-files.mts",
  ),
  "check:workflow:fast": [
    {
      command: "pnpm",
      args: ["--dir", "tooling/eslint-plugin-template", "test"],
    },
    {
      command: "pnpm",
      args: ["--dir", "packages/template-core", "test", "workflow-semantics"],
    },
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
    const result = spawnSync(step.command, step.args, {
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
