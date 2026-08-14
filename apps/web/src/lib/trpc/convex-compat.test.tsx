import { describe, expect, it } from "vitest";
import { getFunctionName } from "convex/server";

import {
  assertRealAuthority,
  createCompatibilityApi,
  neutralMutationValue,
  neutralPaths,
  realRefs,
} from "#lib/trpc/react";

describe("Convex starter query compatibility", () => {
  it("uses the router's authenticated Convex client for loader queries", async () => {
    const calls: unknown[] = [];
    const compatibility = createCompatibilityApi({
      query: async (...args: unknown[]) => {
        calls.push(args);
        return { id: "user_1", workspaces: [] };
      },
    } as never);

    await expect(compatibility.auth.me.ensureData()).resolves.toEqual({
      id: "user_1",
      workspaces: [],
    });
    expect(calls).toHaveLength(1);
  });

  it("maps auth, workspace, and member paths to exact generated refs", () => {
    expect(getFunctionName(realRefs["auth.me"])).toBe("auth/workspaces:me");
    expect(getFunctionName(realRefs["workspaces.bySlug"])).toBe(
      "auth/workspaces:bySlug",
    );
    expect(getFunctionName(realRefs["workspaceMembers.list"])).toBe(
      "access/members:list",
    );
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

  it("makes neutral member mutations deterministic no-ops", () => {
    expect(neutralMutationValue("workspaceMembers.invite")).toBeNull();
    expect(neutralMutationValue("workspaceMembers.removeMember")).toBeNull();
    expect(neutralMutationValue("workspaceMembers.updateRoles")).toBeNull();
  });

  it("returns the Starter inbox collection shape when notifications are neutral", () => {
    const compatibility = createCompatibilityApi();

    expect(compatibility.notifications.inbox.useQuery().data).toEqual({
      notifications: [],
    });
  });
});
