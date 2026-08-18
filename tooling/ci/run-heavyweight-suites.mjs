#!/usr/bin/env node

import { spawn } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { fileURLToPath } from "node:url";

const lanes = [
  [
    ["--dir", "apps/cli", "test:customer-cli-runtime"],
    ["test:release-filesystem"],
  ],
  [
    ["--dir", "apps/cli", "test:create-root-integration"],
    ["--dir", "tooling/agent-pack", "test:privacy-no-network"],
  ],
];

export async function runHeavyweightSuites() {
  const active = new Set();
  let interrupted;
  const forward = (signal) => {
    interrupted ??= signal;
    for (const child of active) signalProcessGroup(child, signal);
  };
  const onInterrupt = () => forward("SIGINT");
  const onTerminate = () => forward("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  try {
    const results = await Promise.all(
      lanes.map(async (commands) => {
        const codes = [];
        for (const args of commands) {
          if (interrupted !== undefined) break;
          codes.push(await runCommand(args, active));
        }
        return codes;
      }),
    );
    if (interrupted === "SIGINT") return 130;
    if (interrupted === "SIGTERM") return 143;
    return results.flat().some((code) => code !== 0) ? 1 : 0;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

function runCommand(args, active) {
  const label = args.join(" ");
  const startedAt = Date.now();
  console.log(`[heavyweight] start: pnpm ${label}`);
  const child = spawn("pnpm", args, {
    detached: process.platform !== "win32",
    stdio: "inherit",
  });
  active.add(child);
  child.once("error", (error) => {
    console.error(
      `[heavyweight] failed to start pnpm ${label}: ${error.message}`,
    );
  });
  return new Promise((resolve) => {
    child.once("close", (code) => {
      active.delete(child);
      const result = code ?? 1;
      console.log(
        `[heavyweight] finish (${result}, ${((Date.now() - startedAt) / 1_000).toFixed(1)}s): pnpm ${label}`,
      );
      resolve(result);
    });
  });
}

function signalProcessGroup(child, signal) {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") child.kill(signal);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runHeavyweightSuites();
}
