import { describe, expect, it } from "vitest";
import * as Result from "effect/Result";

import { accessAuditEventInsert } from "../confect/access/audit";
import {
  acceptInvitation,
  buildInvitationCreatedEvent,
  buildWorkspaceInvitation,
  cancelInvitation,
  changeMemberRole,
  declineInvitation,
  removeMember,
  transferOwnership,
  type InvitationRef,
  type WorkspaceMemberLifecycleRef,
} from "../confect/access/lifecycle";
import {
  Forbidden,
  InvitationExpired,
  InvitationNotAccessible,
  InvitationNotPending,
  LastOwnerProtected,
  MemberNotInWorkspace,
  MembershipNotLive,
} from "../confect/errors";

const now = 1_782_924_800_000;

const member = (
  overrides: Partial<WorkspaceMemberLifecycleRef>,
): WorkspaceMemberLifecycleRef => ({
  id: "workspaceMembers_1",
  workspaceId: "workspaces_1",
  userId: "users_1",
  role: "editor",
  status: "active",
  acceptedAt: now - 100,
  revokedAt: null,
  deletedAt: null,
  ...overrides,
});

const invitation = (overrides: Partial<InvitationRef>): InvitationRef => ({
  id: "invitations_1",
  workspaceId: "workspaces_1",
  organizationId: "organizations_1",
  email: "ada@example.com",
  role: "editor",
  status: "pending",
  tokenHash: "token_hash",
  invitedByUserId: "users_inviter",
  acceptedAt: null,
  revokedAt: null,
  declinedAt: null,
  expiresAt: now + 10_000,
  createdAt: now - 100,
  updatedAt: now - 100,
  ...overrides,
});

