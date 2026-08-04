import type { ContractTransport } from "@maestro-template/template-core/product-contract";

export type ObservationKind = "action" | "outcome";
export type StepKind = ObservationKind | "context";

export type DriverObservation = {
  readonly stepKey: string;
  readonly kind: ObservationKind;
  readonly correlationNonce?: string;
  readonly surfaceId: string;
  readonly transport: ContractTransport;
};

export type StepBinding = {
  readonly stepKey: string;
  readonly kind: StepKind;
  readonly correlationNonce?: string;
};

type BoundaryObservation = Omit<
  DriverObservation,
  "stepKey" | "correlationNonce"
>;

const isObservable = (kind: StepKind): kind is ObservationKind =>
  kind === "action" || kind === "outcome";

/**
 * Per-scenario observation state. Only trusted boundary adapters call
 * recordBoundary, and they do so after their interaction/assertion resolves.
 */
export class ScenarioObservations {
  readonly #observations: DriverObservation[] = [];
  readonly #beforeStepKeys: string[] = [];
  readonly #afterStepKeys: string[] = [];
  #binding: StepBinding | undefined;

  beginStep(binding: StepBinding): void {
    if (this.#binding !== undefined)
      throw new Error(
        `BeforeStep already bound ${this.#binding.stepKey}; duplicate marker rejected.`,
      );
    if (this.#beforeStepKeys.includes(binding.stepKey))
      throw new Error(`BeforeStep marker duplicated for ${binding.stepKey}.`);
    if (binding.kind === "action" && !binding.correlationNonce)
      throw new Error(
        "Action steps require a controller-minted correlation nonce.",
      );
    if (binding.kind !== "action" && binding.correlationNonce !== undefined)
      throw new Error("Only Action steps may carry a correlation nonce.");
    this.#binding = { ...binding };
    this.#beforeStepKeys.push(binding.stepKey);
  }

  recordBoundary(observation: BoundaryObservation): void {
    const binding = this.#binding;
    if (binding === undefined)
      throw new Error(
        "A trusted observation requires the current stable step.",
      );
    if (!isObservable(binding.kind) || binding.kind !== observation.kind)
      throw new Error(
        `Observation kind ${observation.kind} differs from bound step kind ${binding.kind}.`,
      );
    if (
      this.#observations.some(
        (candidate) => candidate.stepKey === binding.stepKey,
      )
    )
      throw new Error(`Step ${binding.stepKey} already has an observation.`);
    this.#observations.push({
      stepKey: binding.stepKey,
      kind: observation.kind,
      ...(binding.correlationNonce === undefined
        ? {}
        : { correlationNonce: binding.correlationNonce }),
      surfaceId: observation.surfaceId,
      transport: observation.transport,
    });
  }

  finishStep(status: string): void {
    const binding = this.#binding;
    if (binding === undefined)
      throw new Error("AfterStep has no current stable step binding.");
    if (this.#afterStepKeys.includes(binding.stepKey))
      throw new Error(`AfterStep marker duplicated for ${binding.stepKey}.`);

    try {
      if (
        status === "PASSED" &&
        isObservable(binding.kind) &&
        !this.#observations.some(
          (candidate) =>
            candidate.stepKey === binding.stepKey &&
            candidate.kind === binding.kind,
        )
      )
        throw new Error(
          `Passing ${binding.kind} step ${binding.stepKey} has no matching trusted observation.`,
        );
      this.#afterStepKeys.push(binding.stepKey);
    } finally {
      this.#binding = undefined;
    }
  }

  snapshot(): readonly DriverObservation[] {
    return this.#observations.map((observation) => ({ ...observation }));
  }

  hookMarkers(): {
    readonly beforeStepKeys: readonly string[];
    readonly afterStepKeys: readonly string[];
  } {
    return {
      beforeStepKeys: [...this.#beforeStepKeys],
      afterStepKeys: [...this.#afterStepKeys],
    };
  }
}
