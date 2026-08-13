import { describe, expect, it } from "vitest";

import {
  safeReturnPath,
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
});
