import type { PublicSurface } from "@maestro-template/template-core/publicSurface";
import * as Schema from "effect/Schema";

import { Role, roleAtLeast, type Role as RoleType } from "../../access/roles";
import {
  ApiKeyScope,
  type ApiKeyScope as ApiKeyScopeType,
} from "../../headless/auth";

export type { RoleType as Role, ApiKeyScopeType as ApiKeyScope };

export type AuthPolicy = {
  readonly id: `auth_${string}`;
  readonly credential:
    | "public"
    | "session"
    | "api-key"
    | "owner-token"
    | "webhook-signature"
    | "deny-all";
  readonly principalKind: "anonymous" | "user" | "apiKey" | "system";
  readonly tenantAuthority: "none" | "membership" | "principal-workspace";
  readonly minimumRole?: RoleType;
  readonly requiredScopes: readonly ApiKeyScopeType[];
};

export const AuthPolicy = Schema.Struct({
  id: Schema.String.pipe(Schema.check(Schema.isPattern(/^auth_.+$/u))),
  credential: Schema.Literals([
    "public",
    "session",
    "api-key",
    "owner-token",
    "webhook-signature",
    "deny-all",
  ]),
  principalKind: Schema.Literals(["anonymous", "user", "apiKey", "system"]),
  tenantAuthority: Schema.Literals([
    "none",
    "membership",
    "principal-workspace",
  ]),
  minimumRole: Schema.optional(Role),
  requiredScopes: Schema.Array(ApiKeyScope),
});

const policy = <const Policy extends AuthPolicy>(value: Policy): Policy =>
  Object.freeze({
    ...value,
    requiredScopes: Object.freeze(value.requiredScopes),
  });

export const authDenyAll = policy({
  id: "auth_deny_all",
  credential: "deny-all",
  principalKind: "system",
  tenantAuthority: "none",
  requiredScopes: [],
});

const authPolicyEntries = Object.freeze({
  auth_deny_all: authDenyAll,
  auth_public: policy({
    id: "auth_public",
    credential: "public",
    principalKind: "anonymous",
    tenantAuthority: "none",
    requiredScopes: [],
  }),
  auth_session_membership_viewer: policy({
    id: "auth_session_membership_viewer",
    credential: "session",
    principalKind: "user",
    tenantAuthority: "membership",
    minimumRole: "viewer",
    requiredScopes: [],
  }),
  auth_session_membership_editor: policy({
    id: "auth_session_membership_editor",
    credential: "session",
    principalKind: "user",
    tenantAuthority: "membership",
    minimumRole: "editor",
    requiredScopes: [],
  }),
  auth_session_membership_admin: policy({
    id: "auth_session_membership_admin",
    credential: "session",
    principalKind: "user",
    tenantAuthority: "membership",
    minimumRole: "admin",
    requiredScopes: [],
  }),
  auth_session_membership_owner: policy({
    id: "auth_session_membership_owner",
    credential: "session",
    principalKind: "user",
    tenantAuthority: "membership",
    minimumRole: "owner",
    requiredScopes: [],
  }),
  auth_api_key_workspace_read: policy({
    id: "auth_api_key_workspace_read",
    credential: "api-key",
    principalKind: "apiKey",
    tenantAuthority: "principal-workspace",
    requiredScopes: ["workspace:read"],
  }),
  auth_api_key_workspace_write: policy({
    id: "auth_api_key_workspace_write",
    credential: "api-key",
    principalKind: "apiKey",
    tenantAuthority: "principal-workspace",
    requiredScopes: ["workspace:write"],
  }),
  auth_api_key_capability_run: policy({
    id: "auth_api_key_capability_run",
    credential: "api-key",
    principalKind: "apiKey",
    tenantAuthority: "principal-workspace",
    requiredScopes: ["capability:run"],
  }),
  auth_api_key_workflow_run: policy({
    id: "auth_api_key_workflow_run",
    credential: "api-key",
    principalKind: "apiKey",
    tenantAuthority: "principal-workspace",
    requiredScopes: ["workflow:run"],
  }),
  auth_api_key_admin: policy({
    id: "auth_api_key_admin",
    credential: "api-key",
    principalKind: "apiKey",
    tenantAuthority: "principal-workspace",
    requiredScopes: ["admin"],
  }),
  auth_owner_token: policy({
    id: "auth_owner_token",
    credential: "owner-token",
    principalKind: "system",
    tenantAuthority: "none",
    requiredScopes: [],
  }),
  auth_dodo_webhook: policy({
    id: "auth_dodo_webhook",
    credential: "webhook-signature",
    principalKind: "system",
    tenantAuthority: "none",
    requiredScopes: [],
  }),
  auth_postmark_webhook: policy({
    id: "auth_postmark_webhook",
    credential: "webhook-signature",
    principalKind: "system",
    tenantAuthority: "none",
    requiredScopes: [],
  }),
  auth_signed_unsubscribe: policy({
    id: "auth_signed_unsubscribe",
    credential: "webhook-signature",
    principalKind: "system",
    tenantAuthority: "none",
    requiredScopes: [],
  }),
  auth_build_pack_approve: policy({
    id: "auth_build_pack_approve",
    credential: "session",
    principalKind: "user",
    tenantAuthority: "membership",
    minimumRole: "owner",
    requiredScopes: [],
  }),
} satisfies Readonly<Record<AuthPolicy["id"], AuthPolicy>>);

