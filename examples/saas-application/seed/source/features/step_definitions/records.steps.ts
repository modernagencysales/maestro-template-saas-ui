import {
  AfterAll,
  BeforeAll,
  Given,
  Then,
  When,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import {
  createNodeProcessSpawner,
  type ManagedProcess,
} from "@maestro-template/agent-pack";
import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";

setDefaultTimeout(60_000);

let app: ManagedProcess | undefined;
let appExited = false;
let apiKey = "";
let apiBaseUrl = "";
let webUrl = "";
let appOutput = "";
let cliFailure = "";

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
  await run(["--silent", "exec", "convex", "init"], localConvexEnvironment());
  await run(
    [
      "--silent",
      "exec",
      "convex",
      "env",
      "set",
      "POSTHOG_PROJECT_TOKEN",
      "phc_test_placeholder",
    ],
    localConvexEnvironment(),
  );
  app = await createNodeProcessSpawner(() => process.env).spawn(
    {
      id: "contracts",
      command: "pnpm",
      args: [
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
      cwd: process.cwd(),
      environment: {
        remove: [],
        set: {
          MAESTRO_API_BASE_URL: apiBaseUrl,
          MAESTRO_API_KEY: apiKey,
          VITE_MAESTRO_CONTRACT_MODE: "1",
        },
      },
    },
    (_stream, line) => {
      appOutput = `${appOutput}${line}\n`.slice(-20_000);
    },
  );
  void app.completion.then(() => {
    appExited = true;
  });
  await eventually(async () => {
    if (appExited) {
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
  await app?.terminate("SIGINT");
});

Given("the contracts workspace is ready", async () => {
  const keyHash = createHash("sha256").update(apiKey).digest("base64url");
  await eventually(async () => {
    await run(
      [
        "--silent",
        "exec",
        "convex",
        "run",
        "headless/apiKeys:seedLocalContracts",
        JSON.stringify({ keyHash }),
      ],
      localConvexEnvironment(),
    );
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

When("I create a record named {string} from the CLI", async (title: string) => {
  await run(
    [
      "--silent",
      "maestro",
      "--",
      "capability",
      "run",
      "records.create",
      "--workspace",
      "template-demo",
      "--input",
      JSON.stringify({ title, detail: "Created by Cucumber." }),
      "--idempotency-key",
      "contracts-create-cli",
    ],
    {
      ...process.env,
      MAESTRO_API_BASE_URL: apiBaseUrl,
      MAESTRO_API_KEY: apiKey,
    },
  );
});

Then("the app shows a record named {string}", async (title: string) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${webUrl}/records`);
    await page.getByRole("button", { name: title }).waitFor();
  } finally {
    await browser.close();
  }
});

When(
  "I try to create a record named {string} without a CLI API key",
  async (title: string) => {
    cliFailure = "";
    try {
      await run(
        [
          "--silent",
          "maestro",
          "--",
          "capability",
          "run",
          "records.create",
          "--workspace",
          "template-demo",
          "--input",
          JSON.stringify({ title, detail: "Created by Cucumber." }),
          "--idempotency-key",
          "contracts-create-without-key",
        ],
        {
          ...process.env,
          MAESTRO_API_BASE_URL: apiBaseUrl,
          MAESTRO_API_KEY: "",
        },
      );
    } catch (error) {
      cliFailure = error instanceof Error ? error.message : String(error);
      return;
    }
    throw new Error("The CLI accepted a record without an API key.");
  },
);

Then("the CLI reports that an API key is required", () => {
  if (!cliFailure.includes("API_KEY_MISSING")) {
    throw new Error("The CLI did not report a missing API key.");
  }
});

When(
  "I try to create a record named {string} for another workspace",
  async (title: string) => {
    cliFailure = "";
    try {
      await run(
        [
          "--silent",
          "maestro",
          "--",
          "capability",
          "run",
          "records.create",
          "--workspace",
          "another-workspace",
          "--input",
          JSON.stringify({ title, detail: "Created by Cucumber." }),
          "--idempotency-key",
          "contracts-create-other-workspace",
        ],
        {
          ...process.env,
          MAESTRO_API_BASE_URL: apiBaseUrl,
          MAESTRO_API_KEY: apiKey,
        },
      );
    } catch (error) {
      cliFailure = error instanceof Error ? error.message : String(error);
      return;
    }
    throw new Error(
      "The CLI accepted a workspace-bound key for another workspace.",
    );
  },
);

Then(
  "the CLI reports that the API key is bound to a different workspace",
  () => {
    if (!cliFailure.includes("API_KEY_WORKSPACE_MISMATCH")) {
      throw new Error("The CLI did not report a workspace mismatch.");
    }
  },
);

Then("the app does not show {string}", async (title: string) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${webUrl}/records`);
    await page.getByRole("button", { name: "Create record" }).waitFor();
    if ((await page.getByText(title, { exact: true }).count()) !== 0) {
      throw new Error(`The app unexpectedly showed ${JSON.stringify(title)}.`);
    }
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
