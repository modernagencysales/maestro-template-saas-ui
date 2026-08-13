import { describe, expect, it } from "vitest";

import {
  safeReturnPath,
  loadRouteAuth,
  requireAuthenticatedRoute,
} from "#lib/auth/route-auth";

describe("protected route auth", () => {
  it("reduces unsafe return paths to root", () => {
    expect(safeReturnPath("https://evil.example/path")).toBe("/");
    expect(safeReturnPath("//evil.example/path")).toBe("/");
    expect(safeReturnPath("/awesome-inc/dashboard?tab=all")).toBe(
      "/awesome-inc/dashboard?tab=all",
    );
    expect(safeReturnPath("/\\\\evil.example/path")).toBe("/");
    expect(safeReturnPath("/safe\npath")).toBe("/");
  });

  it("returns client-safe auth for an authenticated context", () => {
    expect(
      requireAuthenticatedRoute({
        auth: { user: { id: "user_1" }, accessToken: "secret" },
        location: { pathname: "/awesome-inc", searchStr: "" },
      }),
    ).toEqual({ auth: { user: { id: "user_1" } } });
  });

  it("redirects when the real AuthKit route context has no user", () => {
    expect(() =>
      requireAuthenticatedRoute({
        auth: { user: null },
        location: { pathname: "/awesome-inc", searchStr: "?tab=all" },
      }),
    ).toThrow();
  });

  it("redirects for a recoverable AuthKit provider failure", () => {
    expect(
      loadRouteAuth(() => {
        throw "HTTPError";
      }),
    ).toEqual({ user: null });
  });

  it("propagates unexpected AuthKit failures", () => {
    expect(() =>
      loadRouteAuth(() => {
        throw new Error("config failure");
      }),
    ).toThrow("config failure");
  });
});
