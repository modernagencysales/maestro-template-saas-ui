import { describe, expect, it } from "vitest";
import apiKeys from "../confect/tables/apiKeys";
import {
  createApiKey,
  authenticateApiKey,
  HeadlessAuthError,
  parseBearerApiKey,
  verifyApiKey,
} from "../confect/headless/auth";
import { createHeadlessErrorEnvelope } from "../confect/headless/errorEnvelope";

describe("headless API-key auth", () => {
  it("creates display-once API keys and stores only a hash", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read", "workflow:run"],
      principalKind: "apiKey",
      principalId: expect.stringMatching(/^api_key_/),
      createdByUserId: "user_123",
      nowMs: 1_000,
      randomBytes: () => new Uint8Array(32).fill(7),
    });

    expect(created.displayKey).toMatch(/^mtk_live_/);
    expect(created.row).toMatchObject({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      displayPrefix: expect.stringMatching(/^mtk_live_/),
      scopes: ["workspace:read", "workflow:run"],
      status: "active",
      createdByUserId: "user_123",
      createdAt: 1_000,
      revokedAt: null,
    });
    expect(created.row.keyHash).not.toBe(created.displayKey);
    expect(JSON.stringify(created.row)).not.toContain(created.displayKey);
  });

  it("parses bearer headers without accepting other auth schemes", () => {
    expect(parseBearerApiKey("Bearer mtk_live_example")).toBe(
      "mtk_live_example",
    );
    expect(parseBearerApiKey("bearer mtk_live_example")).toBe(
      "mtk_live_example",
    );
    expect(parseBearerApiKey("Basic secret")).toBeInstanceOf(HeadlessAuthError);
    expect(parseBearerApiKey(undefined)).toBeInstanceOf(HeadlessAuthError);
  });

  it("looks up bearer keys by hash and injects workspace scope", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read", "workflow:run"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      randomBytes: () => new Uint8Array(32).fill(9),
    });

    const result = await verifyApiKey({
      presentedKey: created.displayKey,
      rows: [created.row],
      nowMs: 2_000,
      requiredScope: "workflow:run",
    });

    expect(result).toEqual({
      ok: true,
      workspaceId: "workspace_123",
      keyId: created.row.id,
      scopes: ["workspace:read", "workflow:run"],
    });
  });

  it("derives the complete API-key principal from the hashed stored row", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      randomBytes: () => new Uint8Array(32).fill(10),
    });

    await expect(
      authenticateApiKey({
        authorization: `Bearer ${created.displayKey}`,
        policy: {
          id: "auth_api_key_workspace_read",
          credential: "api-key",
          principalKind: "apiKey",
          tenantAuthority: "principal-workspace",
          requiredScopes: ["workspace:read"],
        },
        nowMs: 2_000,
        loadByHash: async (hash) =>
          hash === created.row.keyHash ? created.row : null,
      }),
    ).resolves.toMatchObject({
      kind: "apiKey",
      apiKeyId: created.row.id,
      workspaceId: "workspace_123",
      scopes: ["workspace:read"],
      surface: "api",
    });
  });

  it("denies revoked, expired, missing, and under-scoped keys", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      expiresAt: 3_000,
      randomBytes: () => new Uint8Array(32).fill(11),
    });

    await expect(
      verifyApiKey({
        presentedKey: "mtk_live_missing",
        rows: [created.row],
        nowMs: 2_000,
        requiredScope: "workspace:read",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_NOT_FOUND" },
    });
    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        rows: [{ ...created.row, status: "revoked", revokedAt: 2_000 }],
        nowMs: 2_000,
        requiredScope: "workspace:read",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_REVOKED" },
    });
    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        rows: [created.row],
        nowMs: 4_000,
        requiredScope: "workspace:read",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_EXPIRED" },
    });
    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        rows: [created.row],
        nowMs: 2_000,
        requiredScope: "workflow:run",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_FORBIDDEN" },
    });
  });

  it("returns opaque public error envelopes for headless surfaces", () => {
    const envelope = createHeadlessErrorEnvelope(
      new Error("raw provider payload secret"),
      "req_123",
    );

    expect(envelope).toEqual({
      ok: false,
      requestId: "req_123",
      error: {
        code: "INTERNAL",
        message: "Unexpected internal error.",
      },
    });
    expect(JSON.stringify(envelope)).not.toContain("secret");
  });

  it("declares the apiKeys Confect table indexes", () => {
    expect(apiKeys.indexes).toMatchObject({
      by_key_hash: ["keyHash"],
      by_workspace: ["workspaceId"],
      by_workspace_status: ["workspaceId", "status"],
    });
  });
});
