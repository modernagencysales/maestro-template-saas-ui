import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import type { InvitationsDoc } from "../_generated/docs";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "../_generated/services";
import { stableFingerprint } from "../shared/tokenCrypto";
import { PublicBaseUrlConfig } from "../shared/config";
import { recordAccessLifecycleEvents } from "./audit";
import {
  Forbidden,
  InvitationNotAccessible,
  WorkspaceNotFound,
} from "../errors";
import {
  asGenericId,
  loadCurrentUser,
  requireActorRole,
  toLifecycleMember,
  type Reader,
} from "./handlerContext";
import {
  acceptInvitation,
  buildInvitationCreatedEvent,
  buildWorkspaceInvitation,
  cancelInvitation,
  declineInvitation,
  isLiveWorkspaceMembership,
  type InvitationRef,
  type WorkspaceMemberLifecycleRef,
} from "./lifecycle";
import invitations from "./invitations.spec";

const create = FunctionImpl.make(
  databaseSchema,
  invitations,
  "create",
  ({ workspaceId, email, role }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const actor = yield* loadActorForWorkspace(reader, workspaceId);
      yield* requireActorRole(actor, "admin");
      const workspace = yield* reader
        .table("workspaces")
        .get(workspaceId)
        .pipe(
          Effect.catch((error) =>
            error._tag === "GetByIdFailure"
              ? Effect.fail(new WorkspaceNotFound({ workspaceId }))
              : Effect.die(error),
          ),
        );
      const tokenHash = yield* Effect.promise(() =>
        stableFingerprint({
          workspaceId,
          email,
          invitedByUserId: actor.userId,
          now,
        }),
      );
      const plan = yield* Effect.fromResult(
        buildWorkspaceInvitation({
          workspaceId,
          organizationId: workspace.organizationId,
          inviteeEmail: email,
          role,
          invitedByUserId: actor.userId,
          tokenHash,
          now,
        }),
      );

      const invitationId = yield* writer
        .table("invitations")
        .insert(plan.invitation)
        .pipe(Effect.orDie);
      yield* recordAccessLifecycleEvents(
        writer,
        [
          buildInvitationCreatedEvent({
            id: invitationId,
            ...plan.invitation,
          }),
        ],
        now,
      );
      const scheduler = yield* Scheduler;
      const publicBaseUrl = yield* PublicBaseUrlConfig.pipe(
        Effect.orElseSucceed(() => "http://localhost:5173"),
      );
      yield* scheduler
        .runAfter(Duration.zero, refs.internal.ops.email.sendTransactional, {
          workspaceId,
          to: plan.invitation.email,
          templateAlias: "workspace-invitation",
          templateModelJson: JSON.stringify({
            workspace_name: workspace.name,
            invitation_id: invitationId,
            invitation_url: `${new URL(publicBaseUrl).origin}/invitations/${invitationId}`,
          }),
          idempotencyKey: `invitation.${invitationId}`,
        })
        .pipe(Effect.orDie);

      return invitationId;
    }),
);

