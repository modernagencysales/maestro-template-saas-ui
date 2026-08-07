import { describe, expect, it } from "vitest";
import { isContractMode, resolveWebEnv, WebEnvConfigError } from "./env";

describe("web environment", () => {
  it("enables contract mode only for the explicit flag", () => {
    expect(isContractMode({})).toBe(false);
    expect(isContractMode({ VITE_MAESTRO_CONTRACT_MODE: "1" })).toBe(true);
  });

  it("uses a fake-safe Convex fallback when no URL is configured", () => {
    expect(resolveWebEnv({})).toEqual({
      env: { VITE_CONVEX_URL: "https://example-template.convex.cloud" },
      convexConfigured: false,
    });
    expect(resolveWebEnv({ VITE_CONVEX_URL: "   " })).toEqual({
      env: { VITE_CONVEX_URL: "https://example-template.convex.cloud" },
      convexConfigured: false,
    });
  });

  it("accepts exact configured Convex URLs", () => {
    expect(
      resolveWebEnv({
        VITE_CONVEX_URL: "https://acme-demo.example.test/convex",
      }),
    ).toEqual({
      env: { VITE_CONVEX_URL: "https://acme-demo.example.test/convex" },
      convexConfigured: true,
    });
  });

  it("rejects whitespace-contaminated configured URLs by env name", () => {
    expect(() =>
      resolveWebEnv({
        VITE_CONVEX_URL: " https://acme-demo.example.test/convex ",
      }),
    ).toThrow(WebEnvConfigError);

    try {
      resolveWebEnv({
        VITE_CONVEX_URL: " https://acme-demo.example.test/convex ",
      });
      throw new Error("expected resolveWebEnv to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebEnvConfigError);
      expect(error).toMatchObject({ invalidEnv: ["VITE_CONVEX_URL"] });
      expect(JSON.stringify(error)).not.toContain("acme-demo");
    }
  });
});
