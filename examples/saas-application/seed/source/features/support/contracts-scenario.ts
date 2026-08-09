import type { BrowserContext, Page } from "@playwright/test";

import {
  contractsRuntime,
  type ContractsRuntime,
  type ContractsScenario,
} from "./contracts-runtime";

export type ContractsWorldState = {
  context: BrowserContext | undefined;
  page: Page | undefined;
  scenario: ContractsScenario | undefined;
  cliFailure: string;
};

const resetContractsScenario = (world: ContractsWorldState) => {
  world.context = undefined;
  world.page = undefined;
  world.scenario = undefined;
  world.cliFailure = "";
};

export const prepareContractsScenario = async (
  world: ContractsWorldState,
  runtime: ContractsRuntime = contractsRuntime(),
) => {
  world.cliFailure = "";
  world.scenario = await runtime.provisionScenario();
  world.context = await runtime.browser.newContext();
  try {
    await runtime.authorizeBrowserContext(world.scenario, world.context);
    world.page = await world.context.newPage();
  } catch (error) {
    try {
      await world.context.close();
    } catch {
      // Preserve the setup failure as the actionable Scenario error.
    } finally {
      resetContractsScenario(world);
    }
    throw error;
  }
};

export const cleanupContractsScenario = async (world: ContractsWorldState) => {
  try {
    await world.context?.close();
  } finally {
    resetContractsScenario(world);
  }
};

export const requirePage = (world: ContractsWorldState): Page => {
  if (world.page === undefined) {
    throw new Error("Contracts page is unavailable before the Scenario hook.");
  }
  return world.page;
};

export const requireScenario = (
  world: ContractsWorldState,
): ContractsScenario => {
  if (world.scenario === undefined) {
    throw new Error(
      "Contracts scenario is unavailable before the Scenario hook.",
    );
  }
  return world.scenario;
};
