import { describe, expect, it } from "vitest";

import {
  loadInitialAuthForConvex,
  stripAccessToken,
} from "#lib/auth/workos-auth-loader";
import { fetchWorkosAccessToken } from "#lib/auth/workos-auth";

describe("WorkOS auth adapter", () => {
  it("returns no token without a user", async () => {
    await expect(
      fetchWorkosAccessToken({
        forceRefreshToken: false,
        getAccessToken: async () => "unexpected",
        refresh: async () => "unexpected",
        user: null,
      }),
    ).resolves.toBeNull();
  });

  it("refreshes when Convex requests a forced refresh", async () => {
    await expect(
      fetchWorkosAccessToken({
        forceRefreshToken: true,
        getAccessToken: async () => "stale",
        refresh: async () => "fresh",
        user: { id: "user_1" },
      }),
    ).resolves.toBe("fresh");
  });

  it("strips server access tokens from initial auth", () => {
    expect(
      stripAccessToken({
        accessToken: "secret",
        user: { id: "user_1" },
        sessionId: "session_1",
      } as never),
    ).toEqual({ user: { id: "user_1" }, sessionId: "session_1" });
  });

  it("authenticates the router Convex client without serializing its token", async () => {
    let fetchToken: (() => Promise<string | null>) | undefined;
    const initialAuth = await loadInitialAuthForConvex(
      {
        setAuth: (fetcher) => {
          fetchToken = fetcher;
        },
      },
      async () =>
        ({
          accessToken: "secret",
          user: { id: "user_1" },
          sessionId: "session_1",
        }) as never,
      async () => "secret",
    );

    expect(initialAuth).toEqual({
      user: { id: "user_1" },
      sessionId: "session_1",
    });
    await expect(fetchToken?.()).resolves.toBe("secret");
  });

  it("returns an unauthenticated initial state when auth context is unavailable", async () => {
    await expect(
      loadInitialAuthForConvex({ setAuth: () => undefined }, async () => {
        throw "HTTPError";
      }),
    ).resolves.toEqual({ user: null });
  });

  it("does not hide unexpected auth failures", async () => {
    await expect(
      loadInitialAuthForConvex({ setAuth: () => undefined }, async () => {
        throw new Error("configuration failure");
      }),
    ).rejects.toThrow("configuration failure");
  });
});