export const authPolicies: Readonly<Record<AuthPolicy["id"], AuthPolicy>> &
  typeof authPolicyEntries = authPolicyEntries;

export const resolveAuthPolicy = (
  id: AuthPolicy["id"],
): AuthPolicy | undefined =>
  Object.hasOwn(authPolicyEntries, id)
    ? authPolicyEntries[id as keyof typeof authPolicyEntries]
    : undefined;

type Strength = "same" | "stronger" | "weaker" | "incomparable";

const combineStrength = (parts: readonly Strength[]): Strength => {
  if (parts.includes("incomparable")) return "incomparable";
  const stronger = parts.includes("stronger");
  const weaker = parts.includes("weaker");
  return stronger && weaker
    ? "incomparable"
    : stronger
      ? "stronger"
      : weaker
        ? "weaker"
        : "same";
};

const compareTenantAuthority = (
  base: AuthPolicy["tenantAuthority"],
  candidate: AuthPolicy["tenantAuthority"],
): Strength => {
  if (base === candidate) return "same";
  if (candidate === "none") return "weaker";
  if (base === "none") return "stronger";
  return "incomparable";
};

const compareMinimumRole = (
  base: RoleType | undefined,
  candidate: RoleType | undefined,
): Strength => {
  if (base === candidate) return "same";
  if (candidate === undefined) return "weaker";
  if (base === undefined) return "stronger";
  return roleAtLeast(candidate, base) ? "stronger" : "weaker";
};

const compareScopes = (
  base: readonly ApiKeyScopeType[],
  candidate: readonly ApiKeyScopeType[],
): Strength => {
  const baseSet = new Set(base);
  const candidateSet = new Set(candidate);
  const candidateIncludesBase = [...baseSet].every((scope) =>
    candidateSet.has(scope),
  );
  const baseIncludesCandidate = [...candidateSet].every((scope) =>
    baseSet.has(scope),
  );

  if (candidateIncludesBase && baseIncludesCandidate) return "same";
  if (candidateIncludesBase) return "stronger";
  if (baseIncludesCandidate) return "weaker";

  const baseRequiresAdmin = base.includes("admin");
  const candidateRequiresAdmin = candidate.includes("admin");
  if (baseRequiresAdmin || candidateRequiresAdmin) {
    return baseRequiresAdmin === candidateRequiresAdmin
      ? "same"
      : candidateRequiresAdmin
        ? "stronger"
        : "weaker";
  }
  return "incomparable";
};

export const compareAuthPolicyStrength = (
  base: AuthPolicy,
  candidate: AuthPolicy,
): Strength => {
  if (base.credential !== candidate.credential) {
    if (candidate.credential === "deny-all") return "stronger";
    if (base.credential === "deny-all") return "weaker";
    if (candidate.credential === "public") return "weaker";
    if (base.credential === "public") return "stronger";
    return "incomparable";
  }
  if (base.principalKind !== candidate.principalKind) return "incomparable";

  return combineStrength([
    compareTenantAuthority(base.tenantAuthority, candidate.tenantAuthority),
    compareMinimumRole(base.minimumRole, candidate.minimumRole),
    compareScopes(base.requiredScopes, candidate.requiredScopes),
  ]);
};

export const unknownAuthPolicyIds = (
  surfaces: readonly PublicSurface[],
): readonly string[] =>
  [
    ...new Set(
      surfaces
        .map((surface) => surface.authPolicyId)
        .filter((id) => resolveAuthPolicy(id) === undefined),
    ),
  ].sort((left, right) => left.localeCompare(right));
