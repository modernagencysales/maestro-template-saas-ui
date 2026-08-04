import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  AccessAuditEventRow,
  InvitationRow,
  MembershipStatus,
  OrganizationMemberRow,
  OrganizationRow,
  UserRow,
  WorkspaceMemberRow,
} from "../confect/access/tenancySchemas";
import tenancyTables from "../confect/access/tenancyTables";

describe("tenancy table contracts", () => {
  it("exports the required tenancy tables", () => {
    expect(Object.keys(tenancyTables).sort()).toEqual([
      "accessAuditEvents",
      "invitations",
      "organizationMembers",
      "organizations",
      "users",
      "workspaceMembers",
    ]);
  });

  it("indexes users, organizations, memberships, and invitations", () => {
    expect(tenancyTables.users.indexes).toMatchObject({
      by_token_identifier: ["tokenIdentifier"],
      by_email: ["email"],
    });
    expect(tenancyTables.organizations.indexes).toMatchObject({
      by_slug: ["slug"],
      by_status: ["status"],
    });
    expect(tenancyTables.organizationMembers.indexes).toMatchObject({
      by_user: ["userId"],
      by_organization_user: ["organizationId", "userId"],
      by_organization_status: ["organizationId", "status"],
    });
    expect(tenancyTables.workspaceMembers.indexes).toMatchObject({
      by_workspace_user: ["workspaceId", "userId"],
      by_workspace_status: ["workspaceId", "status"],
      by_user: ["userId"],
    });
    expect(tenancyTables.invitations.indexes).toMatchObject({
      by_token: ["tokenHash"],
      by_email_status: ["email", "status"],
      by_workspace_status: ["workspaceId", "status"],
    });
    expect(tenancyTables.accessAuditEvents.indexes).toMatchObject({
      by_workspace_created: ["workspaceId", "createdAt"],
      by_subject: ["subjectKind", "subjectId"],
      by_workspace_action: ["workspaceId", "action"],
    });
  });

  it("validates lifecycle fields for tenancy rows", () => {
    expect(
      Schema.decodeUnknownSync(UserRow)({
        subject: "workos_user_123",
        tokenIdentifier: "https://issuer.example|workos_user_123",
        email: "person@example.com",
        displayName: "Person Example",
        status: "active",
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toMatchObject({ status: "active" });
    expect(
      Schema.decodeUnknownSync(OrganizationRow)({
        ownerUserId: "users_1",
        slug: "acme",
        name: "Acme",
        status: "active",
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toMatchObject({ slug: "acme" });
    expect(Schema.decodeUnknownSync(MembershipStatus)("revoked")).toBe(
      "revoked",
    );
  });

  it("requires accepted, revoked, deleted, or archived lifecycle timestamps where applicable", () => {
    expect(
      Schema.decodeUnknownSync(OrganizationMemberRow)({
        organizationId: "org_123",
        userId: "user_123",
        role: "admin",
        status: "active",
        acceptedAt: 1,
        revokedAt: null,
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toMatchObject({ acceptedAt: 1, revokedAt: null });
    expect(
      Schema.decodeUnknownSync(WorkspaceMemberRow)({
        workspaceId: "workspace_123",
        userId: "user_123",
        role: "editor",
        status: "revoked",
        acceptedAt: 1,
        revokedAt: 3,
        deletedAt: null,
        createdAt: 1,
        updatedAt: 3,
      }),
    ).toMatchObject({ revokedAt: 3, deletedAt: null });
    expect(
      Schema.decodeUnknownSync(InvitationRow)({
        workspaceId: "workspace_123",
        organizationId: "org_123",
        email: "person@example.com",
        role: "viewer",
        status: "pending",
        tokenHash: "hash_123",
        invitedByUserId: "user_owner",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: 10,
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toMatchObject({ status: "pending", acceptedAt: null });
    expect(
      Schema.decodeUnknownSync(AccessAuditEventRow)({
        workspaceId: "workspace_123",
        action: "member.roleChanged",
        actorUserId: "user_owner",
        subjectKind: "workspaceMember",
        subjectId: "workspaceMembers_123",
        metadataJson: '{"previousRole":"editor","nextRole":"admin"}',
        createdAt: 1,
      }),
    ).toMatchObject({
      action: "member.roleChanged",
      subjectKind: "workspaceMember",
    });
  });
});
