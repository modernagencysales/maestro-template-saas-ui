import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";
import {
  CONTRACTS_HOOK_TIMEOUT_MS,
  startContractsRuntime,
  stopContractsRuntime,
} from "./contracts-runtime";
import {
  cleanupContractsScenario,
  prepareContractsScenario,
  type ContractsWorldState,
} from "./contracts-scenario";

export { requirePage, requireScenario } from "./contracts-scenario";

setDefaultTimeout(CONTRACTS_HOOK_TIMEOUT_MS);

export class ContractsWorld extends World implements ContractsWorldState {
  context: ContractsWorldState["context"];
  page: ContractsWorldState["page"];
  scenario: ContractsWorldState["scenario"];
  cliFailure = "";
}

setWorldConstructor(ContractsWorld);

BeforeAll(async () => {
  await startContractsRuntime();
});

Before(async function (this: ContractsWorld) {
  await prepareContractsScenario(this);
});

After(async function (this: ContractsWorld) {
  await cleanupContractsScenario(this);
});

AfterAll(async () => {
  await stopContractsRuntime();
});
