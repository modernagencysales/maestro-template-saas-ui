import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  resolveEffectiveWorkspaceRole,
  type OrganizationMemberRef,
  type OrganizationRef,
  type WorkspaceMemberRef,
  type WorkspaceRef,
} from "../../access/auth";
import { roleAtLeast, type Role } from "../../access/roles";
import { Auth, DatabaseReader } from "../../_generated/services";
import {
  MemberNotInWorkspace,
  Unauthorized,
  WorkspaceNotFound,
} from "../../errors";

export type WorkspaceAccess = {
  readonly userId: GenericId<"users">;
  readonly workspaceId: GenericId<"workspaces">;
  readonly role: Role;
  readonly reason: string;
  readonly authEpoch: number;
};

export type WorkspaceActorAccess = WorkspaceAccess;

export const requireWorkspaceAccess = (
  workspaceId: GenericId<"workspaces">,
  minimumRole: Role,
): Effect.Effect<
  WorkspaceAccess,
  Unauthorized | WorkspaceNotFound | MemberNotInWorkspace,
  Auth | DatabaseReader | Clock.Clock
> =>
  Effect.gen(function* () {
    const user = yield* loadActiveWorkspaceUser;
    const workspace = yield* loadWorkspace(workspaceId);
    const organization = yield* loadWorkspaceOrganization(
      workspace.organizationId,
      workspaceId,
    );
    const nowMs = yield* Clock.currentTimeMillis;
    const memberships = yield* loadWorkspaceAccessMemberships({
      workspaceId,
      organizationId: workspace.organizationId,
      userId: user._id,
    });
    const resolution = yield* requireResolvedWorkspaceAccess(
      resolveWorkspaceAccessRole({
        nowMs,
        userId: user._id,
        workspace,
        organization,
        ...memberships,
      }),
      minimumRole,
    );

    return {
      userId: user._id,
      workspaceId,
      role: resolution.role,
      reason: resolution.reason,
      authEpoch: membershipAuthEpoch(memberships),
    };
  });

export const requireWorkspaceActorAccess = (
  workspaceId: GenericId<"workspaces">,
  userId: GenericId<"users">,
  minimumRole: Role,
): Effect.Effect<
  WorkspaceActorAccess,
  Unauthorized | WorkspaceNotFound | MemberNotInWorkspace,
  DatabaseReader | Clock.Clock
> =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const user = yield* reader.table("users").get(userId).pipe(Effect.orDie);
    yield* requireActiveUser(user);
    const workspace = yield* loadWorkspace(workspaceId);
    const organization = yield* loadWorkspaceOrganization(
      workspace.organizationId,
      workspaceId,
    );
    const nowMs = yield* Clock.currentTimeMillis;
    const memberships = yield* loadWorkspaceAccessMemberships({
      workspaceId,
      organizationId: workspace.organizationId,
      userId,
    });
    const resolution = yield* requireResolvedWorkspaceAccess(
      resolveWorkspaceAccessRole({
        nowMs,
        userId,
        workspace,
        organization,
        ...memberships,
      }),
      minimumRole,
    );
    return {
      userId,
      workspaceId,
      role: resolution.role,
      reason: resolution.reason,
      authEpoch: membershipAuthEpoch(memberships),
    };
  });

const membershipAuthEpoch = (memberships: {
  readonly workspaceMembers: readonly { readonly updatedAt: number }[];
  readonly organizationMembers: readonly { readonly updatedAt: number }[];
}): number =>
  Math.max(
    0,
    ...memberships.workspaceMembers.map((row) => row.updatedAt),
    ...memberships.organizationMembers.map((row) => row.updatedAt),
  );

const loadActiveWorkspaceUser = Effect.gen(function* () {
  const auth = yield* Auth;
  const reader = yield* DatabaseReader;
  const identity = yield* auth.getUserIdentity.pipe(
    Effect.mapError(() => new Unauthorized()),
  );
  const user = yield* reader
    .table("users")
    .index("by_subject", (q) => q.eq("subject", identity.subject))
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);

  return yield* requireActiveUser(user);
});

