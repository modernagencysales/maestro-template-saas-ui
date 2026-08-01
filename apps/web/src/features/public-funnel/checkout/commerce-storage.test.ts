import { describe, expect, it } from "vitest";

import { beginFakeCheckout } from "./commerce-storage";

describe("fake checkout navigation", () => {
  it("uses a provider page before the payment-pending return URL", () => {
    const session = beginFakeCheckout("idea_1", 2900);
    expect(session.hostedCheckoutUrl).toContain("/checkout/fake-hosted/");
    expect(session.hostedCheckoutUrl).toContain("report_id=idea_1");
    expect(session.returnUrl).toContain("/checkout/return");
    expect(session.hostedCheckoutUrl).not.toBe(session.returnUrl);
  });
});
