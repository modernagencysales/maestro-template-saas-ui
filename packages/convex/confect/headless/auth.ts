import * as Schema from "effect/Schema";

import { Forbidden } from "../errors";
import { roleAtLeast, type Role } from "../access/roles";
import {
  base64UrlEncode,
  constantTimeEqual,
  sha256Base64Url,
} from "../shared/tokenCrypto";

export const HeadlessApiKeyScope = Schema.Literal("brain:read", "brain:ask");
export type HeadlessApiKeyScope = Schema.Schema.Type<
  typeof HeadlessApiKeyScope
>;

export const LegacyApiKeyScope = Schema.Literal(
  "workspace:read",
  "workspace:write",
  "capability:run",
  "workflow:run",
  "admin",
);

export const ApiKeyScope = Schema.Union(LegacyApiKeyScope, HeadlessApiKeyScope);
export type ApiKeyScope = Schema.Schema.Type<typeof ApiKeyScope>;

export const ApiKeyStatus = Schema.Literal("active", "revoked", "expired");
export type ApiKeyStatus = Schema.Schema.Type<typeof ApiKeyStatus>;

export const ServicePrincipalStatus = Schema.Literal(
  "active",
  "revoked",
  "expired",
);
export type ServicePrincipalStatus = Schema.Schema.Type<
  typeof ServicePrincipalStatus
>;

export const NullableNumber = Schema.NullOr(Schema.Number);

export const ServicePrincipalRow = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  workspaceId: Schema.String,
  brainKey: Schema.String,
  roleCeiling: Schema.Literal("viewer"),
  status: ServicePrincipalStatus,
  generation: Schema.Number,
  createdByUserId: Schema.String,
  createdAt: Schema.Number,
  revokedAt: NullableNumber,
});
export type ServicePrincipalRow = Schema.Schema.Type<
  typeof ServicePrincipalRow
>;

export const ApiKeyRow = Schema.Struct({
  id: Schema.String,
  principalId: Schema.optional(Schema.String),
  organizationId: Schema.optional(Schema.String),
  workspaceId: Schema.String,
  brainKey: Schema.optional(Schema.String),
  name: Schema.String,
  keyHash: Schema.String,
  displayPrefix: Schema.String,
  scopes: Schema.Array(ApiKeyScope),
  roleCeiling: Schema.optional(Schema.Literal("viewer")),
  status: ApiKeyStatus,
  createdByUserId: Schema.String,
  createdAt: Schema.Number,
  expiresAt: NullableNumber,
  revokedAt: NullableNumber,
  lastUsedAt: NullableNumber,
});

export type ApiKeyRow = Schema.Schema.Type<typeof ApiKeyRow>;

export const ApiKeyMetadataSchema = Schema.Struct({
  id: Schema.String,
  principalId: Schema.String,
  organizationId: Schema.String,
  workspaceId: Schema.String,
  brainKey: Schema.String,
  name: Schema.String,
  displayPrefix: Schema.String,
  scopes: Schema.Array(HeadlessApiKeyScope),
  roleCeiling: Schema.Literal("viewer"),
  status: ApiKeyStatus,
  createdByUserId: Schema.String,
  createdAt: Schema.Number,
  expiresAt: NullableNumber,
  revokedAt: NullableNumber,
  lastUsedAt: NullableNumber,
});

export type ApiKeyMetadata = Schema.Schema.Type<typeof ApiKeyMetadataSchema>;

export type ApiKeyCreateInput = {
  readonly workspaceId: string;
  readonly name: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly createdByUserId: string;
  readonly nowMs: number;
  readonly expiresAt?: number | undefined;
  readonly randomBytes?: () => Uint8Array;
};

export type BrainApiKeyCreateInput = {
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly brainKey: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly actor: { readonly userId: string; readonly role: Role };
  readonly nowMs: number;
  readonly expiresAt?: number | undefined;
  readonly randomBytes?: () => Uint8Array;
};

export type ApiKeyCreateResult = {
  readonly displayKey: string;
  readonly row: ApiKeyRow;
};

