#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const entry = fileURLToPath(
  new URL("./apps/cli/src/index.ts", import.meta.url),
);
const child = spawn(
  process.execPath,
  ["--import", "tsx", entry, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", () => {
  process.exitCode = 70;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 70;
});
