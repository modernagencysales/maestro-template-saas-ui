import { describe, expect, it } from "vitest";

import { buildShellConfigurationFiles } from "./shell-configuration";

describe("product shell configuration generator", () => {
  it("binds product labels to the complete governed screen set", () => {
    const result = buildShellConfigurationFiles({
      dashboardLabel: "Connections",
      dashboardScreen: "connections",
      inboxLabel: "Agency Brain",
      inboxScreen: "brain",
      contactsLabel: "Clients",
      kanbanLabel: "Settings",
      kanbanRoute: "/$workspace/settings/account/profile",
      showcaseLabel: "Ask Maestro",
      showcaseRoute: "/$workspace/search",
    });

    expect(result.files[0]?.content).toContain('dashboard: "connections"');
    expect(result.files[0]?.content).toContain('inbox: "brain"');
    expect(result.files[0]?.content).toContain("Agency Brain");
    expect(result.files[1]?.content).toContain(
      "pro-story:packages/blocks/settings/integration-card/integration-card.stories.tsx",
    );
    expect(result.files[1]?.content).toContain(
      "starter-story:packages/ui/src/editor/editor.stories.tsx",
    );
  });

  it("rejects blank visible labels", () => {
    expect(() =>
      buildShellConfigurationFiles({
        dashboardLabel: " ",
        dashboardScreen: "reports",
        inboxLabel: "Inbox",
        inboxScreen: "contacts",
        contactsLabel: "Contacts",
        kanbanLabel: "Kanban",
        kanbanRoute: "/$workspace/kanban",
        showcaseLabel: "Showcase",
        showcaseRoute: "/$workspace/showcase",
      }),
    ).toThrow("requires --dashboard-label");
  });
});
