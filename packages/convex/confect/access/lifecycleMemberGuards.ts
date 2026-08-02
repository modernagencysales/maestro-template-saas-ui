import * as Result from "effect/Result";

import { Forbidden, LastOwnerProtected, MemberNotInWorkspace } from "../errors";
import {
  isLiveWorkspaceMember,
  liveWorkspaceOwnersForWorkspace,
} from "./lifecyclePredicates";
import type {
  AccessLifecycleError,
  PlannerResult,
  WorkspaceMemberLifecycleRef,
} from "./lifecycle";
import { roleAtLeast, type Role } from "./roles";

const fail = <E extends AccessLifecycleError>(
  error: E,
): PlannerResult<never, E> => Result.fail(error);
const succeed = <A>(value: A): PlannerResult<A, never> => Result.succeed(value);

export const requireLiveWorkspaceMember = (
  member: WorkspaceMemberLifecycleRef,
  workspaceId: string,
): PlannerResult<WorkspaceMemberLifecycleRef, MemberNotInWorkspace> => {
  if (!isLiveWorkspaceMember(member, workspaceId)) {
    return fail(new MemberNotInWorkspace({ membershipId: member.id }));
  }
  return succeed(member);
};

export const requireActorCanManage = (
  actorRole: Role,
  targetRole: Role,
): PlannerResult<void, Forbidden> => {
  if (!roleAtLeast(actorRole, targetRole)) {
    return fail(
      new Forbidden({
        reason: "Cannot manage a member with a higher role.",
      }),
    );
  }
  return succeed(undefined);
};

export const requireActorCanGrant = (
  actorRole: Role,
  newRole: Role,
): PlannerResult<void, Forbidden> => {
  if (!roleAtLeast(actorRole, newRole)) {
    return fail(
      new Forbidden({
        reason: "Cannot grant a role higher than your own.",
      }),
    );
  }
  return succeed(undefined);
};

export const requireOwnerRoleChangeAllowed = (
  target: WorkspaceMemberLifecycleRef,
  newRole: Role,
  workspaceId: string,
  members: readonly WorkspaceMemberLifecycleRef[],
): PlannerResult<void, LastOwnerProtected> =>
  target.role === "owner" && newRole !== "owner"
    ? requireNotLastOwner(workspaceId, members)
    : succeed(undefined);

export const requireNotLastOwner = (
  workspaceId: string,
  members: readonly WorkspaceMemberLifecycleRef[],
): PlannerResult<void, LastOwnerProtected> => {
  const liveOwners = liveWorkspaceOwnersForWorkspace(workspaceId, members);
  if (liveOwners.length <= 1) {
    return fail(new LastOwnerProtected({ workspaceId }));
  }
  return succeed(undefined);
};
