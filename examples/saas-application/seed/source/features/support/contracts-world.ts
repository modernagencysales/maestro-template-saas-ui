import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";
import type { BrowserContext, Page } from "@playwright/test";

import {
  contractsRuntime,
  startContractsRuntime,
  stopContractsRuntime,
  type ContractsScenario,
} from "./contracts-runtime";

setDefaultTimeout(60_000);

export class ContractsWorld extends World {
  context: BrowserContext | undefined;
  page: Page | undefined;
  scenario: ContractsScenario | undefined;
  cliFailure = "";
}

setWorldConstructor(ContractsWorld);

BeforeAll(async () => {
  await startContractsRuntime();
});

Before(async function (this: ContractsWorld) {
  const runtime = contractsRuntime();
  this.scenario = await runtime.provisionScenario();
  this.context = await runtime.browser.newContext();
  try {
    await runtime.authorizeBrowserContext(this.scenario, this.context);
    this.page = await this.context.newPage();
    this.cliFailure = "";
  } catch (error) {
    await this.context.close();
    this.context = undefined;
    this.scenario = undefined;
    throw error;
  }
});

After(async function (this: ContractsWorld) {
  try {
    await this.context?.close();
  } finally {
    this.context = undefined;
    this.page = undefined;
    this.scenario = undefined;
    this.cliFailure = "";
  }
});

AfterAll(async () => {
  await stopContractsRuntime();
});

export const requirePage = (world: ContractsWorld): Page => {
  if (world.page === undefined) {
    throw new Error("Contracts page is unavailable before the Scenario hook.");
  }
  return world.page;
};

export const requireScenario = (world: ContractsWorld): ContractsScenario => {
  if (world.scenario === undefined) {
    throw new Error(
      "Contracts scenario is unavailable before the Scenario hook.",
    );
  }
  return world.scenario;
};
