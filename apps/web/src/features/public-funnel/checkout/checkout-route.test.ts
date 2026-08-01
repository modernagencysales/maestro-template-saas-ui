import { describe, expect, it, vi } from "vitest";

import { openConfiguredCheckout } from "./checkout-route";

describe("openConfiguredCheckout", () => {
  it("creates a checkout with verified ownership and opens its provider URL", async () => {
    const createCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.example/session_1",
    });
    const redirect = vi.fn();

    await expect(
      openConfiguredCheckout({
        reportId: "report_1",
        email: " founder@example.com ",
        ownerAccessToken: "owner_1",
        createCheckout,
        redirect,
      }),
    ).resolves.toBeUndefined();

    expect(createCheckout).toHaveBeenCalledWith({
      reportId: "report_1",
      email: "founder@example.com",
      ownerAccessToken: "owner_1",
    });
    expect(redirect).toHaveBeenCalledWith("https://checkout.example/session_1");
  });

  it("fails closed when verified ownership is unavailable", async () => {
    const createCheckout = vi.fn();

    await expect(
      openConfiguredCheckout({
        reportId: "report_1",
        email: "founder@example.com",
        ownerAccessToken: null,
        createCheckout,
        redirect: vi.fn(),
      }),
    ).rejects.toThrow("Verified report ownership is required");
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
