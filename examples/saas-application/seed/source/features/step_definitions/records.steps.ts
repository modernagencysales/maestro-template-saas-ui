import { Given, Then, When } from "@cucumber/cucumber";

import { contractsRuntime } from "../support/contracts-runtime";
import {
  ContractsWorld,
  requirePage,
  requireScenario,
} from "../support/contracts-world";

const commandArgs = (
  operationId: "records.create" | "records.list",
  workspace: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
) => [
  "capability",
  "run",
  operationId,
  "--workspace",
  workspace,
  "--input",
  JSON.stringify(input),
  "--idempotency-key",
  idempotencyKey,
];

const listedTitles = (stdout: string): readonly string[] => {
  const value: unknown = JSON.parse(stdout);
  if (
    value === null ||
    typeof value !== "object" ||
    !("result" in value) ||
    !Array.isArray(value.result)
  ) {
    throw new Error("CLI records response was invalid.");
  }
  return value.result.flatMap((record) =>
    record !== null &&
    typeof record === "object" &&
    "title" in record &&
    typeof record.title === "string"
      ? [record.title]
      : [],
  );
};

Given("the contracts workspace is ready", function (this: ContractsWorld) {
  requireScenario(this);
});

When(
  "I create a record named {string} in the app",
  async function (this: ContractsWorld, title: string) {
    const page = requirePage(this);
    await page.goto(`${contractsRuntime().webUrl}/records`);
    await page.getByRole("button", { name: "Create record" }).click();
    await page.getByLabel("Record title").fill(title);
    await page.getByLabel("Record detail").fill("Created by Cucumber.");
    await page.getByRole("button", { name: "Save record" }).click();
    await page.getByRole("heading", { name: title }).waitFor();
  },
);

When(
  "I create a record named {string} from the CLI",
  async function (this: ContractsWorld, title: string) {
    const scenario = requireScenario(this);
    await contractsRuntime().runCli(
      scenario,
      commandArgs(
        "records.create",
        scenario.workspaceSlug,
        { title, detail: "Created by Cucumber." },
        `${scenario.namespace}-create-cli`,
      ),
    );
  },
);

Then(
  "the app shows a record named {string}",
  async function (this: ContractsWorld, title: string) {
    const page = requirePage(this);
    await page.goto(`${contractsRuntime().webUrl}/records`);
    await page.getByRole("button", { name: title }).waitFor();
  },
);

When(
  "I try to create a record named {string} without a CLI API key",
  async function (this: ContractsWorld, title: string) {
    const scenario = requireScenario(this);
    this.cliFailure = "";
    try {
      await contractsRuntime().runCli(
        scenario,
        commandArgs(
          "records.create",
          scenario.workspaceSlug,
          { title, detail: "Created by Cucumber." },
          `${scenario.namespace}-create-without-key`,
        ),
        "none",
      );
    } catch (error) {
      this.cliFailure = error instanceof Error ? error.message : String(error);
      return;
    }
    throw new Error("The CLI accepted a record without an API key.");
  },
);

Then(
  "the CLI reports that an API key is required",
  function (this: ContractsWorld) {
    if (!this.cliFailure.includes("API_KEY_MISSING")) {
      throw new Error("The CLI did not report a missing API key.");
    }
  },
);

When(
  "I try to create a record named {string} for another workspace",
  async function (this: ContractsWorld, title: string) {
    const scenario = requireScenario(this);
    this.cliFailure = "";
    try {
      await contractsRuntime().runCli(
        scenario,
        commandArgs(
          "records.create",
          scenario.observerWorkspaceSlug,
          { title, detail: "Created by Cucumber." },
          `${scenario.namespace}-create-other-workspace`,
        ),
      );
    } catch (error) {
      this.cliFailure = error instanceof Error ? error.message : String(error);
      return;
    }
    throw new Error(
      "The CLI accepted a workspace-bound key for another workspace.",
    );
  },
);

Then(
  "the CLI reports that the API key is bound to a different workspace",
  function (this: ContractsWorld) {
    if (!this.cliFailure.includes("API_KEY_WORKSPACE_MISMATCH")) {
      throw new Error("The CLI did not report a workspace mismatch.");
    }
  },
);

Then(
  "the app does not show {string}",
  async function (this: ContractsWorld, title: string) {
    const page = requirePage(this);
    await page.goto(`${contractsRuntime().webUrl}/records`);
    await page.getByRole("button", { name: "Create record" }).waitFor();
    if ((await page.getByText(title, { exact: true }).count()) !== 0) {
      throw new Error(`The app unexpectedly showed ${JSON.stringify(title)}.`);
    }
  },
);

Then(
  "listing records from the CLI includes {string}",
  async function (this: ContractsWorld, title: string) {
    const scenario = requireScenario(this);
    const stdout = await contractsRuntime().runCli(
      scenario,
      commandArgs(
        "records.list",
        scenario.workspaceSlug,
        {},
        `${scenario.namespace}-list-primary`,
      ),
    );
    if (!listedTitles(stdout).includes(title)) {
      throw new Error(`CLI records did not include ${JSON.stringify(title)}.`);
    }
  },
);

Then(
  "listing records for the other workspace does not include {string}",
  async function (this: ContractsWorld, title: string) {
    const scenario = requireScenario(this);
    const stdout = await contractsRuntime().runCli(
      scenario,
      commandArgs(
        "records.list",
        scenario.observerWorkspaceSlug,
        {},
        `${scenario.namespace}-list-observer`,
      ),
      "observer",
    );
    if (listedTitles(stdout).includes(title)) {
      throw new Error(
        `The other workspace unexpectedly included ${JSON.stringify(title)}.`,
      );
    }
  },
);
