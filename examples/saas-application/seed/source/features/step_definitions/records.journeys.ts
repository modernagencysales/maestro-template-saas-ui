import {
  contractsRuntime,
  type ContractsRuntime,
} from "../support/contracts-runtime";
import {
  type ContractsWorldState,
  requireScenario,
} from "../support/contracts-scenario";

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

export const createRecordsJourneyActions = (
  runtime: () => ContractsRuntime = contractsRuntime,
) => ({
  createFromCli: async (world: ContractsWorldState, title: string) => {
    const scenario = requireScenario(world);
    await runtime().runCli(
      scenario,
      commandArgs(
        "records.create",
        scenario.workspaceSlug,
        { title, detail: "Created by Cucumber." },
        `${scenario.namespace}-create-cli`,
      ),
    );
  },
  tryCreateWithoutKey: async (world: ContractsWorldState, title: string) => {
    const scenario = requireScenario(world);
    world.cliFailure = "";
    try {
      await runtime().runCli(
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
      world.cliFailure = error instanceof Error ? error.message : String(error);
      return;
    }
    throw new Error("The CLI accepted a record without an API key.");
  },
  expectMissingKey: (world: ContractsWorldState) => {
    if (!world.cliFailure.includes("API_KEY_MISSING")) {
      throw new Error("The CLI did not report a missing API key.");
    }
  },
  tryCrossWorkspaceCreate: async (
    world: ContractsWorldState,
    title: string,
  ) => {
    const scenario = requireScenario(world);
    world.cliFailure = "";
    try {
      await runtime().runCli(
        scenario,
        commandArgs(
          "records.create",
          scenario.observerWorkspaceSlug,
          { title, detail: "Created by Cucumber." },
          `${scenario.namespace}-create-other-workspace`,
        ),
      );
    } catch (error) {
      world.cliFailure = error instanceof Error ? error.message : String(error);
      return;
    }
    throw new Error(
      "The CLI accepted a workspace-bound key for another workspace.",
    );
  },
  expectWorkspaceMismatch: (world: ContractsWorldState) => {
    if (!world.cliFailure.includes("API_KEY_WORKSPACE_MISMATCH")) {
      throw new Error("The CLI did not report a workspace mismatch.");
    }
  },
  expectPrimaryCliIncludes: async (
    world: ContractsWorldState,
    title: string,
  ) => {
    const scenario = requireScenario(world);
    const stdout = await runtime().runCli(
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
  expectPrimaryCliExcludes: async (
    world: ContractsWorldState,
    title: string,
  ) => {
    const scenario = requireScenario(world);
    const stdout = await runtime().runCli(
      scenario,
      commandArgs(
        "records.list",
        scenario.workspaceSlug,
        {},
        `${scenario.namespace}-list-primary-excludes`,
      ),
    );
    if (listedTitles(stdout).includes(title)) {
      throw new Error(
        `CLI records unexpectedly included ${JSON.stringify(title)}.`,
      );
    }
  },
  expectOtherWorkspaceExcludes: async (
    world: ContractsWorldState,
    title: string,
  ) => {
    const scenario = requireScenario(world);
    const stdout = await runtime().runCli(
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
});
