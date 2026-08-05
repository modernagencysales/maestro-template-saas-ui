import * as Schema from "effect/Schema";

import {
  base64UrlEncode,
  constantTimeEqual,
  sha256Base64Url,
} from "../shared/tokenCrypto";

export const ApiKeyScope = Schema.Literals([
  "workspace:read",
  "workspace:write",
  "capability:run",
  "workflow:run",
  "admin",
]);

export type ApiKeyScope = Schema.Schema.Type<typeof ApiKeyScope>;

export const ApiKeyStatus = Schema.Literals(["active", "revoked"]);

export type ApiKeyStatus = Schema.Schema.Type<typeof ApiKeyStatus>;

export const NullableNumber = Schema.NullOr(Schema.Number);

export const ApiKeyRow = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  name: Schema.String,
  keyHash: Schema.String,
  displayPrefix: Schema.String,
  scopes: Schema.Array(ApiKeyScope),
  status: ApiKeyStatus,
  createdByUserId: Schema.String,
  createdAt: Schema.Number,
  expiresAt: NullableNumber,
  revokedAt: NullableNumber,
  lastUsedAt: NullableNumber,
});

export type ApiKeyRow = Schema.Schema.Type<typeof ApiKeyRow>;

export type ApiKeyCreateInput = {
  readonly workspaceId: string;
  readonly name: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly createdByUserId: string;
  readonly nowMs: number;
  readonly expiresAt?: number;
  readonly randomBytes?: () => Uint8Array;
};

export type ApiKeyCreateResult = {
  readonly displayKey: string;
  readonly row: ApiKeyRow;
};

export type ApiKeyVerificationSuccess = {
  readonly ok: true;
  readonly workspaceId: string;
  readonly keyId: string;
  readonly scopes: readonly ApiKeyScope[];
};

export type HeadlessAuthErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_NOT_FOUND"
  | "API_KEY_REVOKED"
  | "API_KEY_EXPIRED"
  | "API_KEY_FORBIDDEN";

export class HeadlessAuthError extends Schema.TaggedErrorClass<HeadlessAuthError>()(
  "HeadlessAuthError",
  {
    code: Schema.Literals([
      "API_KEY_MISSING",
      "API_KEY_NOT_FOUND",
      "API_KEY_REVOKED",
      "API_KEY_EXPIRED",
      "API_KEY_FORBIDDEN",
    ]),
    message: Schema.String,
  },
) {}

export type ApiKeyVerificationFailure = {
  readonly ok: false;
  readonly error: HeadlessAuthError;
};

export type ApiKeyVerificationResult =
  ApiKeyVerificationSuccess | ApiKeyVerificationFailure;

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

export const createApiKey = async (
  input: ApiKeyCreateInput,
): Promise<ApiKeyCreateResult> => {
  const secret = base64UrlEncode((input.randomBytes ?? defaultRandomBytes)());
  const displayKey = `mtk_live_${secret}`;
  const keyHash = await sha256Base64Url(displayKey);
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
  readonly rows: readonly ApiKeyRow[];
  readonly nowMs: number;
  readonly requiredScope: ApiKeyScope;
}): Promise<ApiKeyVerificationResult> =>
  verifyApiKeyHash({
    ...input,
    presentedHash: await sha256Base64Url(input.presentedKey),
  });

export const verifyApiKeyHash = async (input: {
  readonly presentedHash: string;
  readonly rows: readonly ApiKeyRow[];
  readonly nowMs: number;
  readonly requiredScope: ApiKeyScope;
}): Promise<ApiKeyVerificationResult> => {
  const row = input.rows.find((candidate) =>
    constantTimeEqual(candidate.keyHash, input.presentedHash),
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

  if (
    !row.scopes.includes(input.requiredScope) &&
    !row.scopes.includes("admin")
  ) {
    return {
      ok: false,
      error: makeAuthError(
        "API_KEY_FORBIDDEN",
        "API key does not include the required scope.",
      ),
    };
  }

  return {
    ok: true,
    workspaceId: row.workspaceId,
    keyId: row.id,
    scopes: row.scopes,
  };
};
