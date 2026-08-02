import * as Result from "effect/Result";

import {
  Forbidden,
  InvitationExpired,
  InvitationNotAccessible,
  InvitationNotPending,
  LastOwnerProtected,
  MemberNotInWorkspace,
  MembershipNotLive,
  ValidationFailed,
} from "../errors";
import { roleAtLeast, type Role } from "./roles";

export {
  acceptInvitation,
  buildInvitationCreatedEvent,
  buildWorkspaceInvitation,
  cancelInvitation,
  declineInvitation,
  INVITATION_TTL_MS,
} from "./lifecycleInvitations";
export type { InvitationRef } from "./lifecycleInvitations";

type MembershipStatus = "pending" | "active" | "revoked";

export type WorkspaceMemberLifecycleRef = {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: Role;
  readonly status: MembershipStatus;
  readonly acceptedAt: number | null;
  readonly revokedAt: number | null;
  readonly deletedAt: number | null;
};

type AuditMetadata =
  | { readonly previousRole: Role; readonly nextRole: Role }
  | { readonly role: Role }
  | { readonly email: string; readonly role: Role }
  | { readonly acceptedByUserId: string }
  | { readonly reason: "declined" | "cancelled" };

type AccessLifecycleActor =
  { readonly actorUserId: string } | { readonly actorEmail: string };

export type AccessLifecycleEvent = AccessLifecycleActor & {
  readonly action:
    | "member.roleChanged"
    | "member.removed"
    | "member.ownershipTransferred"
    | "invitation.created"
    | "invitation.accepted"
    | "invitation.declined"
    | "invitation.cancelled";
  readonly workspaceId: string;
  readonly subjectKind: "workspaceMember" | "invitation";
  readonly subjectId: string;
  readonly metadata: AuditMetadata;
};

type Patch<Value> = {
  readonly id: string;
  readonly value: Value;
};

export type AccessLifecycleError =
  | Forbidden
  | InvitationExpired
  | InvitationNotAccessible
  | InvitationNotPending
  | LastOwnerProtected
  | MemberNotInWorkspace
  | MembershipNotLive
  | ValidationFailed;

export type PlannerResult<
  A,
  E extends AccessLifecycleError = AccessLifecycleError,
> = Result.Result<A, E>;

export const changeMemberRole = (input: {
  readonly actorUserId: string;
  readonly actorRole: Role;
  readonly workspaceId: string;
  readonly target: WorkspaceMemberLifecycleRef;
  readonly liveWorkspaceMembers: readonly WorkspaceMemberLifecycleRef[];
  readonly newRole: Role;
  readonly now: number;
}): Result.Result<
  {
    readonly patch: Patch<{ readonly role: Role; readonly updatedAt: number }>;
    readonly events: readonly AccessLifecycleEvent[];
  },
  MemberNotInWorkspace | MembershipNotLive | Forbidden | LastOwnerProtected
> =>
  Result.gen(function* () {
    yield* assertLiveWorkspaceMember(input.target, input.workspaceId);
    yield* assertActorCanManage(input.actorRole, input.target.role);
    yield* assertActorCanGrant(input.actorRole, input.newRole);
    if (input.target.role === "owner" && input.newRole !== "owner") {
      yield* assertNotLastOwner(input.workspaceId, input.liveWorkspaceMembers);
    }

    return {
      patch: {
        id: input.target.id,
        value: { role: input.newRole, updatedAt: input.now },
      },
      events: [
        {
          action: "member.roleChanged",
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          subjectKind: "workspaceMember",
          subjectId: input.target.id,
          metadata: {
            previousRole: input.target.role,
            nextRole: input.newRole,
          },
        },
      ],
    };
  });

export const removeMember = (input: {
  readonly actorUserId: string;
  readonly actorRole: Role;
  readonly workspaceId: string;
  readonly target: WorkspaceMemberLifecycleRef;
  readonly liveWorkspaceMembers: readonly WorkspaceMemberLifecycleRef[];
  readonly now: number;
}): Result.Result<
  {
    readonly patch: Patch<{
      readonly status: "revoked";
      readonly revokedAt: number;
      readonly deletedAt: number;
      readonly updatedAt: number;
    }>;
    readonly events: readonly AccessLifecycleEvent[];
  },
  MemberNotInWorkspace | MembershipNotLive | Forbidden | LastOwnerProtected
