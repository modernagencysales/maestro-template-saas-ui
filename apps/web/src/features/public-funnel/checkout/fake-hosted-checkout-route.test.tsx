import { describe, expect, it, vi } from "vitest";

import { FakeHostedCheckoutRoute } from "./fake-hosted-checkout-route";

describe("fake hosted checkout route", () => {
  it("delivers the verified fake event before returning", () => {
    const values = new Map<string, string>();
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/checkout/fake-hosted/checkout_1",
        search:
          "?report_id=idea_1&amount_cents=2900&return_url=%2Fcheckout%2Freturn%3Freport_id%3Didea_1",
        assign,
      },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    try {
      const element = FakeHostedCheckoutRoute({ sessionId: "checkout_1" });
      element.props.onPay?.();
      expect(assign).toHaveBeenCalledWith("/checkout/return?report_id=idea_1");
      expect(values.get("maestro.idea-funnel.commerce")).toContain("active");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects cross-origin checkout return URLs", () => {
    const values = new Map<string, string>();
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/checkout/fake-hosted/checkout_1",
        search:
          "?report_id=idea_1&amount_cents=2900&return_url=https%3A%2F%2Fevil.example%2Fphish",
        assign,
      },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    try {
      const element = FakeHostedCheckoutRoute({ sessionId: "checkout_1" });
      element.props.onPay?.();
      expect(assign).toHaveBeenCalledWith("/checkout/return");
      expect(values.get("maestro.idea-funnel.commerce")).not.toContain(
        "evil.example",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
