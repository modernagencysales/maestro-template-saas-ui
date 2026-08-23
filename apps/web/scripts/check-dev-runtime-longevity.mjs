import { spawn } from "node:child_process";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "@playwright/test";

async function waitForHealth(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, {
        signal: globalThis.AbortSignal.timeout(1_000),
      });
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
      () => reject(new Error("web dev runtime did not stop after SIGINT")),
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
  longevityMs = 125_000,
}) {
  const output = [];
  const child = spawn(
    "pnpm",
    [
      "--dir",
      "apps/web",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
      "--strictPort",
    ],
    {
      cwd,
      detached: true,
      env: { ...process.env, MAESTRO_DISABLE_ROUTE_GENERATION: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  let browser;
  try {
    const healthUrl = `http://127.0.0.1:${webPort}/favicon.ico`;
    const healthBefore = await waitForHealth(healthUrl);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const checkedRoutes = ["/records", "/acme"];
    for (const route of checkedRoutes) {
      await page.goto(`http://127.0.0.1:${webPort}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      const body = await page.locator("body").innerText();
      if (body.includes("Something went wrong!"))
        throw new Error(
          `web dev runtime rendered its error boundary: ${route}`,
        );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:${webPort}/acme`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    if (
      (await page
        .locator('.sui-sidebar__backdrop[data-state="closed"]:visible')
        .count()) > 0
    )
      throw new Error("closed mobile sidebar backdrop remains visible");
    await browser.close();
    browser = undefined;

    await delay(longevityMs);
    const healthAfter = await waitForHealth(healthUrl, 5_000);
    stopGroup(child, "SIGINT");
    const exit = await waitForExit(child, 15_000);
    const logs = output.join("");
    return {
      healthBefore,
      healthAfter,
      cleanShutdown: exit.code === 0 || exit.signal === "SIGINT",
      checkedRoutes,
      checkedViewports: ["desktop", "mobile"],
      logs,
    };
  } catch (error) {
    throw new Error(`${error.message}\n\ndev output:\n${output.join("")}`, {
      cause: error,
    });
  } finally {
    await browser?.close();
    stopGroup(child, "SIGTERM");
  }
}
