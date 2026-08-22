import { describe, expect, it } from "vitest";

import { resolveRuntimeConvex } from "./runtime-convex";

describe("runtime Convex selection", () => {
  it("uses a non-network placeholder in fixture mode", () => {
    expect(resolveRuntimeConvex({ fixture: true, url: undefined })).toEqual({
      connect: false,
      url: "http://127.0.0.1:3210",
    });
    expect(resolveRuntimeConvex({ fixture: true, url: "" })).toEqual({
      connect: false,
      url: "http://127.0.0.1:3210",
    });
  });

  it("connects live mode to an explicit deployment", () => {
    expect(
      resolveRuntimeConvex({
        fixture: false,
        url: "https://example.convex.cloud",
      }),
    ).toEqual({
      connect: true,
      url: "https://example.convex.cloud",
    });
  });

  it("fails closed when live mode has no deployment", () => {
    expect(() =>
      resolveRuntimeConvex({ fixture: false, url: undefined }),
    ).toThrow("VITE_CONVEX_URL is required in live mode");
  });
});
