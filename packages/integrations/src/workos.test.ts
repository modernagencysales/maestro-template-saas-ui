import { describe, expect, it } from "vitest";
import {
  classifyWorkosSignatureFailure,
  createAuthKitRouteRegistration,
  createFakeAuthKitClient,
  deriveWorkosConvexAuthConfig,
  validateWorkosEnv,
  WorkosConfigError,
} from "./workos";

describe("WorkOS AuthKit seam", () => {
  it("validates required live env without exposing values", () => {
    const result = validateWorkosEnv("live", {
      WORKOS_API_KEY: "secret",
      WORKOS_CLIENT_ID: "",
    });

    expect(result).toBeInstanceOf(WorkosConfigError);
    expect(result).toMatchObject({
      _tag: "WorkosConfigError",
      missingEnv: [
        "WORKOS_CLIENT_ID",
        "WORKOS_COOKIE_PASSWORD",
        "WORKOS_REDIRECT_URI",
      ],
      invalidEnv: [],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(validateWorkosEnv("fake", {})).toBe(true);
  });

  it("rejects whitespace-contaminated live env without exposing values", () => {
    const result = validateWorkosEnv("live", {
      WORKOS_API_KEY: " secret ",
      WORKOS_CLIENT_ID: "client_123",
      WORKOS_COOKIE_PASSWORD: "password_123",
      WORKOS_REDIRECT_URI: "https://app.example.test/auth/callback",
    });

    expect(result).toBeInstanceOf(WorkosConfigError);
    expect(result).toMatchObject({
      _tag: "WorkosConfigError",
      missingEnv: [],
      invalidEnv: ["WORKOS_API_KEY"],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("accepts complete live env values", () => {
    expect(
      validateWorkosEnv("live", {
        WORKOS_API_KEY: "secret",
        WORKOS_CLIENT_ID: "client_123",
        WORKOS_COOKIE_PASSWORD: "password_123",
        WORKOS_REDIRECT_URI: "https://app.example.test/auth/callback",
      }),
    ).toBe(true);
  });

  it("creates a fake AuthKit client with deterministic URLs", () => {
    const client = createFakeAuthKitClient({
      baseUrl: "https://acme-demo.example.test",
      organizationId: "org_acme_demo",
    });

    expect(client.mode).toBe("fake");
    expect(client.getSignInUrl("state_123")).toBe(
      "https://acme-demo.example.test/auth/fake/sign-in?organization_id=org_acme_demo&state=state_123",
    );
    expect(client.getSignOutUrl()).toBe(
      "https://acme-demo.example.test/auth/fake/sign-out",
    );
  });

  it("builds live-ready AuthKit route registration shape", () => {
    expect(
      createAuthKitRouteRegistration({
        callbackPath: "/auth/callback",
        logoutPath: "/auth/logout",
        redirectUri: "https://app.example.test/auth/callback",
        logoutUri: "https://app.example.test",
      }),
    ).toEqual({
      callback: {
        path: "/auth/callback",
        redirectUri: "https://app.example.test/auth/callback",
      },
      logout: {
        path: "/auth/logout",
        logoutUri: "https://app.example.test",
      },
    });
  });

  it("classifies signature failures for webhooks and callbacks", () => {
    expect(
      classifyWorkosSignatureFailure({
        hasSignature: false,
        timestampSkewMs: 0,
        verified: false,
      }),
    ).toMatchObject({ reason: "missing_signature" });
    expect(
      classifyWorkosSignatureFailure({
        hasSignature: true,
        timestampSkewMs: 600_000,
        verified: false,
      }),
    ).toMatchObject({ reason: "stale_timestamp" });
    expect(
      classifyWorkosSignatureFailure({
        hasSignature: true,
        timestampSkewMs: 1_000,
        verified: false,
      }),
    ).toMatchObject({ reason: "invalid_signature" });
  });

  it("derives Convex auth config from trusted issuer and JWKS values", () => {
    expect(
      deriveWorkosConvexAuthConfig({
        applicationId: "client_fake_local_key",
      }),
    ).toEqual({
      providers: [
        {
          type: "customJwt",
          issuer:
            "https://api.workos.com/user_management/client_fake_local_key",
          jwks: "https://api.workos.com/sso/jwks/client_fake_local_key",
        },
      ],
    });
  });
});