export type BrainApiKeyCreateResult = {
  readonly displayKey: string;
  readonly key: ApiKeyMetadata & { readonly keyHash: string };
  readonly principal: ServicePrincipalRow;
};

export type ApiKeyVerificationSuccess = {
  readonly ok: true;
  readonly organizationId?: string;
  readonly workspaceId: string;
  readonly brainKey?: string;
  readonly roleCeiling?: "viewer";
  readonly keyId: string;
  readonly principalId?: string;
  readonly scopes: readonly ApiKeyScope[];
};

export type HeadlessAuthErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_NOT_FOUND"
  | "API_KEY_REVOKED"
  | "API_KEY_EXPIRED"
  | "API_KEY_FORBIDDEN"
  | "SERVICE_PRINCIPAL_REVOKED";

export class HeadlessAuthError extends Schema.TaggedError<HeadlessAuthError>()(
  "HeadlessAuthError",
  {
    code: Schema.Literal(
      "API_KEY_MISSING",
      "API_KEY_NOT_FOUND",
      "API_KEY_REVOKED",
      "API_KEY_EXPIRED",
      "API_KEY_FORBIDDEN",
      "SERVICE_PRINCIPAL_REVOKED",
    ),
    message: Schema.String,
  },
) {}

export class ApiKeyScopeInvalid extends Schema.TaggedError<ApiKeyScopeInvalid>()(
  "ApiKeyScopeInvalid",
  { scope: Schema.String },
) {}

export class ApiKeyExpiryInvalid extends Schema.TaggedError<ApiKeyExpiryInvalid>()(
  "ApiKeyExpiryInvalid",
  { reason: Schema.String },
) {}

export class ApiKeyNotFound extends Schema.TaggedError<ApiKeyNotFound>()(
  "ApiKeyNotFound",
  { keyId: Schema.String },
) {}

export class ApiKeyRevoked extends Schema.TaggedError<ApiKeyRevoked>()(
  "ApiKeyRevoked",
  { keyId: Schema.String },
) {}

export class ApiKeyExpired extends Schema.TaggedError<ApiKeyExpired>()(
  "ApiKeyExpired",
  { keyId: Schema.String },
) {}

export class ServicePrincipalRevoked extends Schema.TaggedError<ServicePrincipalRevoked>()(
  "ServicePrincipalRevoked",
  { principalId: Schema.String },
) {}

export type ApiKeyVerificationFailure = {
  readonly ok: false;
  readonly error: HeadlessAuthError;
};

export type ApiKeyVerificationResult =
  ApiKeyVerificationSuccess | ApiKeyVerificationFailure;

const MAX_EXPIRY_MS = 90 * 24 * 60 * 60 * 1_000;
const HEADLESS_KEY_PREFIX = "mbk_live_";
const LEGACY_KEY_PREFIX = "mtk_live_";

const raiseTagged = (error: unknown): never => {
  throw error;
};

const makeAuthError = (
  code: HeadlessAuthErrorCode,
  message: string,
): HeadlessAuthError => new HeadlessAuthError({ code, message });

const defaultRandomBytes = (): Uint8Array => {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return bytes;
};

const displayPrefixFor = (displayKey: string): string =>
  displayKey.slice(0, 16);

const makeSecret = (randomBytes?: () => Uint8Array): string =>
  base64UrlEncode((randomBytes ?? defaultRandomBytes)());

const makeKeyHash = async (displayKey: string): Promise<string> =>
  sha256Base64Url(displayKey);

const validateBrainScopes = (
  scopes: readonly string[],
): readonly HeadlessApiKeyScope[] => {
  const invalid = scopes.find(
    (scope) => scope !== "brain:read" && scope !== "brain:ask",
  );

  if (invalid) {
    raiseTagged(new ApiKeyScopeInvalid({ scope: invalid }));
  }

  return [...new Set(scopes)] as readonly HeadlessApiKeyScope[];
};

