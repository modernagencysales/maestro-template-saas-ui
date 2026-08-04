import type { ContractTransport } from "@maestro-template/template-core/product-contract";

import { ScenarioObservations, type ObservationKind } from "./observations";

type Locator = {
  readonly click: () => Promise<void>;
  readonly fill?: (value: string) => Promise<void>;
  readonly waitFor?: (options: { readonly state: "visible" }) => Promise<void>;
};

export type AccessiblePage = {
  readonly getByRole: (
    role: string,
    options: { readonly name: string },
  ) => Locator;
  readonly getByLabel: (label: string) => Locator;
  readonly getByText: (text: string) => Locator;
};

export class BrowserDriver {
  readonly #page: AccessiblePage;
  readonly #observations: ScenarioObservations;
  readonly #surfaceId: string;
  readonly #transport: ContractTransport;

  constructor(input: {
    readonly page: AccessiblePage;
    readonly observations: ScenarioObservations;
    readonly surfaceId: string;
    readonly transport: ContractTransport;
  }) {
    this.#page = input.page;
    this.#observations = input.observations;
    this.#surfaceId = input.surfaceId;
    this.#transport = input.transport;
  }

  async #recordAfter(kind: ObservationKind, operation: () => Promise<void>) {
    await operation();
    this.#observations.recordBoundary({
      kind,
      surfaceId: this.#surfaceId,
      transport: this.#transport,
    });
  }

  async clickByRole(role: string, name: string): Promise<void> {
    await this.#recordAfter("action", () =>
      this.#page.getByRole(role, { name }).click(),
    );
  }

  async fillByLabel(label: string, value: string): Promise<void> {
    await this.#recordAfter("action", async () => {
      const fill = this.#page.getByLabel(label).fill;
      if (fill === undefined)
        throw new Error(`Accessible field ${label} cannot be filled.`);
      await fill(value);
    });
  }

  async expectVisibleText(text: string): Promise<void> {
    await this.#recordAfter("outcome", async () => {
      const waitFor = this.#page.getByText(text).waitFor;
      if (waitFor === undefined)
        throw new Error(`Visible-text locator ${text} cannot be asserted.`);
      await waitFor({ state: "visible" });
    });
  }
}
