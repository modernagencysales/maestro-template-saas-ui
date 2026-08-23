import { describe, expect, it, vi } from "vitest";

import {
  assertProductionAuthConfiguration,
  buildRequestMiddleware,
  resolveWebAuthMode,
} from "./runtime-auth";

describe("web runtime auth mode", () => {
  it("uses fixture auth for fake provider builds", () => {
    expect(resolveWebAuthMode({ APP_PROVIDER_MODE: "fake" })).toBe("fixture");
    expect(
      resolveWebAuthMode({
        APP_ENV: "preview",
        VITE_MAESTRO_AUTH_MODE: "fixture",
      }),
    ).toBe("fixture");
  });

  it("defaults to WorkOS and rejects unknown modes", () => {
    expect(resolveWebAuthMode({})).toBe("workos");
    expect(() =>
      resolveWebAuthMode({ VITE_MAESTRO_AUTH_MODE: "anonymous" }),
    ).toThrow("Unknown VITE_MAESTRO_AUTH_MODE");
  });

  it("forbids fixture auth in production", () => {
    expect(() =>
      resolveWebAuthMode({
        APP_ENV: "production",
        APP_PROVIDER_MODE: "fake",
      }),
    ).toThrow("Fixture authentication is forbidden in production");
    expect(() =>
      resolveWebAuthMode({
        APP_ENV: "production",
        VITE_MAESTRO_AUTH_MODE: "fixture",
      }),
    ).toThrow("Fixture authentication is forbidden in production");
  });

  it("does not construct WorkOS middleware in fixture mode", () => {
    const csrf = { id: "csrf" };
    const workos = { id: "workos" };
    const createWorkos = vi.fn(() => workos);

    expect(
      buildRequestMiddleware({ mode: "fixture", csrf, createWorkos }),
    ).toEqual([csrf]);
    expect(createWorkos).not.toHaveBeenCalled();

    expect(
      buildRequestMiddleware({ mode: "workos", csrf, createWorkos }),
    ).toEqual([csrf, workos]);
    expect(createWorkos).toHaveBeenCalledOnce();
  });

  it("fails production before build when WorkOS configuration is incomplete", () => {
    expect(() =>
      assertProductionAuthConfiguration({
        APP_ENV: "production",
        VITE_MAESTRO_AUTH_MODE: "workos",
      }),
    ).toThrow(
      "Production WorkOS configuration is missing: WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_REDIRECT_URI, WORKOS_COOKIE_PASSWORD",
    );
    expect(() =>
      assertProductionAuthConfiguration({
        APP_ENV: "production",
        VITE_MAESTRO_AUTH_MODE: "workos",
        WORKOS_CLIENT_ID: "client_1",
        WORKOS_API_KEY: "sk_1",
        WORKOS_REDIRECT_URI: "https://app.example.test/auth/callback",
        WORKOS_COOKIE_PASSWORD: "a-secure-cookie-password",
      }),
    ).not.toThrow();
  });

  it("does not require WorkOS credentials outside production", () => {
    expect(() =>
      assertProductionAuthConfiguration({
        APP_ENV: "preview",
        VITE_MAESTRO_AUTH_MODE: "fixture",
      }),
    ).not.toThrow();
  });
});
