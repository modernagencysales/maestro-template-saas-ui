import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { MemberNotInWorkspace } from "../errors";
import { recordAccessLifecycleEvents } from "./audit";
import {
  asGenericId,
  loadCurrentUser,
  requireActorRole,
  toLifecycleMember,
  type Reader,
} from "./handlerContext";
import {
  changeMemberRole,
  isLiveWorkspaceMembership,
  removeMember,
  transferOwnership,
  type WorkspaceMemberLifecycleRef,
} from "./lifecycle";
import members from "./members.spec";

const MEMBER_SCAN_CAP = 200;

const list = FunctionImpl.make(
  databaseSchema,
  members,
  "list",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      yield* loadActorForWorkspace(reader, workspaceId);
      const rows = yield* reader
        .table("workspaceMembers")
        .index("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "active"),
        )
        .take(MEMBER_SCAN_CAP)
        .pipe(Effect.orDie);
      const live = rows
        .map(toLifecycleMember)
        .filter(isLiveWorkspaceMembership);
      return yield* Effect.forEach(live, (membership) =>
        Effect.gen(function* () {
          const user = yield* reader
            .table("users")
            .get(asGenericId<"users">(membership.userId))
            .pipe(Effect.orDie);
          return {
            id: asGenericId<"workspaceMembers">(membership.id),
            email: user?.email ?? "",
            name: user?.displayName ?? user?.email ?? "",
            avatar: null,
            roles: [membership.role],
            status: "active" as const,
          };
        }),
      );
    }),
);

const changeRole = FunctionImpl.make(
  databaseSchema,
  members,
  "changeRole",
  ({ membershipId, newRole }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const target = yield* loadMember(reader, membershipId);
      const actor = yield* loadActorForWorkspace(reader, target.workspaceId);
      yield* requireActorRole(actor, "admin");
      const liveMembers = yield* liveWorkspaceMembersOrDie(
        reader,
        target.workspaceId,
      );
      const plan = yield* Effect.fromResult(
        changeMemberRole({
          actorUserId: actor.userId,
          actorRole: actor.role,
          workspaceId: target.workspaceId,
          target,
          liveWorkspaceMembers: liveMembers,
          newRole,
          now,
        }),
      );

      yield* writer
        .table("workspaceMembers")
        .patch(membershipId, plan.patch.value)
        .pipe(Effect.orDie);
      yield* recordAccessLifecycleEvents(writer, plan.events, now);

      return null;
    }),
);

const remove = FunctionImpl.make(
  databaseSchema,
  members,
  "remove",
  ({ membershipId }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const target = yield* loadMember(reader, membershipId);
      const actor = yield* loadActorForWorkspace(reader, target.workspaceId);
      yield* requireActorRole(actor, "admin");
      const liveMembers = yield* liveWorkspaceMembersOrDie(
        reader,
        target.workspaceId,
      );
      const plan = yield* Effect.fromResult(
        removeMember({
          actorUserId: actor.userId,
          actorRole: actor.role,
          workspaceId: target.workspaceId,
          target,
          liveWorkspaceMembers: liveMembers,
          now,
        }),
      );

      yield* writer
        .table("workspaceMembers")
        .patch(membershipId, plan.patch.value)
        .pipe(Effect.orDie);
      yield* recordAccessLifecycleEvents(writer, plan.events, now);

      return null;
    }),
);

const transferOwnershipImpl = FunctionImpl.make(
  databaseSchema,
  members,
  "transferOwnership",
  ({ membershipId }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const target = yield* loadMember(reader, membershipId);
      const actor = yield* loadActorForWorkspace(reader, target.workspaceId);
      yield* requireActorRole(actor, "owner");
      const actorMembership = yield* loadLiveWorkspaceMemberForUser(
        reader,
        target.workspaceId,
        actor.userId,
      );
      const plan = yield* Effect.fromResult(
        transferOwnership({
          actorUserId: actor.userId,
          workspaceId: target.workspaceId,
          target,
          actorMembership,
          now,
        }),
      );

      yield* Effect.forEach(plan.patches, (patch) =>
        writer
          .table("workspaceMembers")
          .patch(asGenericId<"workspaceMembers">(patch.id), patch.value)
          .pipe(Effect.orDie),
      );
      yield* recordAccessLifecycleEvents(writer, plan.events, now);

      return null;
    }),
);

const loadActorForWorkspace = (
  reader: Reader,
  workspaceId: GenericId<"workspaces"> | string,
) =>
  Effect.gen(function* () {
    const user = yield* loadCurrentUser(reader);
    const membership = yield* loadLiveWorkspaceMemberForUser(
      reader,
      workspaceId,
      user._id,
    );
    return {
      userId: user._id,
      role: membership.role,
    };
  });

const loadMember = (
  reader: Reader,
  membershipId: GenericId<"workspaceMembers">,
): Effect.Effect<WorkspaceMemberLifecycleRef, MemberNotInWorkspace> =>
  reader
    .table("workspaceMembers")
    .get(membershipId)
    .pipe(
      Effect.map(toLifecycleMember),
      Effect.catch((error) =>
        error._tag === "GetByIdFailure"
          ? Effect.fail(new MemberNotInWorkspace({ membershipId }))
          : Effect.die(error),
      ),
    );

const loadLiveWorkspaceMemberForUser = (
  reader: Reader,
  workspaceId: GenericId<"workspaces"> | string,
  userId: GenericId<"users"> | string,
): Effect.Effect<WorkspaceMemberLifecycleRef, MemberNotInWorkspace> =>
  reader
    .table("workspaceMembers")
    .index("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.flatMap((membership) =>
        membership === null
          ? Effect.fail(new MemberNotInWorkspace({ membershipId: "actor" }))
          : Effect.succeed(toLifecycleMember(membership)),
      ),
      Effect.flatMap((membership) =>
        isLiveWorkspaceMembership(membership)
          ? Effect.succeed(membership)
          : Effect.fail(
              new MemberNotInWorkspace({ membershipId: membership.id }),
            ),
      ),
      // Keep the typed MemberNotInWorkspace; a decode/system failure is a real
      // defect, not a spurious "member not found".
      Effect.catch((error) =>
        error instanceof MemberNotInWorkspace
          ? Effect.fail(error)
          : Effect.die(error),
      ),
    );

const liveWorkspaceMembersOrDie = (
  reader: Reader,
  workspaceId: GenericId<"workspaces"> | string,
) =>
  reader
    .table("workspaceMembers")
    .index("by_workspace_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "active"),
    )
    .take(MEMBER_SCAN_CAP)
    .pipe(
      Effect.map((members_) =>
        members_.map(toLifecycleMember).filter(isLiveWorkspaceMembership),
      ),
      Effect.orDie,
    );

export default GroupImpl.make(databaseSchema, members).pipe(
  Layer.provide(list),
  Layer.provide(changeRole),
  Layer.provide(remove),
  Layer.provide(transferOwnershipImpl),
  GroupImpl.finalize,
);
