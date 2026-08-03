import { describe, expect, it } from "vitest";

import { validateLiveDodoBindings } from "./webhooks.impl";

describe("App Idea live Dodo webhook bindings", () => {
  it("fails closed when product, amount, or currency is absent/invalid", () => {
    expect(validateLiveDodoBindings({})).toBe(false);
    expect(
      validateLiveDodoBindings({
        productId: "prod_build_pack",
        amountCents: "2900",
      }),
    ).toBe(false);
    expect(
      validateLiveDodoBindings({
        productId: "prod_build_pack",
        amountCents: "2900",
        currency: "USD",
      }),
    ).toBe(true);
  });
});