const accept = FunctionImpl.make(
  databaseSchema,
  invitations,
  "accept",
  ({ invitationId }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const user = yield* loadCurrentUser(reader);
      const invitation = yield* loadInvitationForResponse(reader, invitationId);
      const existingLiveMembership =
        invitation === null
          ? null
          : yield* loadOptionalLiveWorkspaceMemberForUser(
              reader,
              invitation.workspaceId,
              user._id,
            );
      const plan = yield* Effect.fromResult(
        acceptInvitation({
          invitation,
          verifiedEmail: user.email,
          userId: user._id,
          existingLiveMembership,
          now,
        }),
      );
      const acceptedInvitation = yield* requireLoadedInvitation(invitation);

      yield* writer
        .table("invitations")
        .patch(invitationId, plan.invitationPatch.value)
        .pipe(Effect.orDie);

      if (plan.membershipInsert !== null) {
        yield* writer
          .table("workspaceMembers")
          .insert({
            ...plan.membershipInsert,
            createdAt: now,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      yield* recordAccessLifecycleEvents(writer, plan.events, now);

      return {
        workspaceId: asGenericId<"workspaces">(acceptedInvitation.workspaceId),
      };
    }),
);

const decline = FunctionImpl.make(
  databaseSchema,
  invitations,
  "decline",
  ({ invitationId }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const user = yield* loadCurrentUser(reader);
      const invitation = yield* loadInvitationForResponse(reader, invitationId);
      const plan = yield* Effect.fromResult(
        declineInvitation({
          invitation,
          verifiedEmail: user.email,
          now,
        }),
      );

      if (plan.invitationPatch !== null) {
        yield* writer
          .table("invitations")
          .patch(invitationId, plan.invitationPatch.value)
          .pipe(Effect.orDie);
      }
      yield* recordAccessLifecycleEvents(writer, plan.events, now);

      return null;
    }),
);

const cancel = FunctionImpl.make(
  databaseSchema,
  invitations,
  "cancel",
  ({ invitationId, workspaceId }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const actor = yield* loadActorForWorkspace(reader, workspaceId);
      yield* requireActorRole(actor, "admin");
      const invitation = yield* loadInvitationForResponse(reader, invitationId);
      const plan = yield* Effect.fromResult(
        cancelInvitation({
          invitation,
          workspaceId,
          actorUserId: actor.userId,
          now,
        }),
      );

      if (plan.invitationPatch !== null) {
        yield* writer
          .table("invitations")
          .patch(invitationId, plan.invitationPatch.value)
          .pipe(Effect.orDie);
      }
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
    const membership = yield* loadOptionalLiveWorkspaceMemberForUser(
      reader,
      workspaceId,
      user._id,
    );
    if (membership === null) {
      return yield* new Forbidden({ reason: "No live workspace membership." });
    }
    return {
      userId: user._id,
      role: membership.role,
    };
  });

const loadInvitationForResponse = (
  reader: Reader,
  invitationId: GenericId<"invitations">,
): Effect.Effect<InvitationRef | null, never> =>
  reader
    .table("invitations")
    .get(invitationId)
    .pipe(
      Effect.map((invitation) => toInvitationRef(invitation)),
      // Missing invitation -> null; a decode/system failure is a real defect,
      // not a silent null (same discrimination as members.impl loadMember).
      Effect.catch((error) =>
        error._tag === "GetByIdFailure"
          ? Effect.succeed(null)
          : Effect.die(error),
      ),
    );

const loadOptionalLiveWorkspaceMemberForUser = (
  reader: Reader,
  workspaceId: GenericId<"workspaces"> | string,
  userId: GenericId<"users"> | string,
): Effect.Effect<WorkspaceMemberLifecycleRef | null, never> =>
  reader
    .table("workspaceMembers")
    .index("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.map((membership) =>
        membership === null ? null : toLifecycleMember(membership),
      ),
      Effect.map((membership) =>
        membership !== null && isLiveWorkspaceMembership(membership)
          ? membership
          : null,
      ),
      Effect.orDie,
    );

const toInvitationRef = (invitation: InvitationsDoc): InvitationRef => ({
  id: invitation._id,
  workspaceId: invitation.workspaceId,
  organizationId: invitation.organizationId,
  email: invitation.email,
  role: invitation.role,
  status: invitation.status,
  tokenHash: invitation.tokenHash,
  invitedByUserId: invitation.invitedByUserId,
  acceptedAt: invitation.acceptedAt,
  revokedAt: invitation.revokedAt,
  declinedAt: invitation.declinedAt ?? null,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
  updatedAt: invitation.updatedAt,
});

const requireLoadedInvitation = (
  invitation: InvitationRef | null,
): Effect.Effect<InvitationRef, InvitationNotAccessible> =>
  invitation === null
    ? Effect.fail(new InvitationNotAccessible())
    : Effect.succeed(invitation);

export default GroupImpl.make(databaseSchema, invitations).pipe(
  Layer.provide(create),
  Layer.provide(accept),
  Layer.provide(decline),
  Layer.provide(cancel),
  GroupImpl.finalize,
);
