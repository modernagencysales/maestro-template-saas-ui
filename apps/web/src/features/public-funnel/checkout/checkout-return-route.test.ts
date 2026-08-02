import { describe, expect, it } from "vitest";

import { presentCheckoutReturn } from "./checkout-return-route";

describe("presentCheckoutReturn", () => {
  it("reveals generation only for an active entitlement", () => {
    expect(
      presentCheckoutReturn({
        reportId: "report_1",
        purchaseStatus: "paid",
        entitlementStatus: "active",
      }),
    ).toEqual({ _tag: "entitled", reportId: "report_1" });
  });

  it.each(["missing", "revoked"] as const)(
    "does not reveal generation for %s entitlement",
    (entitlementStatus) => {
      expect(
        presentCheckoutReturn({
          reportId: "report_1",
          purchaseStatus:
            entitlementStatus === "revoked" ? "refunded" : "payment-pending",
          entitlementStatus,
        })._tag,
      ).not.toBe("entitled");
    },
  );

  it("keeps a delayed webhook return recoverably pending", () => {
    expect(
      presentCheckoutReturn({
        reportId: "report_1",
        purchaseStatus: "payment-pending",
        entitlementStatus: "missing",
      }),
    ).toEqual({ _tag: "pending", reportId: "report_1" });
  });

  it("offers recovery after a bounded wait without granting access", () => {
    expect(
      presentCheckoutReturn({
        reportId: "report_1",
        purchaseStatus: "payment-pending",
        entitlementStatus: "missing",
        waitedMs: 60_000,
      }),
    ).toEqual({ _tag: "recovery", reportId: "report_1" });
  });
});
