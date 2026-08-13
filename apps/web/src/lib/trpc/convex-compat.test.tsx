import { describe, expect, it } from "vitest";

import { assertRealAuthority, neutralPaths, realRefs } from "#lib/trpc/react";

describe("Convex starter query compatibility", () => {
  it("maps auth, workspace, and member paths to exact generated refs", () => {
    expect(realRefs["auth.me"]).toBeDefined();
    expect(realRefs["workspaces.bySlug"]).toBeDefined();
    expect(realRefs["workspaceMembers.list"]).toBeDefined();
  });

  it("does not silently treat unknown real authorities as empty data", () => {
    expect(() => assertRealAuthority("billing.account")).toThrow(
      /No Convex authority/,
    );
  });

  it("keeps Starter-only surfaces explicitly neutral", () => {
    expect(neutralPaths).toEqual(
      expect.arrayContaining([
        "contacts.listByType",
        "notifications.inbox",
        "billing.account",
        "search.all",
        "workspaceMembers.notificationSettings",
        "workspaceMembers.updateNotificationSettings",
        "workspaceMembers.invitation",
        "workspaceMembers.acceptInvitation",
        "users.subscribeToNewsletter",
        "users.updateProfile",
        "auth.listAccounts",
        "workspaces.create",
        "workspaces.slugAvailable",
        "workspaces.update",
        "tags.create",
        "tags.update",
        "tags.delete",
      ]),
    );
  });
});
