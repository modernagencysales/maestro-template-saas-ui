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

  it("resolves the matching returned checkout only after its verified payment webhook", () => {
    const pending = checkoutReturn(createCommerceState(), {
      checkoutSessionId: "checkout_1",
      reportId: "idea_1",
    });

    const paid = applyPaymentEvent(pending, {
      ...paidEvent,
      checkoutSessionId: "checkout_1",
    });

    expect(paid.checkoutReturns[0]?.status).toBe("paid");
    expect(paid.entitlements[0]?.status).toBe("active");
  });

  it("rejects unverified events and revokes both access and credit on refunds", () => {
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
    expect(refunded.maestroCredits[0]).toMatchObject({ status: "revoked" });
  });
});
