#!/usr/bin/env node

import { spawn } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { fileURLToPath } from "node:url";

const lanes = ["verify:without-coverage", "check:coverage-ratchet"];

export async function runRequiredVerification() {
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
    const codes = await Promise.all(
      lanes.map((script) => runCommand(script, active)),
    );
    if (interrupted === "SIGINT") return 130;
    if (interrupted === "SIGTERM") return 143;
    return codes.some((code) => code !== 0) ? 1 : 0;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

function runCommand(script, active) {
  const startedAt = Date.now();
  console.log(`[required-verification] start: pnpm ${script}`);
  const child = spawn("pnpm", [script], {
    detached: process.platform !== "win32",
    stdio: "inherit",
  });
  active.add(child);
  child.once("error", (error) => {
    console.error(
      `[required-verification] failed to start pnpm ${script}: ${error.message}`,
    );
  });
  return new Promise((resolve) => {
    child.once("close", (code) => {
      active.delete(child);
      const result = code ?? 1;
      console.log(
        `[required-verification] finish (${result}, ${((Date.now() - startedAt) / 1_000).toFixed(1)}s): pnpm ${script}`,
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
  process.exitCode = await runRequiredVerification();
}