describe("workspace member lifecycle policy", () => {
  it("projects lifecycle events into durable audit rows", () => {
    expect(
      accessAuditEventInsert(
        {
          action: "member.roleChanged",
          workspaceId: "workspaces_1",
          actorUserId: "users_owner",
          subjectKind: "workspaceMember",
          subjectId: "workspaceMembers_2",
          metadata: { previousRole: "editor", nextRole: "admin" },
        },
        now,
      ),
    ).toEqual({
      workspaceId: "workspaces_1",
      action: "member.roleChanged",
      actorUserId: "users_owner",
      subjectKind: "workspaceMember",
      subjectId: "workspaceMembers_2",
      metadataJson: '{"previousRole":"editor","nextRole":"admin"}',
      createdAt: now,
    });

    expect(
      accessAuditEventInsert(
        {
          action: "invitation.declined",
          workspaceId: "workspaces_1",
          actorEmail: "ada@example.com",
          subjectKind: "invitation",
          subjectId: "invitations_1",
          metadata: { reason: "declined" },
        },
        now,
      ),
    ).toMatchObject({
      actorEmail: "ada@example.com",
      metadataJson: '{"reason":"declined"}',
    });
  });

  it("changes a member role when the actor can manage the target and grant the new role", () => {
    const either = changeMemberRole({
      actorUserId: "users_owner",
      actorRole: "owner",
      workspaceId: "workspaces_1",
      target: member({ id: "workspaceMembers_2", role: "editor" }),
      liveWorkspaceMembers: [
        member({
          id: "workspaceMembers_owner",
          userId: "users_owner",
          role: "owner",
        }),
        member({ id: "workspaceMembers_2", role: "editor" }),
      ],
      newRole: "admin",
      now,
    });

    expect(Result.isSuccess(either)).toBe(true);
    const result = Result.getOrThrow(either);
    expect(result.patch).toEqual({
      id: "workspaceMembers_2",
      value: { role: "admin", updatedAt: now },
    });
    expect(result.events).toEqual([
      {
        action: "member.roleChanged",
        workspaceId: "workspaces_1",
        actorUserId: "users_owner",
        subjectKind: "workspaceMember",
        subjectId: "workspaceMembers_2",
        metadata: { previousRole: "editor", nextRole: "admin" },
      },
    ]);
  });

  it("blocks self-escalation and acting on a higher role", () => {
    const changeResult = changeMemberRole({
      actorUserId: "users_admin",
      actorRole: "admin",
      workspaceId: "workspaces_1",
      target: member({ role: "admin", userId: "users_admin" }),
      liveWorkspaceMembers: [member({ role: "admin", userId: "users_admin" })],
      newRole: "owner",
      now,
    });
    expect(Result.isFailure(changeResult)).toBe(true);
    if (Result.isFailure(changeResult)) {
      expect(changeResult.failure).toBeInstanceOf(Forbidden);
    }

    const removeResult = removeMember({
      actorUserId: "users_admin",
      actorRole: "admin",
      workspaceId: "workspaces_1",
      target: member({ id: "workspaceMembers_owner", role: "owner" }),
      liveWorkspaceMembers: [
        member({ id: "workspaceMembers_owner", role: "owner" }),
        member({ id: "workspaceMembers_other", role: "owner" }),
      ],
      now,
    });
    expect(Result.isFailure(removeResult)).toBe(true);
    if (Result.isFailure(removeResult)) {
      expect(removeResult.failure).toBeInstanceOf(Forbidden);
    }
  });

  it("protects the last owner from demotion or removal", () => {
    const owner = member({ role: "owner" });

    const changeResult = changeMemberRole({
      actorUserId: "users_owner",
      actorRole: "owner",
      workspaceId: "workspaces_1",
      target: owner,
      liveWorkspaceMembers: [owner],
      newRole: "admin",
      now,
    });
    expect(Result.isFailure(changeResult)).toBe(true);
    if (Result.isFailure(changeResult)) {
      expect(changeResult.failure).toBeInstanceOf(LastOwnerProtected);
    }

    const removeResult = removeMember({
      actorUserId: "users_owner",
      actorRole: "owner",
      workspaceId: "workspaces_1",
      target: owner,
      liveWorkspaceMembers: [owner],
      now,
    });
    expect(Result.isFailure(removeResult)).toBe(true);
    if (Result.isFailure(removeResult)) {
      expect(removeResult.failure).toBeInstanceOf(LastOwnerProtected);
    }
  });

  it("refuses a target that belongs to a different workspace", () => {
    const changeResult = changeMemberRole({
      actorUserId: "users_owner",
      actorRole: "owner",
      workspaceId: "workspaces_1",
      target: member({ workspaceId: "workspaces_2" }),
      liveWorkspaceMembers: [],
      newRole: "admin",
      now,
    });
    expect(Result.isFailure(changeResult)).toBe(true);
    if (Result.isFailure(changeResult)) {
      expect(changeResult.failure).toBeInstanceOf(MemberNotInWorkspace);
    }
  });

  it.each([
    { label: "revoked", overrides: { status: "revoked" as const } },
    { label: "pending", overrides: { acceptedAt: null } },
    { label: "soft-deleted", overrides: { deletedAt: now } },
  ])(
    "refuses a $label member of this workspace with MembershipNotLive",
    ({ overrides }) => {
      const changeResult = changeMemberRole({
        actorUserId: "users_owner",
        actorRole: "owner",
        workspaceId: "workspaces_1",
        target: member({ workspaceId: "workspaces_1", ...overrides }),
        liveWorkspaceMembers: [],
        newRole: "admin",
        now,
      });
      expect(Result.isFailure(changeResult)).toBe(true);
      if (Result.isFailure(changeResult)) {
        expect(changeResult.failure).toBeInstanceOf(MembershipNotLive);
      }
    },
  );

  it("transfers ownership by promoting the target and stepping the caller down", () => {
    const either = transferOwnership({
      actorUserId: "users_owner",
      workspaceId: "workspaces_1",
      target: member({
        id: "workspaceMembers_target",
        userId: "users_target",
        role: "editor",
      }),
      actorMembership: member({
        id: "workspaceMembers_actor",
        userId: "users_owner",
        role: "owner",
      }),
      now,
    });

    expect(Result.isSuccess(either)).toBe(true);
    const result = Result.getOrThrow(either);
    expect(result.patches).toEqual([
      {
        id: "workspaceMembers_target",
        value: { role: "owner", updatedAt: now },
      },
      {
        id: "workspaceMembers_actor",
        value: { role: "admin", updatedAt: now },
      },
    ]);
    expect(result.events.map((event) => event.action)).toEqual([
      "member.ownershipTransferred",
    ]);
  });
});

