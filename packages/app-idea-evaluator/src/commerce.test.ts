import { describe, expect, it } from "vitest";

import {
  applyPaymentEvent,
  checkoutReturn,
  createCommerceState,
  type PaymentEvent,
} from "./commerce";

const paidEvent: PaymentEvent = {
  eventId: "evt_paid_1",
  type: "payment.succeeded",
  paymentId: "pay_1",
  reportId: "idea_1",
  amountCents: 2_900,
  currency: "USD",
  signatureVerified: true,
};

describe("Build Pack commerce", () => {
  it("does not grant entitlement from a checkout return", () => {
    const state = checkoutReturn(createCommerceState(), {
      checkoutSessionId: "checkout_1",
      reportId: "idea_1",
    });

    expect(state.entitlements).toEqual([]);
    expect(state.checkoutReturns[0]?.status).toBe("payment-pending");
  });

  it("grants one entitlement and equal Maestro credit for duplicate webhooks", () => {
    const first = applyPaymentEvent(createCommerceState(), paidEvent);
    const second = applyPaymentEvent(first, paidEvent);

    expect(second.entitlements).toHaveLength(1);
    expect(second.maestroCredits).toEqual([
      expect.objectContaining({ reportId: "idea_1", amountCents: 2_900 }),
    ]);
    expect(second.processedEventIds).toEqual(["evt_paid_1"]);
  });

  it("rejects unverified events and revokes on refunds", () => {
    expect(() =>
      applyPaymentEvent(createCommerceState(), {
        ...paidEvent,
        signatureVerified: false,
      }),
    ).toThrow("verified webhook");

    const paid = applyPaymentEvent(createCommerceState(), paidEvent);
    const refunded = applyPaymentEvent(paid, {
      ...paidEvent,
      eventId: "evt_refund_1",
      type: "refund.succeeded",
    });
    expect(refunded.entitlements[0]?.status).toBe("revoked");
  });
});
