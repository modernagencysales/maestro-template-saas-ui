// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { authService, isGoldenEvidenceUrl } from "./auth-provider";

describe("template auth service", () => {
  it("does not fake a user outside golden evidence routes", async () => {
    window.history.replaceState({}, "", "/contacts/view/contact-1");

    await expect(authService.onLoadUser?.()).resolves.toBeNull();
  });

  it("loads the golden user only for golden evidence routes", async () => {
    window.history.replaceState(
      {},
      "",
      "/contacts/view/contact-1?goldenAuthority=reference",
    );

    await expect(authService.onLoadUser?.()).resolves.toMatchObject({
      id: "user-1",
      name: "Alex Morgan",
    });
  });

  it("rejects golden authority parameters on non-loopback hosts", () => {
    expect(
      isGoldenEvidenceUrl(
        "https://example.com/contacts/view/contact-1?goldenAuthority=reference",
      ),
    ).toBe(false);
    expect(
      isGoldenEvidenceUrl(
        "http://127.0.0.1:4173/contacts/view/contact-1?goldenAuthority=reference",
      ),
    ).toBe(true);
    expect(
      isGoldenEvidenceUrl(
        "http://[::1]:4173/contacts/view/contact-1?goldenAuthority=generated",
      ),
    ).toBe(true);
  });
});
