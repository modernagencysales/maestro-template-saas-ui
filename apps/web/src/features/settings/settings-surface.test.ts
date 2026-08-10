import { describe, expect, it } from "vitest";
import { templateRegistry } from "@maestro-template/template-core";
import { buildSettingsDocumentSections } from "./settings-surface";

const providerAdapterFixture = templateRegistry.providerAdapters;

const workspaceFixture = {
  workspaceId: "workspace_template",
  organizationId: "org_template",
  name: "Test workspace",
  slug: "test-workspace",
  role: "owner",
  status: "active",
} as const;

describe("settings surface", () => {
  it("renders a missing-workspace state before settings controls are enabled", () => {
    const sections = buildSettingsDocumentSections({
      workspace: null,
      viewer: { role: "owner" },
      providers: providerAdapterFixture,
    });

    expect(sections).toEqual([
      {
        heading: "Workspace setup required",
        body: [
          "Settings stay read-only until the app has a server-derived active workspace.",
          "Run provisioning before enabling member, provider, billing, or deploy controls.",
        ],
      },
    ]);
  });

  it("shows admin settings, provider posture, fake billing, and safe env copy", () => {
    const sections = buildSettingsDocumentSections({
      workspace: workspaceFixture,
      viewer: { role: "owner" },
      providers: providerAdapterFixture,
    });

    expect(sections.map((section) => section.heading)).toEqual([
      "Workspace",
      "Members",
      "Provider health",
      "Billing and credits",
      "Safe environment rendering",
    ]);
    expect(sections[0]?.body).toContain(
      "Admin controls are available for workspace setup and provider posture.",
    );
    expect(sections[3]?.body.join("\n")).toContain("Fake billing");
    expect(sections[4]?.body.join("\n")).toContain(
      "must never render secret values",
    );
  });

  it("hides member management language for non-admin settings viewers", () => {
    const sections = buildSettingsDocumentSections({
      workspace: workspaceFixture,
      viewer: { role: "viewer" },
      providers: providerAdapterFixture,
    });

    expect(sections[1]?.body).toEqual([
      "Member management is hidden for non-admin roles.",
    ]);
  });
});
