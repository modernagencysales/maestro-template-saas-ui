import {
  PublicSurface,
  duplicatePublicSurfaceAuthorityKeys,
  duplicatePublicSurfaceIds,
  publicSurfaceAuthorityKey,
} from "@maestro-template/template-core/publicSurface";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  AuthPolicy,
  authDenyAll,
  authPolicies,
  compareAuthPolicyStrength,
  resolveAuthPolicy,
  unknownAuthPolicyIds,
} from "../confect/capabilities/_kit/authPolicies";
import { apiKeyScopeValues } from "../confect/headless/auth";

const surface = {
  id: "brain_pages_create_cli",
  transport: "cli",
  coverageTag: "@covers_brain_pages_create_cli",
  authPolicyId: "auth_api_key_workspace_write",
  authority: {
    kind: "convex-function",
    registrationLocator: "brain.pages.createMarkdown",
  },
} as const;

describe("public surface authority", () => {
  it("decodes the canonical public-surface contract", () => {
    expect(Schema.decodeUnknownSync(PublicSurface)(surface)).toEqual(surface);
    expect(() =>
      Schema.decodeUnknownSync(PublicSurface)({
        ...surface,
        transport: "web",
      }),
    ).toThrow();
  });

  it("reports duplicate ids and canonical authority keys", () => {
    const sameAuthority = { ...surface, id: "another_id" };
    const sameId = {
      ...surface,
      transport: "api" as const,
      authority: {
        ...surface.authority,
        registrationLocator: "brain.pages.createMarkdown.api",
      },
    };

    expect(duplicatePublicSurfaceIds([surface, sameId])).toEqual([surface.id]);
    expect(
      duplicatePublicSurfaceAuthorityKeys([surface, sameAuthority]),
    ).toEqual([publicSurfaceAuthorityKey(surface)]);
  });

  it("reports unknown auth policies", () => {
    const arbitraryPolicyId: `auth_${string}` = "auth_not_registered";
    const resolved: AuthPolicy | undefined =
      resolveAuthPolicy(arbitraryPolicyId);

    expect(resolved).toBeUndefined();
    expect(resolveAuthPolicy("auth_build_pack_approve")).toBe(
      authPolicies.auth_build_pack_approve,
    );
    expect(
      unknownAuthPolicyIds([
        surface,
        { ...surface, id: "unknown", authPolicyId: "auth_missing" },
      ]),
    ).toEqual(["auth_missing"]);
  });

  it("rejects invalid role and scope literals", () => {
    const valid = authPolicies.auth_api_key_workspace_write;

    expect(() =>
      Schema.decodeUnknownSync(AuthPolicy)({
        ...valid,
        minimumRole: "superadmin",
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(AuthPolicy)({
        ...valid,
        requiredScopes: ["workspace:delete"],
      }),
    ).toThrow();
  });

  it("pins build-pack approval to an owner session membership", () => {
    expect(authPolicies.auth_build_pack_approve).toEqual({
      id: "auth_build_pack_approve",
      credential: "session",
      principalKind: "user",
      tenantAuthority: "membership",
      minimumRole: "owner",
      requiredScopes: [],
    });

    expect(
      compareAuthPolicyStrength(authPolicies.auth_build_pack_approve, {
        ...authPolicies.auth_build_pack_approve,
        minimumRole: "editor",
      }),
    ).toBe("weaker");
    expect(
      compareAuthPolicyStrength(
        authPolicies.auth_build_pack_approve,
        authPolicies.auth_api_key_admin,
      ),
    ).toBe("incomparable");
    expect(
      compareAuthPolicyStrength(
        authPolicies.auth_build_pack_approve,
        authPolicies.auth_owner_token,
      ),
    ).toBe("incomparable");
  });

  it("orders closed policy changes without treating incomparability as safe", () => {
    const base = authPolicies.auth_api_key_workspace_write;

    expect(
      compareAuthPolicyStrength(base, {
        ...base,
        tenantAuthority: "none",
      }),
    ).toBe("weaker");
    expect(
      compareAuthPolicyStrength(base, {
        ...base,
        requiredScopes: [],
      }),
    ).toBe("weaker");
    expect(
      compareAuthPolicyStrength(base, {
        ...base,
        credential: "public",
        principalKind: "anonymous",
        tenantAuthority: "none",
        requiredScopes: [],
      }),
    ).toBe("weaker");
    expect(compareAuthPolicyStrength(base, authPolicies.auth_owner_token)).toBe(
      "incomparable",
    );
    expect(compareAuthPolicyStrength(base, authDenyAll)).toBe("stronger");
  });

  it("treats the existing admin API-key scope as the wildcard it enforces", () => {
    expect(
      compareAuthPolicyStrength(
        authPolicies.auth_api_key_workspace_write,
        authPolicies.auth_api_key_admin,
      ),
    ).toBe("stronger");
    expect(
      compareAuthPolicyStrength(
        authPolicies.auth_api_key_admin,
        authPolicies.auth_api_key_workspace_write,
      ),
    ).toBe("weaker");
  });

  it("is reflexive and never calls role or scope removal safe", () => {
    for (const policy of Object.values(authPolicies)) {
      expect(compareAuthPolicyStrength(policy, policy)).toBe("same");
    }

    for (const role of ["viewer", "editor", "admin"] as const) {
      expect(
        compareAuthPolicyStrength(authPolicies.auth_build_pack_approve, {
          ...authPolicies.auth_build_pack_approve,
          minimumRole: role,
        }),
      ).not.toMatch(/same|stronger/u);
    }

    for (let mask = 1; mask < 1 << apiKeyScopeValues.length; mask += 1) {
      const requiredScopes = apiKeyScopeValues.filter(
        (_, index) => (mask & (1 << index)) !== 0,
      );
      const base: AuthPolicy = {
        ...authPolicies.auth_api_key_workspace_read,
        requiredScopes,
      };

      for (const removed of requiredScopes) {
        expect(
          compareAuthPolicyStrength(base, {
            ...base,
            requiredScopes: requiredScopes.filter(
              (candidate) => candidate !== removed,
            ),
          }),
          `removing ${removed} from ${requiredScopes.join(",")}`,
        ).not.toMatch(/same|stronger/u);
      }
    }
  });
});
