import { describe, expect, it, vi } from "vitest";

import { openConfiguredCheckout } from "./checkout-route";

describe("openConfiguredCheckout", () => {
  it("creates a checkout with verified ownership and opens its provider URL", async () => {
    const createCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.example/session_1",
    });
    const redirect = vi.fn();
    const onStarted = vi.fn();

    await expect(
      openConfiguredCheckout({
        reportId: "report_1",
        email: " founder@example.com ",
        ownerAccessToken: "owner_1",
        createCheckout,
        redirect,
        onStarted,
      }),
    ).resolves.toBeUndefined();

    expect(createCheckout).toHaveBeenCalledWith({
      reportId: "report_1",
      email: "founder@example.com",
      ownerAccessToken: "owner_1",
    });
    expect(redirect).toHaveBeenCalledWith("https://checkout.example/session_1");
    expect(onStarted).toHaveBeenCalledOnce();
  });

  it("fails closed when verified ownership is unavailable", async () => {
    const createCheckout = vi.fn();
    const onStarted = vi.fn();

    await expect(
      openConfiguredCheckout({
        reportId: "report_1",
        email: "founder@example.com",
        ownerAccessToken: null,
        createCheckout,
        redirect: vi.fn(),
        onStarted,
      }),
    ).rejects.toThrow("Verified report ownership is required");
    expect(createCheckout).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
  });
});
