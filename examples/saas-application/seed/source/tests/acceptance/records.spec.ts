import { expect, test } from "./support/fixtures";
import type { ContractsRuntime, ContractsScenario } from "./support/runtime";

test.setTimeout(120_000);

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

const listedTitlesFromPrimaryCli = async (
  activeRuntime: ContractsRuntime,
  activeScenario: ContractsScenario,
  idempotencyKey = `${activeScenario.namespace}-list-primary`,
) =>
  listedTitles(
    await activeRuntime.runCli(
      activeScenario,
      commandArgs(
        "records.list",
        activeScenario.workspaceSlug,
        {},
        idempotencyKey,
      ),
    ),
  );

const listedTitlesFromObserverCli = async (
  activeRuntime: ContractsRuntime,
  activeScenario: ContractsScenario,
) =>
  listedTitles(
    await activeRuntime.runCli(
      activeScenario,
      commandArgs(
        "records.list",
        activeScenario.observerWorkspaceSlug,
        {},
        `${activeScenario.namespace}-list-observer`,
      ),
      "observer",
    ),
  );

test(
  "a web-created record appears in the CLI",
  { tag: "@BHV-REC-001-R1" },
  async ({ acceptancePage: page, runtime, scenario }) => {
    const title = `web-${scenario.namespace}`;
    await page.goto(`${runtime.webUrl}/${scenario.workspaceSlug}/records`);
    await page.getByRole("button", { name: "Create record" }).click();
    await page.getByLabel("Record title").fill(title);
    await page
      .getByLabel("Record detail")
      .fill("Created by Playwright acceptance.");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    let listAttempt = 0;
    await expect
      .poll(
        () =>
          listedTitlesFromPrimaryCli(
            runtime,
            scenario,
            `${scenario.namespace}-list-primary-${++listAttempt}`,
          ),
        { timeout: 5_000 },
      )
      .toContain(title);
  },
);

test(
  "a CLI-created record appears in the web app",
  { tag: "@BHV-REC-002-R1" },
  async ({ acceptancePage: page, runtime, scenario }) => {
    const title = `cli-${scenario.namespace}`;
    await runtime.runCli(
      scenario,
      commandArgs(
        "records.create",
        scenario.workspaceSlug,
        { title, detail: "Created by Playwright acceptance." },
        `${scenario.namespace}-create-cli`,
      ),
    );
    await page.goto(`${runtime.webUrl}/${scenario.workspaceSlug}/records`);
    await expect(page.getByText(title, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  },
);

test(
  "a missing API key cannot create a record",
  { tag: "@BHV-REC-003-R1" },
  async ({ acceptancePage: page, runtime, scenario }) => {
    const title = `missing-key-${scenario.namespace}`;
    await expect(
      runtime.runCli(
        scenario,
        commandArgs(
          "records.create",
          scenario.workspaceSlug,
          { title, detail: "Created by Playwright acceptance." },
          `${scenario.namespace}-create-without-key`,
        ),
        "none",
      ),
    ).rejects.toThrow("API_KEY_MISSING");
    expect(await listedTitlesFromPrimaryCli(runtime, scenario)).not.toContain(
      title,
    );
    await page.goto(`${runtime.webUrl}/${scenario.workspaceSlug}/records`);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  },
);

test(
  "a workspace-bound key cannot write to another workspace",
  { tag: "@BHV-REC-004-R1" },
  async ({ runtime, scenario }) => {
    const title = `cross-workspace-${scenario.namespace}`;
    await expect(
      runtime.runCli(
        scenario,
        commandArgs(
          "records.create",
          scenario.observerWorkspaceSlug,
          { title, detail: "Created by Playwright acceptance." },
          `${scenario.namespace}-create-other-workspace`,
        ),
      ),
    ).rejects.toThrow("API_KEY_WORKSPACE_MISMATCH");
    expect(await listedTitlesFromPrimaryCli(runtime, scenario)).not.toContain(
      title,
    );
    expect(await listedTitlesFromObserverCli(runtime, scenario)).not.toContain(
      title,
    );
  },
);
