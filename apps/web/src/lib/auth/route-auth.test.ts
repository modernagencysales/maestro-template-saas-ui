import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fixtureClientAuth,
  safeReturnPath,
  loadRouteAuth,
  requireAuthenticatedRoute,
} from "#lib/auth/route-auth";

describe("protected route auth", () => {
  afterEach(() => vi.unstubAllEnvs());

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

  it("admits the isolated contracts runtime without a WorkOS session", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_MAESTRO_CONTRACT_MODE", "1");

    expect(
      requireAuthenticatedRoute({
        auth: { user: null },
        location: { pathname: "/contracts-primary/records", searchStr: "" },
      }),
    ).toEqual({ auth: { user: { id: "contracts-runtime" } } });
  });

  it("admits an explicitly selected fixture-auth review runtime", () => {
    vi.stubEnv("VITE_MAESTRO_AUTH_MODE", "fixture");

    expect(
      requireAuthenticatedRoute({
        auth: { user: null },
        location: { pathname: "/review/records", searchStr: "" },
      }),
    ).toEqual({ auth: { user: { id: "fixture-runtime" } } });
  });

  it("never enables the contracts bypass outside development", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_MAESTRO_CONTRACT_MODE", "1");

    expect(() =>
      requireAuthenticatedRoute({
        auth: { user: null },
        location: { pathname: "/contracts-primary/records", searchStr: "" },
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
it("does not invent a WorkOS session for fixture providers", () => {
  expect(fixtureClientAuth()).toEqual({ user: null });
});
