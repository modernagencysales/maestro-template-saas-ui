import { Given, Then, When } from "@cucumber/cucumber";

import { ContractsWorld, requireScenario } from "../support/contracts-world";
import { createRecordsJourneyActions } from "./records.journeys";

const actions = createRecordsJourneyActions();

Given("the contracts workspace is ready", function (this: ContractsWorld) {
  requireScenario(this);
});

When(
  "I create a record named {string} in the app",
  async function (this: ContractsWorld, title: string) {
    await actions.createInApp(this, title);
  },
);

When(
  "I create a record named {string} from the CLI",
  async function (this: ContractsWorld, title: string) {
    await actions.createFromCli(this, title);
  },
);

Then(
  "the app shows a record named {string}",
  async function (this: ContractsWorld, title: string) {
    await actions.expectAppIncludes(this, title);
  },
);

When(
  "I try to create a record named {string} without a CLI API key",
  async function (this: ContractsWorld, title: string) {
    await actions.tryCreateWithoutKey(this, title);
  },
);

Then(
  "the CLI reports that an API key is required",
  function (this: ContractsWorld) {
    actions.expectMissingKey(this);
  },
);

When(
  "I try to create a record named {string} for another workspace",
  async function (this: ContractsWorld, title: string) {
    await actions.tryCrossWorkspaceCreate(this, title);
  },
);

Then(
  "the CLI reports that the API key is bound to a different workspace",
  function (this: ContractsWorld) {
    actions.expectWorkspaceMismatch(this);
  },
);

Then(
  "the app does not show {string}",
  async function (this: ContractsWorld, title: string) {
    await actions.expectAppExcludes(this, title);
  },
);

Then(
  "listing records from the CLI includes {string}",
  async function (this: ContractsWorld, title: string) {
    await actions.expectPrimaryCliIncludes(this, title);
  },
);

Then(
  "listing records for the other workspace does not include {string}",
  async function (this: ContractsWorld, title: string) {
    await actions.expectOtherWorkspaceExcludes(this, title);
  },
);
