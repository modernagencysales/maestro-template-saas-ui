import {
  AfterAll,
  BeforeAll,
  Given,
  Then,
  When,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import { chromium } from "@playwright/test";
import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";

setDefaultTimeout(60_000);

let app: ChildProcessWithoutNullStreams | undefined;
let apiKey = "";
let apiBaseUrl = "";
let webUrl = "";
let appOutput = "";

const localConvexEnvironment = () => {
  const environment = {
    ...process.env,
    CONVEX_AGENT_MODE: "anonymous",
  };
  for (const name of [
    "CONVEX_DEPLOYMENT",
    "CONVEX_DEPLOY_KEY",
    "TEMPLATE_CONVEX_DEPLOY_KEY",
    "CONVEX_URL",
    "CONVEX_SITE_URL",
    "CONVEX_SELF_HOSTED_URL",
    "CONVEX_SELF_HOSTED_ADMIN_KEY",
    "VITE_CONVEX_URL",
  ]) {
    delete environment[name];
  }
  return environment;
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a local contract port."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });

const run = (args: readonly string[], environment = process.env) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      "pnpm",
      [...args],
      { cwd: process.cwd(), env: environment, encoding: "utf8" },
      (error, stdout, stderr) =>
        error
          ? reject(new Error(`${error.message}\n${stdout}\n${stderr}`))
          : resolve(stdout),
    );
  });

const eventually = async (check: () => Promise<void>) => {
  const deadline = Date.now() + 30_000;
  let failure: unknown;
  while (Date.now() < deadline) {
    try {
      await check();
      return;
    } catch (error) {
      failure = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw failure;
};

BeforeAll(async () => {
  const [webPort, convexPort, convexSitePort, readinessPort] =
    await Promise.all([freePort(), freePort(), freePort(), freePort()]);
  apiKey = `mtk_live_${randomBytes(32).toString("base64url")}`;
  apiBaseUrl = `http://127.0.0.1:${convexSitePort}`;
  webUrl = `http://127.0.0.1:${webPort}`;
  await run(
    ["--silent", "exec", "convex", "init"],
    localConvexEnvironment(),
  );
  await run([
    "--silent",
    "exec",
    "convex",
    "env",
    "set",
    "POSTHOG_PROJECT_TOKEN",
    "phc_test_placeholder",
  ], localConvexEnvironment());
  app = spawn(
    "pnpm",
    [
      "--silent",
      "maestro",
      "--",
      "start",
      "--mode",
      "local",
      "--web-port",
      String(webPort),
      "--convex-port",
      String(convexPort),
      "--convex-site-port",
      String(convexSitePort),
      "--readiness-port",
      String(readinessPort),
      "--details",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MAESTRO_API_BASE_URL: apiBaseUrl,
        MAESTRO_API_KEY: apiKey,
        VITE_MAESTRO_CONTRACT_MODE: "1",
      },
    },
  );
  const capture = (chunk: Buffer) => {
    appOutput = `${appOutput}${chunk.toString("utf8")}`.slice(-20_000);
  };
  app.stdout.on("data", capture);
  app.stderr.on("data", capture);
  await eventually(async () => {
    if (app && (app.exitCode !== null || app.signalCode !== null)) {
      throw new Error(
        `The local app exited before readiness.\n${appOutput.replaceAll(apiKey, "[redacted]")}`,
      );
    }
    const response = await fetch(`${webUrl}/health`);
    if (!response.ok) {
      throw new Error(
        `The local app is not ready.\n${appOutput.replaceAll(apiKey, "[redacted]")}`,
      );
    }
  });
});

AfterAll(async () => {
  if (!app || app.exitCode !== null) return;
  const runningApp = app;
  runningApp.kill("SIGINT");
  await Promise.race([
    new Promise<void>((resolve) => runningApp.once("exit", () => resolve())),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        runningApp.kill("SIGKILL");
        resolve();
      }, 5_000),
    ),
  ]);
});

Given("the contracts workspace is ready", async () => {
  const keyHash = createHash("sha256").update(apiKey).digest("base64url");
  await eventually(async () => {
    await run([
      "--silent",
      "exec",
      "convex",
      "run",
      "headless/apiKeys:seedLocalContracts",
      JSON.stringify({ keyHash }),
    ], localConvexEnvironment());
  });
});

When("I create a record named {string} in the app", async (title: string) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${webUrl}/records`);
    await page.getByRole("button", { name: "Create record" }).click();
    await page.getByLabel("Record title").fill(title);
    await page.getByLabel("Record detail").fill("Created by Cucumber.");
    await page.getByRole("button", { name: "Save record" }).click();
    await page.getByRole("heading", { name: title }).waitFor();
  } finally {
    await browser.close();
  }
});

Then(
  "listing records from the CLI includes {string}",
  async (title: string) => {
    const stdout = await run(
      [
        "--silent",
        "maestro",
        "--",
        "capability",
        "run",
        "records.list",
        "--workspace",
        "template-demo",
        "--input",
        "{}",
        "--idempotency-key",
        "contracts-list",
      ],
      {
        ...process.env,
        MAESTRO_API_BASE_URL: apiBaseUrl,
        MAESTRO_API_KEY: apiKey,
      },
    );
    const result: unknown = JSON.parse(stdout);
    if (
      result === null ||
      typeof result !== "object" ||
      !("result" in result) ||
      !Array.isArray(result.result) ||
      !result.result.some(
        (record) =>
          record !== null &&
          typeof record === "object" &&
          "title" in record &&
          record.title === title,
      )
    ) {
      throw new Error(`CLI records did not include ${JSON.stringify(title)}.`);
    }
  },
);
