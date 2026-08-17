import { describe, expect, it, vi } from "vitest";

vi.mock("@fontsource-variable/inter", () => ({}));
vi.mock("@workos/authkit-tanstack-react-start", () => ({
  getAuth: async () => ({ user: { id: "user_1" } }),
  getAccessTokenAction: async () => "secret",
}));

import { Route } from "../../routes/__root";
import { Route as AuthRoute } from "../../routes/_auth";
import { Route as AppRoute } from "../../routes/_app";

describe("root auth context", () => {
  it("authenticates Convex before child beforeLoad hooks run", async () => {
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeTypeOf("function");

    let fetchToken: (() => Promise<string | null>) | undefined;
    const context = {
      convexClient: {
        setAuth: (fetcher: () => Promise<string | null>) => {
          fetchToken = fetcher;
        },
      },
    };
    const result = await beforeLoad?.({
      context,
    } as never);

    expect(result).toEqual({ auth: { user: { id: "user_1" } } });
    await expect(fetchToken?.()).resolves.toBe("secret");
  });
});

describe("auth route context", () => {
  it("uses server auth context instead of a browser-relative session fetch", async () => {
    expect(
      AuthRoute.options.beforeLoad?.({
        context: { auth: { user: null } },
      } as never),
    ).toBeUndefined();
  });

  it("uses root auth for protected client navigation", () => {
    expect(
      AppRoute.options.beforeLoad?.({
        context: { auth: { user: { id: "user_1" } } },
        location: { pathname: "/workspace", searchStr: "" },
      } as never),
    ).toBeUndefined();
  });
});
