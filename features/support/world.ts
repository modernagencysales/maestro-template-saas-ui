import { World, type IWorldOptions } from "@cucumber/cucumber";

import { ScenarioObservations, type StepBinding } from "./observations";

export type ContractWorldParameters = {
  readonly stepBindings?: Readonly<Record<string, StepBinding>>;
};

export class ContractWorld extends World<ContractWorldParameters> {
  readonly observations = new ScenarioObservations();
  currentStepKey: string | undefined;

  constructor(options: IWorldOptions<ContractWorldParameters>) {
    super(options);
  }

  beginRuntimeStep(pickleStepId: string): void {
    const binding = this.parameters.stepBindings?.[pickleStepId];
    if (binding === undefined)
      throw new Error(`No controller step binding exists for ${pickleStepId}.`);
    this.observations.beginStep(binding);
    this.currentStepKey = binding.stepKey;
  }

  finishRuntimeStep(status: string): void {
    this.observations.finishStep(status);
    this.currentStepKey = undefined;
  }
}
