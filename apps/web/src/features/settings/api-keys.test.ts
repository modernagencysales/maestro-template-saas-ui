import { describe, expect, it } from "vitest";

import { buildApiKeySettingsSections } from "./api-keys";

const workspace = {
  workspaceId: "workspace_acme",
  organizationId: "org_acme",
  name: "Acme Demo",
  slug: "acme-demo",
  role: "owner",
  status: "active",
} as const;

const apiKey = {
  id: "api_key_123",
  principalId: "sp_123",
  organizationId: "org_acme",
  workspaceId: "workspace_acme",
  brainKey: "brain_client_alpha",
  name: "Client Alpha read key",
  displayPrefix: "mbk_live_abcd",
  scopes: ["brain:read", "brain:ask"],
  roleCeiling: "viewer",
  status: "active",
  createdByUserId: "user_admin",
  createdAt: 1_000,
  expiresAt: 2_000,
  revokedAt: null,
  lastUsedAt: null,
} as const;

describe("settings API key surface", () => {
  it("stays read-only without a server-derived workspace", () => {
    expect(
      buildApiKeySettingsSections({
        workspace: null,
        viewer: { role: "owner" },
        keys: [],
      }),
    ).toEqual([
      {
        heading: "API keys unavailable",
        body: [
          "API keys require a server-derived active workspace and Brain scope.",
        ],
      },
    ]);
  });

  it("shows one-Brain read-only key metadata without displaying secrets", () => {
    const sections = buildApiKeySettingsSections({
      workspace,
      viewer: { role: "admin" },
      keys: [apiKey],
    });

    expect(sections.map((section) => section.heading)).toEqual([
      "Brain API keys",
      "Client Alpha read key",
    ]);
    expect(sections[0]?.body.join("\n")).toContain(
      "Admins can create expiring, viewer-ceiling keys for one Brain.",
    );
    expect(sections[1]?.body).toContain("Brain: brain_client_alpha");
    expect(sections[1]?.body).toContain("Scopes: brain:read, brain:ask");
    expect(JSON.stringify(sections)).not.toContain("secret");
    expect(JSON.stringify(sections)).not.toContain("keyHash");
  });

  it("hides create and rotation language from non-admin viewers", () => {
    const sections = buildApiKeySettingsSections({
      workspace,
      viewer: { role: "viewer" },
      keys: [apiKey],
    });

    expect(sections[0]?.body).toContain(
      "API key creation, rotation, and revocation are hidden for non-admin roles.",
    );
  });
});
