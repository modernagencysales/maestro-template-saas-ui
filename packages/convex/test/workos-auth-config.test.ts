import { describe, expect, it } from "vitest";

import {
  AuthConfigurationInvalid,
  deriveWorkosConvexAuthConfig,
  loadWorkosConvexAuthConfig,
} from "../convex/auth.config";

const liveEnv = {
  APP_ENV: "live",
  APP_PROVIDER_MODE: "live",
  WORKOS_CLIENT_ID: "client_live_example",
  WORKOS_AUTHKIT_ISSUER: "https://api.workos.com",
  WORKOS_AUTHKIT_JWKS_URL: "https://api.workos.com/sso/jwks/org_live_example",
} as const;

describe("WorkOS Convex auth config", () => {
  it("derives customJwt config from validated WorkOS values", () => {
    expect(
      deriveWorkosConvexAuthConfig({
        issuer: "https://api.workos.com",
        jwksUrl: "https://api.workos.com/sso/jwks/org_live_example",
        applicationId: "client_live_example",
      }),
    ).toEqual({
      providers: [
        {
          type: "customJwt",
          issuer: "https://api.workos.com",
          jwks: "https://api.workos.com/sso/jwks/org_live_example",
          applicationID: "client_live_example",
          algorithm: "RS256",
        },
      ],
    });
  });

  it("rejects missing live issuer/JWKS/client values", () => {
    expect(() =>
      loadWorkosConvexAuthConfig({
        ...liveEnv,
        WORKOS_AUTHKIT_ISSUER: undefined,
      }),
    ).toThrow(AuthConfigurationInvalid);
  });

  it("rejects malformed WorkOS URLs before Convex startup", () => {
    expect(() =>
      loadWorkosConvexAuthConfig({
        ...liveEnv,
        WORKOS_AUTHKIT_JWKS_URL: "not-a-url",
      }),
    ).toThrow(AuthConfigurationInvalid);
  });

  it("rejects fake Convex auth in production", () => {
    expect(() =>
      loadWorkosConvexAuthConfig({
        APP_ENV: "production",
        APP_PROVIDER_MODE: "fake",
      }),
    ).toThrow(AuthConfigurationInvalid);
  });

  it("allows explicit fake Convex auth only outside production", () => {
    expect(
      loadWorkosConvexAuthConfig({
        APP_ENV: "fake",
        APP_PROVIDER_MODE: "fake",
      }),
    ).toEqual({
      providers: [
        {
          type: "customJwt",
          issuer: "https://api.workos.com",
          jwks: "https://api.workos.com/sso/jwks/org_acme_demo",
          applicationID: "client_fake_local_key",
          algorithm: "RS256",
        },
      ],
    });
  });
});