const validateExpiry = (
  nowMs: number,
  expiresAt: number | undefined,
): number => {
  if (expiresAt === undefined) {
    return raiseTagged(
      new ApiKeyExpiryInvalid({ reason: "API keys must expire." }),
    );
  }

  if (expiresAt <= nowMs || expiresAt - nowMs > MAX_EXPIRY_MS) {
    raiseTagged(
      new ApiKeyExpiryInvalid({
        reason: "API key expiry must be in the future and within 90 days.",
      }),
    );
  }

  return expiresAt;
};

const requireApiKeyAdmin = (actor: { readonly role: Role }): void => {
  if (!roleAtLeast(actor.role, "admin")) {
    raiseTagged(
      new Forbidden({ reason: "Only Brain admins may manage API keys." }),
    );
  }
};

export const createApiKey = async (
  input: ApiKeyCreateInput,
): Promise<ApiKeyCreateResult> => {
  const displayKey = `${LEGACY_KEY_PREFIX}${makeSecret(input.randomBytes)}`;
  const keyHash = await makeKeyHash(displayKey);
  const row: ApiKeyRow = {
    id: `api_key_${keyHash.slice(0, 16)}`,
    workspaceId: input.workspaceId,
    name: input.name,
    keyHash,
    displayPrefix: displayPrefixFor(displayKey),
    scopes: [...input.scopes],
    status: "active",
    createdByUserId: input.createdByUserId,
    createdAt: input.nowMs,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    lastUsedAt: null,
  };

  return { displayKey, row };
};

export const createBrainApiKey = async (
  input: BrainApiKeyCreateInput,
): Promise<BrainApiKeyCreateResult> => {
  requireApiKeyAdmin(input.actor);
  const expiresAt = validateExpiry(input.nowMs, input.expiresAt);
  const scopes = validateBrainScopes(input.scopes);
  const displayKey = `${HEADLESS_KEY_PREFIX}${makeSecret(input.randomBytes)}`;
  const keyHash = await makeKeyHash(displayKey);
  const principal: ServicePrincipalRow = {
    id: `service_principal_${keyHash.slice(0, 16)}`,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    brainKey: input.brainKey,
    roleCeiling: "viewer",
    status: "active",
    generation: 1,
    createdByUserId: input.actor.userId,
    createdAt: input.nowMs,
    revokedAt: null,
  };
  const key: BrainApiKeyCreateResult["key"] = {
    id: `api_key_${keyHash.slice(0, 16)}`,
    principalId: principal.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    brainKey: input.brainKey,
    name: input.name,
    keyHash,
    displayPrefix: displayPrefixFor(displayKey),
    scopes,
    roleCeiling: "viewer",
    status: "active",
    createdByUserId: input.actor.userId,
    createdAt: input.nowMs,
    expiresAt,
    revokedAt: null,
    lastUsedAt: null,
  };

  return { displayKey, key, principal };
};

export const parseBearerApiKey = (
  authorization: string | undefined,
): string | HeadlessAuthError => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const presentedKey = match?.[1]?.trim();

  if (!presentedKey) {
    return makeAuthError("API_KEY_MISSING", "Missing bearer API key.");
  }

  return presentedKey;
};

