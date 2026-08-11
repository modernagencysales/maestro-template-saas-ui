import { expect, test as base } from "@playwright/test";

import {
  createContractsRuntimeController,
  type ContractsRuntime,
  type ContractsScenario,
} from "./runtime";

type TestFixtures = {
  readonly scenario: ContractsScenario;
  readonly acceptancePage: import("@playwright/test").Page;
};

type WorkerFixtures = {
  readonly runtime: ContractsRuntime;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  runtime: [
    async ({ playwright: _playwright }, use) => {
      void _playwright;
      const controller = createContractsRuntimeController();
      const activeRuntime = await controller.start();
      try {
        await use(activeRuntime);
      } finally {
        await controller.stop();
      }
    },
    { scope: "worker", auto: true },
  ],
  scenario: async ({ runtime }, use) => {
    await use(await runtime.provisionScenario());
  },
  acceptancePage: async ({ runtime, scenario }, use) => {
    const context = await runtime.browser.newContext();
    try {
      await runtime.authorizeBrowserContext(scenario, context);
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
});

export { expect };
