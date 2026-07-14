import { describe, expect, it } from "vitest";

import {
  authSnapshotToInitialAuth,
  createWorkosConvexAuthHook,
} from "./authkit-client";

const authenticatedSnapshot = {
  status: "authenticated",
  subject: "user_123",
  email: "user@example.com",
  organizationId: "org_123",
  accessToken: "token-redacted",
} as const;

describe("AuthKit client bridge", () => {
  it("converts signed-out snapshots to AuthKit initial auth without tokens", () => {
    const initialAuth = authSnapshotToInitialAuth({ status: "signedOut" });

    expect(initialAuth).toEqual({ user: null });
    expect(JSON.stringify(initialAuth)).not.toContain("access_token");
  });

  it("converts authenticated snapshots to AuthKit initial auth without access tokens", () => {
    const initialAuth = authSnapshotToInitialAuth(authenticatedSnapshot);

    expect(initialAuth).toMatchObject({
      user: { id: "user_123", email: "user@example.com" },
      organizationId: "org_123",
    });
    expect(JSON.stringify(initialAuth)).not.toContain("token-redacted");
  });

  it("adapts AuthKit access tokens to Convex custom auth", async () => {
    const useConvexAuth = createWorkosConvexAuthHook(() => ({
      user: { id: "user_123" },
      loading: false,
      token: {
        accessToken: "cached_access_token",
        loading: false,
        getAccessToken: async () => "fresh_access_token",
      },
    }));

    const auth = useConvexAuth();

    await expect(auth.fetchAccessToken()).resolves.toBe("fresh_access_token");
    expect(auth).toMatchObject({ isLoading: false, isAuthenticated: true });
  });

  it("lets Convex request a fresh token when the cached token is missing", async () => {
    const useConvexAuth = createWorkosConvexAuthHook(() => ({
      user: { id: "user_123" },
      loading: false,
      token: {
        accessToken: undefined,
        loading: false,
        getAccessToken: async () => undefined,
      },
    }));

    const auth = useConvexAuth();

    await expect(auth.fetchAccessToken()).resolves.toBeNull();
    expect(auth.isAuthenticated).toBe(true);
  });
});
