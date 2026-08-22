import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  buildProvisioningPlan,
  extractIdentityProfile,
  requireInsertValue,
  selectLiveOwnedOrganization,
  selectLiveOwnedWorkspace,
  type ProvisioningState,
} from "../confect/access/provisioning";
import {
  ProvisioningConflict,
  Unauthorized,
  ValidationFailed,
} from "../confect/errors";

const now = 1_782_924_800_000;

const emptyState: ProvisioningState = {
  user: null,
  liveOrganization: null,
  liveWorkspace: null,
  organizationMembership: null,
  workspaceMembership: null,
};

describe("access provisioning", () => {
  it("extracts a verified identity profile from provider identity claims", () => {
    const profile = Effect.runSync(
      extractIdentityProfile({
        subject: "workos|user_12345678",
        name: "Ada Lovelace",
        email: " ADA@Example.COM ",
        emailVerified: true,
      }),
    );

    expect(profile).toEqual({
      subject: "workos|user_12345678",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  it("rejects missing identity before any row planning occurs", () => {
    const error = Effect.runSync(Effect.flip(extractIdentityProfile(null)));

    expect(error).toBeInstanceOf(Unauthorized);
  });

  it("rejects unverified or malformed email claims", () => {
    const malformed = Effect.runSync(
      Effect.flip(
        extractIdentityProfile({
          subject: "workos|user_12345678",
          name: "Ada",
          email: "not-an-email",
          emailVerified: true,
        }),
      ),
    );

    const unverified = Effect.runSync(
      Effect.flip(
        extractIdentityProfile({
          subject: "workos|user_12345678",
          name: "Ada",
          email: "ada@example.com",
          emailVerified: false,
        }),
      ),
    );

    expect(malformed).toBeInstanceOf(ValidationFailed);
    expect(unverified).toBeInstanceOf(ValidationFailed);
  });

  it("plans first sign-in rows for user, organization, workspace, and owner memberships", () => {
    const result = buildProvisioningPlan({
      identity: {
        subject: "workos|user_12345678",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
      },
      state: emptyState,
      now,
    });

    expect(Result.isSuccess(result)).toBe(true);
    const plan = Result.getOrThrow(result);

    expect(plan).toMatchObject({
      user: {
        action: "insert",
        value: {
          subject: "workos|user_12345678",
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      },
      organization: {
        action: "insert",
        value: {
          ownerUserId: "{userId}",
          slug: "ada-lovelace-12345678",
          name: "Ada Lovelace",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      },
      workspace: {
        action: "insert",
        value: {
          slug: "ada-lovelace-12345678",
          name: "Ada Lovelace Workspace",
          status: "active",
          dataClassification: "internal",
          createdAt: now,
          updatedAt: now,
        },
      },
      organizationMembership: {
        action: "insert",
        value: {
          role: "owner",
          status: "active",
          acceptedAt: now,
          revokedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      workspaceMembership: {
        action: "insert",
        value: {
          role: "owner",
          status: "active",
          acceptedAt: now,
          revokedAt: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
  });

  it("is idempotent for an already provisioned active owner", () => {
    const result = buildProvisioningPlan({
      identity: {
        subject: "workos|user_12345678",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
      },
      state: {
        user: {
          _id: "users_1",
          subject: "workos|user_12345678",
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          status: "active",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        liveOrganization: {
          _id: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-lovelace-12345678",
          name: "Ada Lovelace",
          status: "active",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        liveWorkspace: {
          _id: "workspaces_1",
          organizationId: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-lovelace-12345678",
          name: "Ada Lovelace Workspace",
          status: "active",
          dataClassification: "internal",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        organizationMembership: {
          _id: "organizationMembers_1",
          organizationId: "organizations_1",
          userId: "users_1",
          role: "owner",
          status: "active",
          acceptedAt: now - 100,
          revokedAt: null,
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        workspaceMembership: {
          _id: "workspaceMembers_1",
          workspaceId: "workspaces_1",
          userId: "users_1",
          role: "owner",
          status: "active",
          acceptedAt: now - 100,
          revokedAt: null,
          deletedAt: null,
          createdAt: now - 100,
          updatedAt: now - 100,
        },
      },
      now,
    });

    expect(Result.isSuccess(result)).toBe(true);
    const plan = Result.getOrThrow(result);

    expect(plan.user.action).toBe("none");
    expect(plan.organization.action).toBe("none");
    expect(plan.workspace.action).toBe("none");
    expect(plan.organizationMembership.action).toBe("none");
    expect(plan.workspaceMembership.action).toBe("none");
  });

  it("self-heals changed email and revoked owner memberships without duplicating rows", () => {
    const result = buildProvisioningPlan({
      identity: {
        subject: "workos|user_12345678",
        displayName: "Ada Lovelace",
        email: "new@example.com",
      },
      state: {
        user: {
          _id: "users_1",
          subject: "workos|user_12345678",
          email: "old@example.com",
          displayName: "Ada Lovelace",
          status: "active",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        liveOrganization: {
          _id: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-lovelace-12345678",
          name: "Ada Lovelace",
          status: "active",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        liveWorkspace: {
          _id: "workspaces_1",
          organizationId: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-lovelace-12345678",
          name: "Ada Lovelace Workspace",
          status: "active",
          dataClassification: "internal",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
        organizationMembership: {
          _id: "organizationMembers_1",
          organizationId: "organizations_1",
          userId: "users_1",
          role: "viewer",
          status: "revoked",
          acceptedAt: null,
          revokedAt: now - 50,
          createdAt: now - 100,
          updatedAt: now - 50,
        },
        workspaceMembership: {
          _id: "workspaceMembers_1",
          workspaceId: "workspaces_1",
          userId: "users_1",
          role: "editor",
          status: "revoked",
          acceptedAt: null,
          revokedAt: now - 50,
          deletedAt: null,
          createdAt: now - 100,
          updatedAt: now - 50,
        },
      },
      now,
    });

    expect(Result.isSuccess(result)).toBe(true);
    const plan = Result.getOrThrow(result);

    expect(plan.user).toMatchObject({
      action: "patch",
      id: "users_1",
      value: { email: "new@example.com", updatedAt: now },
    });
    expect(plan.organizationMembership).toMatchObject({
      action: "patch",
      id: "organizationMembers_1",
      value: {
        role: "owner",
        status: "active",
        acceptedAt: now,
        revokedAt: null,
        updatedAt: now,
      },
    });
    expect(plan.workspaceMembership).toMatchObject({
      action: "patch",
      id: "workspaceMembers_1",
      value: {
        role: "owner",
        status: "active",
        acceptedAt: now,
        revokedAt: null,
        deletedAt: null,
        updatedAt: now,
      },
    });
  });

  it("refuses to provision suspended or deleted users", () => {
    const result = buildProvisioningPlan({
      identity: {
        subject: "workos|user_12345678",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
      },
      state: {
        ...emptyState,
        user: {
          _id: "users_1",
          subject: "workos|user_12345678",
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          status: "suspended",
          createdAt: now - 100,
          updatedAt: now - 100,
        },
      },
      now,
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(Unauthorized);
    }
  });

  it("fails closed when duplicate live owned organizations or workspaces exist", () => {
    const organizationResult = selectLiveOwnedOrganization(
      [
        {
          _id: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-one",
          name: "Ada One",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: "organizations_2",
          ownerUserId: "users_1",
          slug: "ada-two",
          name: "Ada Two",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      "users_1",
    );

    expect(Result.isFailure(organizationResult)).toBe(true);
    if (Result.isFailure(organizationResult)) {
      expect(organizationResult.failure).toBeInstanceOf(ProvisioningConflict);
    }

    const workspaceResult = selectLiveOwnedWorkspace(
      [
        {
          _id: "workspaces_1",
          organizationId: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-one",
          name: "Ada One",
          status: "active",
          dataClassification: "internal",
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: "workspaces_2",
          organizationId: "organizations_1",
          ownerUserId: "users_1",
          slug: "ada-two",
          name: "Ada Two",
          status: "active",
          dataClassification: "internal",
          createdAt: now,
          updatedAt: now,
        },
      ],
      "users_1",
    );

    expect(Result.isFailure(workspaceResult)).toBe(true);
    if (Result.isFailure(workspaceResult)) {
      expect(workspaceResult.failure).toBeInstanceOf(ProvisioningConflict);
    }
  });
});

describe("requireInsertValue", () => {
  it("returns the value of an insert plan", () => {
    const value = { name: "acme" };
    expect(requireInsertValue({ action: "insert", value }, "workspace")).toBe(
      value,
    );
  });

  it("throws a plain Error (an intentional defect) on a non-insert plan", () => {
    // The caller already proved the row is absent, so a patch/none plan here is
    // an internal invariant violation, not a client-facing failure.
    expect(() =>
      requireInsertValue({ action: "none" }, "organization"),
    ).toThrow(/Expected organization provisioning insert plan/);
    expect(() => requireInsertValue({ action: "patch" }, "workspace")).toThrow(
      /Expected workspace provisioning insert plan/,
    );
  });
});
