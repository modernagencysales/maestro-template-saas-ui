import { World, type IWorldOptions } from "@cucumber/cucumber";

import type { ContractEvidence } from "../../packages/convex/confect/runtime/contractEvidence";
import type { BackendRuntimeIdentity } from "./runtime-identity";
import {
  ScenarioObservations,
  type DriverObservation,
  type StepBinding,
} from "./observations";

export type ObservationRuntime = {
  readonly pickleKey: string;
  readonly checkoutSha: string;
  readonly webArtifactDigest: `sha256:${string}`;
  readonly cliArtifactDigest: `sha256:${string}`;
  readonly webBuildSourceSha: string;
  readonly cliBuildSourceSha: string;
  readonly backends: {
    readonly controller: BackendRuntimeIdentity;
    readonly web: BackendRuntimeIdentity;
    readonly cli: BackendRuntimeIdentity;
  };
  readonly scenarioNonce: string;
  readonly drainServerEvidence: () => Promise<readonly ContractEvidence[]>;
};

export type ContractWorldParameters = {
  readonly stepBindings?: Readonly<Record<string, StepBinding>>;
  readonly runtime?: ObservationRuntime;
};

const sameBackend = (
  left: BackendRuntimeIdentity,
  right: BackendRuntimeIdentity,
): boolean =>
  left.deploymentId === right.deploymentId &&
  left.inputDigest === right.inputDigest &&
  left.startNonce === right.startNonce;

export const buildObservationEnvelope = async (input: {
  readonly runtime: ObservationRuntime;
  readonly observations: ScenarioObservations;
}) => {
  const observations = input.observations.snapshot();
  const actions = new Map(
    observations
      .filter(
        (
          observation,
        ): observation is DriverObservation & { correlationNonce: string } =>
          observation.kind === "action" &&
          observation.correlationNonce !== undefined,
      )
      .map((observation) => [observation.correlationNonce, observation]),
  );
  const evidence = await input.runtime.drainServerEvidence();
  if (evidence.length !== actions.size)
    throw new Error("Server evidence does not cover every Action observation.");
  const used = new Set<string>();
  const serverCorrelations = evidence.map((row) => {
    const observation = actions.get(row.correlationNonce);
    if (
      observation === undefined ||
      used.has(row.correlationNonce) ||
      row.scenarioNonce !== input.runtime.scenarioNonce ||
      row.surfaceId !== observation.surfaceId ||
      row.transport !== observation.transport ||
      !sameBackend(row.backend, input.runtime.backends.controller)
    )
      throw new Error("Server evidence differs from its trusted Action.");
    used.add(row.correlationNonce);
    return {
      stepKey: observation.stepKey,
      scenarioNonce: row.scenarioNonce,
      correlationNonce: row.correlationNonce,
      actorPrincipalDigest: row.principalDigest,
      surfaceId: row.surfaceId,
      transport: row.transport,
      backend: row.backend,
    };
  });

  return {
    schemaVersion: 1 as const,
    pickleKey: input.runtime.pickleKey,
    checkoutSha: input.runtime.checkoutSha,
    webArtifactDigest: input.runtime.webArtifactDigest,
    cliArtifactDigest: input.runtime.cliArtifactDigest,
    webBuildSourceSha: input.runtime.webBuildSourceSha,
    cliBuildSourceSha: input.runtime.cliBuildSourceSha,
    backends: input.runtime.backends,
    scenarioNonce: input.runtime.scenarioNonce,
    observations,
    serverCorrelations,
    hooks: input.observations.hookMarkers(),
  };
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

  observationEnvelope() {
    if (this.parameters.runtime === undefined)
      throw new Error("No controller observation runtime exists.");
    return buildObservationEnvelope({
      runtime: this.parameters.runtime,
      observations: this.observations,
    });
  }
}