> =>
  Result.gen(function* () {
    yield* assertLiveWorkspaceMember(input.target, input.workspaceId);
    yield* assertActorCanManage(input.actorRole, input.target.role);
    if (input.target.role === "owner") {
      yield* assertNotLastOwner(input.workspaceId, input.liveWorkspaceMembers);
    }

    return {
      patch: {
        id: input.target.id,
        value: {
          status: "revoked",
          revokedAt: input.now,
          deletedAt: input.now,
          updatedAt: input.now,
        },
      },
      events: [
        {
          action: "member.removed",
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          subjectKind: "workspaceMember",
          subjectId: input.target.id,
          metadata: { role: input.target.role },
        },
      ],
    };
  });

export const transferOwnership = (input: {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly target: WorkspaceMemberLifecycleRef;
  readonly actorMembership: WorkspaceMemberLifecycleRef;
  readonly now: number;
}): Result.Result<
  {
    readonly patches: readonly Patch<{
      readonly role: Role;
      readonly updatedAt: number;
    }>[];
    readonly events: readonly AccessLifecycleEvent[];
  },
  MemberNotInWorkspace | MembershipNotLive | Forbidden
> =>
  Result.gen(function* () {
    yield* assertLiveWorkspaceMember(input.target, input.workspaceId);
    yield* assertLiveWorkspaceMember(input.actorMembership, input.workspaceId);
    if (
      input.target.userId === input.actorUserId ||
      input.actorMembership.userId !== input.actorUserId ||
      input.actorMembership.role !== "owner"
    ) {
      yield* Result.fail(
        new Forbidden({ reason: "Cannot transfer workspace ownership." }),
      );
    }

    return {
      patches: [
        {
          id: input.target.id,
          value: { role: "owner", updatedAt: input.now },
        },
        {
          id: input.actorMembership.id,
          value: { role: "admin", updatedAt: input.now },
        },
      ],
      events: [
        {
          action: "member.ownershipTransferred",
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          subjectKind: "workspaceMember",
          subjectId: input.target.id,
          metadata: { previousRole: input.target.role, nextRole: "owner" },
        },
      ],
    };
  });

/**
 * A workspace membership is "live" when it is active, accepted, and neither
 * revoked nor soft-deleted. Centralised so the liveness rule has one definition
 * instead of the same four-clause boolean copied across every loader and guard.
 */
export const isLiveWorkspaceMembership = (
  member: Pick<
    WorkspaceMemberLifecycleRef,
    "status" | "acceptedAt" | "revokedAt" | "deletedAt"
  >,
): boolean =>
  member.status === "active" &&
  member.acceptedAt !== null &&
  member.revokedAt === null &&
  member.deletedAt === null;

const assertLiveWorkspaceMember = (
  member: WorkspaceMemberLifecycleRef,
  workspaceId: string,
): Result.Result<void, MemberNotInWorkspace | MembershipNotLive> => {
  if (member.workspaceId !== workspaceId) {
    return Result.fail(new MemberNotInWorkspace({ membershipId: member.id }));
  }
  if (!isLiveWorkspaceMembership(member)) {
    return Result.fail(new MembershipNotLive({ membershipId: member.id }));
  }
  return Result.void;
};

const assertActorCanManage = (
  actorRole: Role,
  targetRole: Role,
): Result.Result<void, Forbidden> =>
  roleAtLeast(actorRole, targetRole)
    ? Result.void
    : Result.fail(
        new Forbidden({
          reason: "Cannot manage a member with a higher role.",
        }),
      );

const assertActorCanGrant = (
  actorRole: Role,
  newRole: Role,
): Result.Result<void, Forbidden> =>
  roleAtLeast(actorRole, newRole)
    ? Result.void
    : Result.fail(
        new Forbidden({
          reason: "Cannot grant a role higher than your own.",
        }),
      );

const assertNotLastOwner = (
  workspaceId: string,
  members: readonly WorkspaceMemberLifecycleRef[],
): Result.Result<void, LastOwnerProtected> => {
  const liveOwners = members.filter(
    (member) =>
      member.workspaceId === workspaceId &&
      member.role === "owner" &&
      isLiveWorkspaceMembership(member),
  );
  return liveOwners.length <= 1
    ? Result.fail(new LastOwnerProtected({ workspaceId }))
    : Result.void;
};