export const verifyApiKey = async (input: {
  readonly presentedKey: string;
  readonly rows?: readonly ApiKeyRow[];
  readonly keys?: readonly ApiKeyRow[];
  readonly principals?: readonly ServicePrincipalRow[];
  readonly nowMs: number;
  readonly requiredScope: ApiKeyScope;
  readonly brainKey?: string;
}): Promise<ApiKeyVerificationResult> => {
  const rows = input.rows ?? input.keys ?? [];
  const presentedHash = await makeKeyHash(input.presentedKey);
  const row = rows.find((candidate) =>
    constantTimeEqual(candidate.keyHash, presentedHash),
  );

  if (!row) {
    return {
      ok: false,
      error: makeAuthError("API_KEY_NOT_FOUND", "API key was not found."),
    };
  }

  if (row.status === "revoked" || row.revokedAt !== null) {
    return {
      ok: false,
      error: makeAuthError("API_KEY_REVOKED", "API key has been revoked."),
    };
  }

  if (row.expiresAt !== null && row.expiresAt <= input.nowMs) {
    return {
      ok: false,
      error: makeAuthError("API_KEY_EXPIRED", "API key has expired."),
    };
  }

  const principal = findPrincipal(row, input.principals ?? []);

  if (
    principal !== undefined &&
    (principal.status === "revoked" || principal.revokedAt !== null)
  ) {
    return {
      ok: false,
      error: makeAuthError(
        "SERVICE_PRINCIPAL_REVOKED",
        "Service principal has been revoked.",
      ),
    };
  }

  if (
    !row.scopes.includes(input.requiredScope) &&
    !row.scopes.includes("admin")
  ) {
    return forbidden();
  }

  if (input.brainKey !== undefined && row.brainKey !== input.brainKey) {
    return forbidden();
  }

  return {
    ok: true,
    ...(row.organizationId === undefined
      ? {}
      : { organizationId: row.organizationId }),
    workspaceId: row.workspaceId,
    ...(row.brainKey === undefined ? {} : { brainKey: row.brainKey }),
    ...(row.roleCeiling === undefined ? {} : { roleCeiling: row.roleCeiling }),
    keyId: row.id,
    ...(row.principalId === undefined ? {} : { principalId: row.principalId }),
    scopes: row.scopes,
  };
};

const findPrincipal = (
  key: ApiKeyRow,
  principals: readonly ServicePrincipalRow[],
): ServicePrincipalRow | undefined =>
  key.principalId === undefined
    ? undefined
    : principals.find((principal) => principal.id === key.principalId);

const forbidden = (): ApiKeyVerificationFailure => ({
  ok: false,
  error: makeAuthError(
    "API_KEY_FORBIDDEN",
    "API key does not include the required scope.",
  ),
});

export const listApiKeyMetadata = (
  keys: readonly ApiKeyRow[],
): readonly ApiKeyMetadata[] =>
  keys.filter(isBrainApiKey).map((key) => {
    const { keyHash, ...metadata } = key;
    void keyHash;
    return metadata;
  });

const isBrainApiKey = (
  key: ApiKeyRow,
): key is ApiKeyMetadata & {
  readonly keyHash: string;
} =>
  key.principalId !== undefined &&
  key.organizationId !== undefined &&
  key.brainKey !== undefined &&
  key.roleCeiling === "viewer" &&
  key.scopes.every((scope) => scope === "brain:read" || scope === "brain:ask");

export const revokeBrainApiKey = (input: {
  readonly key: ApiKeyRow;
  readonly actor: { readonly role: Role };
  readonly nowMs: number;
}): ApiKeyRow => {
  requireApiKeyAdmin(input.actor);

  if (input.key.status === "revoked" || input.key.revokedAt !== null) {
    raiseTagged(new ApiKeyRevoked({ keyId: input.key.id }));
  }

  return { ...input.key, status: "revoked", revokedAt: input.nowMs };
};

export const rotateBrainApiKey = async (input: {
  readonly key: ApiKeyRow;
  readonly principal: ServicePrincipalRow;
  readonly actor: { readonly userId: string; readonly role: Role };
  readonly nowMs: number;
  readonly expiresAt?: number;
  readonly randomBytes?: () => Uint8Array;
}): Promise<BrainApiKeyCreateResult & { readonly revokedKey: ApiKeyRow }> => {
  requireApiKeyAdmin(input.actor);

  if (input.key.status === "revoked" || input.key.revokedAt !== null) {
    raiseTagged(new ApiKeyRevoked({ keyId: input.key.id }));
  }

  const rotated = await createBrainApiKey({
    organizationId: input.principal.organizationId,
    workspaceId: input.principal.workspaceId,
    brainKey: input.principal.brainKey,
    name: input.key.name,
    scopes: input.key.scopes,
    actor: input.actor,
    nowMs: input.nowMs,
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    ...(input.randomBytes === undefined
      ? {}
      : { randomBytes: input.randomBytes }),
  });

  return {
    ...rotated,
    principal: {
      ...rotated.principal,
      id: input.principal.id,
      generation: input.principal.generation + 1,
    },
    revokedKey: { ...input.key, status: "revoked", revokedAt: input.nowMs },
  };
};
