import { describe, expect, it } from "vitest";

import { isLogoutRequest } from "#lib/auth/workos-logout";

describe("WorkOS logout route", () => {
  it("accepts only same-origin POST logout requests", () => {
    expect(
      isLogoutRequest(
        new Request("https://app.example/api/auth/logout", {
          method: "POST",
          headers: { Origin: "https://app.example" },
        }),
      ),
    ).toBe(true);
    expect(
      isLogoutRequest(new Request("https://app.example/api/auth/session")),
    ).toBe(false);
    expect(
      isLogoutRequest(new Request("https://app.example/api/auth/logout")),
    ).toBe(false);
    expect(
      isLogoutRequest(
        new Request("https://app.example/api/auth/logout", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });
});
