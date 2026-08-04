import {
  After,
  AfterStep,
  Before,
  BeforeStep,
  setWorldConstructor,
  type ITestStepHookParameter,
} from "@cucumber/cucumber";

import { ContractWorld } from "./world";

setWorldConstructor(ContractWorld);

Before(function (this: ContractWorld) {
  this.currentStepKey = undefined;
});

BeforeStep(function (this: ContractWorld, step: ITestStepHookParameter) {
  this.beginRuntimeStep(step.pickleStep.id);
});

AfterStep(function (this: ContractWorld, step: ITestStepHookParameter) {
  this.finishRuntimeStep(step.result.status);
});

After(async function (this: ContractWorld) {
  await this.attach(
    JSON.stringify(await this.observationEnvelope()),
    "application/json",
  );
});
