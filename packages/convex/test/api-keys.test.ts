import { describe, expect, it } from "vitest";

import {
  createBrainApiKey,
  listApiKeyMetadata,
  rotateBrainApiKey,
  revokeBrainApiKey,
  verifyApiKey,
} from "../confect/headless/auth";
import apiKeys from "../confect/tables/apiKeys";
import servicePrincipals from "../confect/tables/servicePrincipals";

const adminActor = {
  userId: "user_admin",
  role: "admin",
} as const;

const baseInput = {
  organizationId: "org_acme",
  workspaceId: "workspace_acme",
  brainKey: "brain_client_alpha",
  name: "Client Alpha read key",
  scopes: ["brain:read"],
  actor: adminActor,
  nowMs: 1_000,
  expiresAt: 2_000,
  randomBytes: () => new Uint8Array(32).fill(3),
} as const;

describe("one-Brain API key CRUD", () => {
  it("mints display-once one-Brain keys and stores only hash/prefix metadata", async () => {
    const created = await createBrainApiKey(baseInput);

    expect(created.displayKey).toMatch(/^mbk_live_/);
    expect(created.key).toMatchObject({
      organizationId: "org_acme",
      workspaceId: "workspace_acme",
      brainKey: "brain_client_alpha",
      name: "Client Alpha read key",
      scopes: ["brain:read"],
      roleCeiling: "viewer",
      status: "active",
      createdByUserId: "user_admin",
      expiresAt: 2_000,
      revokedAt: null,
    });
    expect(created.principal).toMatchObject({
      organizationId: "org_acme",
      workspaceId: "workspace_acme",
      brainKey: "brain_client_alpha",
      roleCeiling: "viewer",
      status: "active",
      generation: 1,
      createdByUserId: "user_admin",
    });
    expect(JSON.stringify(created.key)).not.toContain(created.displayKey);
    expect(JSON.stringify(created.principal)).not.toContain(created.displayKey);
    expect(listApiKeyMetadata([created.key])).toEqual([
      {
        id: created.key.id,
        principalId: created.principal.id,
        organizationId: "org_acme",
        workspaceId: "workspace_acme",
        brainKey: "brain_client_alpha",
        name: "Client Alpha read key",
        displayPrefix: created.key.displayPrefix,
        scopes: ["brain:read"],
        roleCeiling: "viewer",
        status: "active",
        createdByUserId: "user_admin",
        createdAt: 1_000,
        expiresAt: 2_000,
        revokedAt: null,
        lastUsedAt: null,
      },
    ]);
  });

  it("rejects non-admin creators, invalid scopes, no expiry, and overlong expiry", async () => {
    await expect(
      createBrainApiKey({
        ...baseInput,
        actor: { userId: "user_viewer", role: "viewer" },
      }),
    ).rejects.toMatchObject({ _tag: "Forbidden" });

    await expect(
      createBrainApiKey({ ...baseInput, scopes: ["brain:read", "admin"] }),
    ).rejects.toMatchObject({ _tag: "ApiKeyScopeInvalid" });

    await expect(
      createBrainApiKey({
        organizationId: baseInput.organizationId,
        workspaceId: baseInput.workspaceId,
        brainKey: baseInput.brainKey,
        name: baseInput.name,
        scopes: baseInput.scopes,
        actor: baseInput.actor,
        nowMs: baseInput.nowMs,
        randomBytes: baseInput.randomBytes,
      }),
    ).rejects.toMatchObject({ _tag: "ApiKeyExpiryInvalid" });

    await expect(
      createBrainApiKey({
        ...baseInput,
        expiresAt: baseInput.nowMs + 91 * 24 * 60 * 60 * 1_000,
      }),
    ).rejects.toMatchObject({ _tag: "ApiKeyExpiryInvalid" });
  });

  it("verifies scope, Brain, expiry, key revocation, and principal revocation", async () => {
    const created = await createBrainApiKey(baseInput);

    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        keys: [created.key],
        principals: [created.principal],
        nowMs: 1_500,
        requiredScope: "brain:read",
        brainKey: "brain_client_alpha",
      }),
    ).resolves.toMatchObject({
      ok: true,
      organizationId: "org_acme",
      workspaceId: "workspace_acme",
      brainKey: "brain_client_alpha",
      roleCeiling: "viewer",
    });

    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        keys: [created.key],
        principals: [created.principal],
        nowMs: 1_500,
        requiredScope: "brain:ask",
        brainKey: "brain_client_alpha",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_FORBIDDEN" },
    });

    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        keys: [created.key],
        principals: [created.principal],
        nowMs: 1_500,
        requiredScope: "brain:read",
        brainKey: "brain_other",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_FORBIDDEN" },
    });

    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        keys: [{ ...created.key, status: "revoked", revokedAt: 1_400 }],
        principals: [created.principal],
        nowMs: 1_500,
        requiredScope: "brain:read",
        brainKey: "brain_client_alpha",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "API_KEY_REVOKED" } });

    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        keys: [created.key],
        principals: [
          { ...created.principal, status: "revoked", revokedAt: 1_400 },
        ],
        nowMs: 1_500,
        requiredScope: "brain:read",
        brainKey: "brain_client_alpha",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SERVICE_PRINCIPAL_REVOKED" },
    });

    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        keys: [created.key],
        principals: [created.principal],
        nowMs: 2_000,
        requiredScope: "brain:read",
        brainKey: "brain_client_alpha",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "API_KEY_EXPIRED" } });
  });

  it("revokes and rotates keys without reusing the old secret", async () => {
    const created = await createBrainApiKey(baseInput);
    const revoked = revokeBrainApiKey({
      key: created.key,
      actor: adminActor,
      nowMs: 1_200,
    });
    const rotated = await rotateBrainApiKey({
      key: created.key,
      principal: created.principal,
      actor: adminActor,
      nowMs: 1_300,
      expiresAt: 2_300,
      randomBytes: () => new Uint8Array(32).fill(4),
    });

    expect(revoked.status).toBe("revoked");
    expect(rotated.revokedKey.status).toBe("revoked");
    expect(rotated.key.id).not.toBe(created.key.id);
    expect(rotated.displayKey).not.toBe(created.displayKey);
    expect(rotated.principal.generation).toBe(2);

    await expect(
      rotateBrainApiKey({
        key: revoked,
        principal: created.principal,
        actor: adminActor,
        nowMs: 1_400,
        expiresAt: 2_400,
      }),
    ).rejects.toMatchObject({ _tag: "ApiKeyRevoked" });
  });

  it("declares service-principal and one-Brain API-key table indexes", () => {
    expect(apiKeys.indexes).toMatchObject({
      by_key_hash: ["keyHash"],
      by_principal: ["principalId"],
      by_brain_status: ["workspaceId", "brainKey", "status"],
    });
    expect(servicePrincipals.indexes).toMatchObject({
      by_brain_status: ["workspaceId", "brainKey", "status"],
      by_workspace: ["workspaceId"],
      by_created_by: ["createdByUserId"],
    });
  });
});
