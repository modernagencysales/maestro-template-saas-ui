import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  After,
  AfterAll,
  AfterStep,
  Before,
  BeforeAll,
  BeforeStep,
  setWorldConstructor,
  World,
  type IWorldOptions,
} from "@cucumber/cucumber";

const uri = "tooling/acceptance/fixtures/messages/passing.feature";
const source = readFileSync(uri);
const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const pickleKey = `pickle_sha256:${hash(
  JSON.stringify({
    sourceDigest: `sha256:${hash(source)}`,
    uri,
    scenarioLocation: { line: 5, column: 3 },
    examplesRowLocation: { line: 11, column: 7 },
  }),
)}`;
const steps = [
  { type: "Action", text: "I increment the fixture counter by 1" },
  { type: "Outcome", text: "the fixture counter is 1" },
] as const;
const stepKeys = steps.map(
  (step, index) =>
    `step_sha256:${hash(
      JSON.stringify({ pickleKey, index, ...step, argument: null }),
    )}`,
);
const backend = {
  inputDigest: `sha256:${"a".repeat(64)}`,
  deploymentId: "fixture-deployment",
  startNonce: "fixture-start-nonce",
} as const;

export class PassingWorld extends World {
  counter = 0;
  currentStepKey: string | undefined;
  stepIndex = 0;
  readonly beforeStepKeys: string[] = [];
  readonly afterStepKeys: string[] = [];
  readonly observations: Record<string, unknown>[] = [];

  constructor(options: IWorldOptions) {
    super(options);
  }

  record(kind: "action" | "outcome", correlationNonce?: string): void {
    if (this.currentStepKey === undefined)
      throw new Error("fixture action has no current stable step key");
    this.observations.push({
      stepKey: this.currentStepKey,
      kind,
      ...(correlationNonce === undefined ? {} : { correlationNonce }),
      surfaceId: "surface_messages_fixture",
      transport: "ui",
    });
  }
}

setWorldConstructor(PassingWorld);

BeforeAll({ name: "protected fixture BeforeAll" }, function () {});
AfterAll({ name: "protected fixture AfterAll" }, function () {});

Before({ name: "protected fixture Before" }, function (this: PassingWorld) {
  this.counter = 0;
});

BeforeStep(function (this: PassingWorld) {
  const stepKey = stepKeys[this.stepIndex];
  if (stepKey === undefined) throw new Error("fixture emitted an extra step");
  this.currentStepKey = stepKey;
  this.beforeStepKeys.push(stepKey);
});

AfterStep(function (this: PassingWorld) {
  if (this.currentStepKey === undefined)
    throw new Error("fixture finished a step without a stable key");
  this.afterStepKeys.push(this.currentStepKey);
  this.currentStepKey = undefined;
  this.stepIndex += 1;
});

After(
  { name: "protected observation envelope" },
  async function (this: PassingWorld) {
    await this.attach(
      JSON.stringify({
        schemaVersion: 1,
        pickleKey,
        checkoutSha: "fixture-checkout-sha",
        webArtifactDigest: `sha256:${"b".repeat(64)}`,
        cliArtifactDigest: `sha256:${"c".repeat(64)}`,
        webBuildSourceSha: "fixture-checkout-sha",
        cliBuildSourceSha: "fixture-checkout-sha",
        backends: { controller: backend, web: backend, cli: backend },
        scenarioNonce: "fixture-scenario-nonce",
        observations: this.observations,
        serverCorrelations: [
          {
            stepKey: stepKeys[0],
            scenarioNonce: "fixture-scenario-nonce",
            correlationNonce: "fixture-action-correlation",
            actorPrincipalDigest: `sha256:${"d".repeat(64)}`,
            surfaceId: "surface_messages_fixture",
            transport: "ui",
            backend,
          },
        ],
        hooks: {
          beforeStepKeys: this.beforeStepKeys,
          afterStepKeys: this.afterStepKeys,
        },
      }),
      "application/json",
    );
  },
);
