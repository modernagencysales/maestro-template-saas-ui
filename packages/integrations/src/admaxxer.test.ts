import { describe, expect, it, vi } from "vitest";

import { recordAdmaxxerPayment } from "./admaxxer";

describe("Admaxxer payment adapter", () => {
  it("sends a minor-unit payment with visitor attribution", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    await expect(
      recordAdmaxxerPayment(
        {
          paymentId: "pay_1",
          amountMinor: 2_900,
          currency: "usd",
          visitorId: "visitor_1",
          email: "OWNER@EXAMPLE.TEST",
        },
        { apiKey: "key", fetcher },
      ),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "https://admaxxer.com/api/v1/payments",
      expect.objectContaining({
        body: JSON.stringify({
          amount: 29,
          currency: "USD",
          transaction_id: "pay_1",
          admaxxer_visitor_id: "visitor_1",
          email: "owner@example.test",
        }),
      }),
    );
  });

  it("fails closed for malformed amounts and does not require a key in fake mode", async () => {
    await expect(
      recordAdmaxxerPayment(
        { paymentId: "pay_1", amountMinor: -1, currency: "USD" },
        { apiKey: "key" },
      ),
    ).rejects.toThrow(/amount/i);
    await expect(
      recordAdmaxxerPayment({
        paymentId: "pay_1",
        amountMinor: 100,
        currency: "USD",
      }),
    ).resolves.toBe(false);
  });
});
