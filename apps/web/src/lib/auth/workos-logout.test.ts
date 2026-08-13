import { describe, expect, it } from "vitest";

import { isLogoutRequest } from "#lib/auth/workos-logout";

describe("WorkOS logout route", () => {
  it("recognizes browser GET navigation to the logout endpoint", () => {
    expect(
      isLogoutRequest(new Request("https://app.example/api/auth/logout")),
    ).toBe(true);
    expect(
      isLogoutRequest(new Request("https://app.example/api/auth/session")),
    ).toBe(false);
  });
});