const requireActiveUser = <User extends { readonly status: string }>(
  user: User | null,
) =>
  user === null || user.status !== "active"
    ? Effect.fail(new Unauthorized())
    : Effect.succeed(user);

const loadWorkspace = (workspaceId: GenericId<"workspaces">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const workspace = yield* reader
      .table("workspaces")
      .get(workspaceId)
      .pipe(Effect.orDie);

    return yield* requireExistingWorkspace(workspace, workspaceId);
  });

const loadWorkspaceOrganization = (
  organizationId: string,
  workspaceId: GenericId<"workspaces">,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const organization = yield* reader
      .table("organizations")
      .get(toId<"organizations">(organizationId))
      .pipe(Effect.orDie);

    return yield* requireWorkspaceOrganization(organization, workspaceId);
  });

const requireExistingWorkspace = <WorkspaceRow>(
  workspace: WorkspaceRow | null,
  workspaceId: GenericId<"workspaces">,
) =>
  workspace === null
    ? Effect.fail(new WorkspaceNotFound({ workspaceId }))
    : Effect.succeed(workspace);

const requireWorkspaceOrganization = <OrganizationRow>(
  organization: OrganizationRow | null,
  workspaceId: GenericId<"workspaces">,
) =>
  // Workspace access exposes a workspace-scoped error surface; a missing owner
  // organization means this workspace access target cannot be resolved.
  organization === null
    ? Effect.fail(new WorkspaceNotFound({ workspaceId }))
    : Effect.succeed(organization);

const loadWorkspaceAccessMemberships = (input: {
  readonly workspaceId: GenericId<"workspaces">;
  readonly organizationId: string;
  readonly userId: GenericId<"users">;
}) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const workspaceMembers = yield* reader
      .table("workspaceMembers")
      .index("by_workspace_user", (q) =>
        q.eq("workspaceId", input.workspaceId).eq("userId", input.userId),
      )
      .collect()
      .pipe(Effect.orDie);
    const organizationMembers = yield* reader
      .table("organizationMembers")
      .index("by_organization_user", (q) =>
        q.eq("organizationId", input.organizationId).eq("userId", input.userId),
      )
      .collect()
      .pipe(Effect.orDie);

    return { workspaceMembers, organizationMembers };
  });

const resolveWorkspaceAccessRole = (input: {
  readonly nowMs: number;
  readonly userId: GenericId<"users">;
  readonly workspace: Omit<WorkspaceRef, "id"> & {
    readonly _id: GenericId<"workspaces">;
  };
  readonly organization: Omit<OrganizationRef, "id"> & {
    readonly _id: GenericId<"organizations">;
  };
  readonly workspaceMembers: readonly WorkspaceMemberRef[];
  readonly organizationMembers: readonly OrganizationMemberRef[];
}) =>
  resolveEffectiveWorkspaceRole({
    nowMs: input.nowMs,
    userId: input.userId,
    workspace: {
      id: input.workspace._id,
      organizationId: input.workspace.organizationId,
      status: input.workspace.status,
    },
    organization: {
      id: input.organization._id,
      status: input.organization.status,
    },
    workspaceMembers: input.workspaceMembers.map((member) => ({
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      acceptedAt: member.acceptedAt,
      revokedAt: member.revokedAt,
      deletedAt: member.deletedAt,
    })),
    organizationMembers: input.organizationMembers.map((member) => ({
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      acceptedAt: member.acceptedAt,
      revokedAt: member.revokedAt,
    })),
    guestGrants: [],
  });

const requireResolvedWorkspaceAccess = (
  resolution: ReturnType<typeof resolveEffectiveWorkspaceRole>,
  minimumRole: Role,
) =>
  resolution.ok && roleAtLeast(resolution.role, minimumRole)
    ? Effect.succeed(resolution)
    : Effect.fail(
        new MemberNotInWorkspace({
          membershipId: "actor",
        }),
      );

const toId = <TableName extends string>(id: string): GenericId<TableName> =>
  id as GenericId<TableName>;
