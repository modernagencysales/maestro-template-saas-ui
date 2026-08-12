// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { authService } from "./auth-provider";

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
});