describe("workspace invitation lifecycle policy", () => {
  it("builds a normalized pending invitation", () => {
    const either = buildWorkspaceInvitation({
      workspaceId: "workspaces_1",
      organizationId: "organizations_1",
      inviteeEmail: " ADA@Example.COM ",
      role: "editor",
      invitedByUserId: "users_owner",
      tokenHash: "token_hash",
      now,
    });

    expect(Result.isSuccess(either)).toBe(true);
    const result = Result.getOrThrow(either);
    expect(result.invitation).toMatchObject({
      workspaceId: "workspaces_1",
      organizationId: "organizations_1",
      email: "ada@example.com",
      role: "editor",
      status: "pending",
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("builds invitation-created events with the persisted invitation id", () => {
    expect(
      buildInvitationCreatedEvent({
        id: "invitations_1",
        workspaceId: "workspaces_1",
        organizationId: "organizations_1",
        email: "ada@example.com",
        role: "editor",
        status: "pending",
        tokenHash: "token_hash",
        invitedByUserId: "users_owner",
        acceptedAt: null,
        revokedAt: null,
        declinedAt: null,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      action: "invitation.created",
      workspaceId: "workspaces_1",
      actorUserId: "users_owner",
      subjectKind: "invitation",
      subjectId: "invitations_1",
      metadata: { email: "ada@example.com", role: "editor" },
    });
  });

  it("opaque-denies missing, wrong-email, and blank-email invite access", () => {
    const missingResult = acceptInvitation({
      invitation: null,
      verifiedEmail: "ada@example.com",
      userId: "users_ada",
      existingLiveMembership: null,
      now,
    });
    expect(Result.isFailure(missingResult)).toBe(true);
    if (Result.isFailure(missingResult)) {
      expect(missingResult.failure).toBeInstanceOf(InvitationNotAccessible);
    }

    const wrongEmailResult = acceptInvitation({
      invitation: invitation({ email: "ada@example.com" }),
      verifiedEmail: "grace@example.com",
      userId: "users_grace",
      existingLiveMembership: null,
      now,
    });
    expect(Result.isFailure(wrongEmailResult)).toBe(true);
    if (Result.isFailure(wrongEmailResult)) {
      expect(wrongEmailResult.failure).toBeInstanceOf(InvitationNotAccessible);
    }

    const blankEmailResult = declineInvitation({
      invitation: invitation({ email: "" }),
      verifiedEmail: " ",
      now,
    });
    expect(Result.isFailure(blankEmailResult)).toBe(true);
    if (Result.isFailure(blankEmailResult)) {
      expect(blankEmailResult.failure).toBeInstanceOf(InvitationNotAccessible);
    }
  });

  it("rejects non-pending and expired invitations after verifying the invitee", () => {
    const notPendingResult = acceptInvitation({
      invitation: invitation({ status: "accepted" }),
      verifiedEmail: "ada@example.com",
      userId: "users_ada",
      existingLiveMembership: null,
      now,
    });
    expect(Result.isFailure(notPendingResult)).toBe(true);
    if (Result.isFailure(notPendingResult)) {
      expect(notPendingResult.failure).toBeInstanceOf(InvitationNotPending);
    }

    const expiredResult = acceptInvitation({
      invitation: invitation({ expiresAt: now }),
      verifiedEmail: "ada@example.com",
      userId: "users_ada",
      existingLiveMembership: null,
      now,
    });
    expect(Result.isFailure(expiredResult)).toBe(true);
    if (Result.isFailure(expiredResult)) {
      expect(expiredResult.failure).toBeInstanceOf(InvitationExpired);
    }
  });

  it("accepts by creating one membership unless the invitee is already a live member", () => {
    const acceptedEither = acceptInvitation({
      invitation: invitation({}),
      verifiedEmail: "ADA@example.com",
      userId: "users_ada",
      existingLiveMembership: null,
      now,
    });

    expect(Result.isSuccess(acceptedEither)).toBe(true);
    const accepted = Result.getOrThrow(acceptedEither);
    expect(accepted.membershipInsert).toMatchObject({
      workspaceId: "workspaces_1",
      userId: "users_ada",
      role: "editor",
      status: "active",
      acceptedAt: now,
      revokedAt: null,
      deletedAt: null,
    });
    expect(accepted.invitationPatch).toEqual({
      id: "invitations_1",
      value: { status: "accepted", acceptedAt: now, updatedAt: now },
    });

    const alreadyMemberEither = acceptInvitation({
      invitation: invitation({}),
      verifiedEmail: "ada@example.com",
      userId: "users_ada",
      existingLiveMembership: member({ userId: "users_ada" }),
      now,
    });

    expect(Result.isSuccess(alreadyMemberEither)).toBe(true);
    const alreadyMember = Result.getOrThrow(alreadyMemberEither);
    expect(alreadyMember.membershipInsert).toBeNull();
  });

  it("declines and cancels only pending invitations", () => {
    const declineEither = declineInvitation({
      invitation: invitation({}),
      verifiedEmail: "ada@example.com",
      now,
    });
    expect(Result.isSuccess(declineEither)).toBe(true);
    expect(Result.getOrThrow(declineEither).invitationPatch).toEqual({
      id: "invitations_1",
      value: { status: "declined", declinedAt: now, updatedAt: now },
    });

    expect(
      Result.getOrThrow(
        cancelInvitation({
          invitation: invitation({ workspaceId: "workspaces_1" }),
          workspaceId: "workspaces_1",
          actorUserId: "users_owner",
          now,
        }),
      ).invitationPatch,
    ).toEqual({
      id: "invitations_1",
      value: { status: "cancelled", revokedAt: now, updatedAt: now },
    });

    expect(
      Result.getOrThrow(
        cancelInvitation({
          invitation: invitation({ status: "accepted" }),
          workspaceId: "workspaces_1",
          actorUserId: "users_owner",
          now,
        }),
      ).invitationPatch,
    ).toBeNull();

    expect(
      Result.getOrThrow(
        cancelInvitation({
          invitation: invitation({ workspaceId: "workspaces_other" }),
          workspaceId: "workspaces_1",
          actorUserId: "users_owner",
          now,
        }),
      ).invitationPatch,
    ).toBeNull();
  });
});
