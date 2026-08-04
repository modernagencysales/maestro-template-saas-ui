import { spawn } from "node:child_process";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "@playwright/test";

async function waitForHealth(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return response.status;
    } catch {
      // The supervisor is still starting.
    }
    await delay(250);
  }
  throw new Error(`health endpoint did not become ready: ${url}`);
}

const waitForExit = (child, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("maestro start did not stop after SIGINT")),
      timeoutMs,
    );
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

const stopGroup = (child, signal) => {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
};

export async function checkDevRuntimeLongevity({
  cwd,
  webPort,
  readinessPort,
  longevityMs = 125_000,
}) {
  const output = [];
  const child = spawn(
    "pnpm",
    [
      "maestro",
      "--",
      "start",
      "--mode",
      "fake",
      "--web-port",
      String(webPort),
      "--readiness-port",
      String(readinessPort),
    ],
    {
      cwd,
      detached: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  let browser;
  try {
    const healthUrl = `http://127.0.0.1:${readinessPort}/health`;
    const healthBefore = await waitForHealth(healthUrl);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${webPort}/records`, {
      waitUntil: "networkidle",
    });
    await browser.close();
    browser = undefined;

    await delay(longevityMs);
    const healthAfter = await waitForHealth(healthUrl, 5_000);
    stopGroup(child, "SIGINT");
    await waitForExit(child, 15_000);
    const logs = output.join("");
    return {
      healthBefore,
      healthAfter,
      cleanShutdown: logs.includes("stopped cleanly"),
      logs,
    };
  } catch (error) {
    throw new Error(`${error.message}\n\nmaestro output:\n${output.join("")}`, {
      cause: error,
    });
  } finally {
    await browser?.close();
    stopGroup(child, "SIGTERM");
  }
}
