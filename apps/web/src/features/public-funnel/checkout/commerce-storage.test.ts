import { describe, expect, it, vi } from "vitest";

import {
  beginFakeCheckout,
  deliverFakeVerifiedPaymentWebhook,
  entitlementStatusFor,
  maestroCreditFor,
} from "./commerce-storage";

describe("fake checkout navigation", () => {
  it("uses a provider page before the payment-pending return URL", () => {
    const session = beginFakeCheckout("idea_1", 2900);
    expect(session.hostedCheckoutUrl).toContain("/checkout/fake-hosted/");
    expect(session.hostedCheckoutUrl).toContain("report_id=idea_1");
    expect(session.returnUrl).toContain("/checkout/return");
    expect(session.hostedCheckoutUrl).not.toBe(session.returnUrl);
  });

  it("derives entitlement and equal Maestro credit only after a verified event", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    try {
      const session = beginFakeCheckout("idea_paid", 2900);
      expect(entitlementStatusFor("idea_paid")).toBe("missing");
      deliverFakeVerifiedPaymentWebhook(session);
      expect(entitlementStatusFor("idea_paid")).toBe("active");
      expect(maestroCreditFor("idea_paid")).toBe(2900);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
