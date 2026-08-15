import { describe, expect, it } from "vitest";
import authConfig, {
  deriveWorkosConvexAuthConfig,
} from "../convex/auth.config";

describe("Convex WorkOS auth config", () => {
  it("exports fake-safe default config and derivation helper", () => {
    expect(authConfig.providers[0]).toMatchObject({
      type: "customJwt",
      issuer: "https://api.workos.com/user_management/client_fake_local_key",
      jwks: "https://api.workos.com/sso/jwks/client_fake_local_key",
      algorithm: "RS256",
    });
    expect(authConfig.providers[0]).not.toHaveProperty("applicationID");
    expect(
      deriveWorkosConvexAuthConfig({
        applicationId: "client_test",
      }),
    ).toMatchObject({
      providers: [
        {
          issuer: "https://api.workos.com/user_management/client_test",
          jwks: "https://api.workos.com/sso/jwks/client_test",
        },
      ],
    });
  });
});
