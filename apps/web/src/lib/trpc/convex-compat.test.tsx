import { afterEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";

import {
  assertRealAuthority,
  createCompatibilityApi,
  neutralMutationValue,
  neutralPaths,
  realRefs,
} from "#lib/trpc/react";

describe("Convex starter query compatibility", () => {
  afterEach(() => vi.unstubAllEnvs());

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

  it("uses local shell fixtures in the isolated contracts runtime", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_MAESTRO_CONTRACT_MODE", "1");
    const query = vi.fn(() => {
      throw new Error("authenticated Convex query must not run");
    });
    const compatibility = createCompatibilityApi({ query } as never);

    await expect(
      compatibility.workspaces.bySlug.ensureData({ slug: "contracts-primary" }),
    ).resolves.toMatchObject({
      slug: "contracts-primary",
      name: "Contracts workspace",
      tags: [],
      members: [],
      subscription: {
        accountId: null,
        planId: "free",
        status: "active",
      },
    });
    await expect(compatibility.auth.me.ensureData()).resolves.toMatchObject({
      id: "contracts-runtime",
      workspaces: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("normalizes the narrow Convex workspace into the Starter screen contract", async () => {
    const compatibility = createCompatibilityApi({
      query: async () => ({
        id: "workspace_1",
        slug: "acme",
        name: "Acme",
        logo: null,
      }),
    } as never);

    await expect(
      compatibility.workspaces.bySlug.ensureData({ slug: "acme" }),
    ).resolves.toMatchObject({
      id: "workspace_1",
      slug: "acme",
      tags: [],
      members: [],
      subscription: {
        accountId: null,
        planId: "free",
        status: "active",
      },
    });
  });

  it("keeps isolated shell fixture identities stable across renders", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_MAESTRO_CONTRACT_MODE", "1");
    const compatibility = createCompatibilityApi();

    const firstUser = await compatibility.auth.me.ensureData();
    const firstWorkspace = await compatibility.workspaces.bySlug.ensureData({
      slug: "contracts-primary",
    });

    await expect(compatibility.auth.me.ensureData()).resolves.toBe(firstUser);
    await expect(
      compatibility.workspaces.bySlug.ensureData({
        slug: "contracts-primary",
      }),
    ).resolves.toBe(firstWorkspace);
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

  it("returns screen-safe results for stateful neutral mutations", () => {
    expect(
      neutralMutationValue("workspaces.slugAvailable", { slug: "acme" }),
    ).toEqual({ available: true });
    expect(
      neutralMutationValue("contacts.create", {
        id: "contact_1",
        workspaceId: "workspace_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        type: "lead",
      }),
    ).toMatchObject({
      id: "contact_1",
      workspaceId: "workspace_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      type: "lead",
      status: "new",
    });
    expect(neutralMutationValue("billing.createCheckoutSession")).toEqual({
      url: "#",
    });
  });

  it("exposes the Starter namespace invalidation seam", async () => {
    const compatibility = createCompatibilityApi();
    await expect(
      compatibility.useUtils().workspaces.invalidate(),
    ).resolves.toBeUndefined();
  });

  it("returns the Starter inbox collection shape when notifications are neutral", () => {
    const compatibility = createCompatibilityApi();

    expect(compatibility.notifications.inbox.useQuery().data).toEqual({
      notifications: [],
    });
  });

  it("returns exact empty collection objects for neutral contact screens", () => {
    const compatibility = createCompatibilityApi();

    expect(compatibility.contacts.listByType.useQuery().data).toEqual({
      contacts: [],
    });
    expect(compatibility.contacts.activitiesById.useQuery().data).toEqual({
      activities: [],
    });
  });

  it("returns complete neutral notification settings", () => {
    const compatibility = createCompatibilityApi();

    expect(
      compatibility.workspaceMembers.notificationSettings.useQuery().data,
    ).toEqual({ channels: {}, topics: {}, newsletters: {} });
  });
});
