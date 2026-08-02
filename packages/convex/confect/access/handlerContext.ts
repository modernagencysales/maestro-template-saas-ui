import type { GenericId } from "convex/values";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { WorkspaceMembersDoc } from "../_generated/docs";
import { Auth, DatabaseReader } from "../_generated/services";
import { Forbidden, Unauthorized } from "../errors";
import type { WorkspaceMemberLifecycleRef } from "./lifecycle";
import { roleAtLeast, type Role } from "./roles";

/**
 * Shared handler-boundary helpers for the access domain. The workspace-member
 * and invitation handlers derive the same actor context from the request the
 * same way; keeping one copy here is both the DRY win and the single place the
 * identity/authorization derivation is defined.
 */
export type Reader = Context.Service.Shape<typeof DatabaseReader>;

/**
 * Resolve the authenticated caller to their `users` row. Fails `Unauthorized`
 * for a missing identity or an identity with no provisioned user.
 */
export const loadCurrentUser = (reader: Reader) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const identity = yield* auth.getUserIdentity.pipe(
      Effect.mapError(() => new Unauthorized()),
    );
    return yield* reader
      .table("users")
      .index("by_subject", (q) => q.eq("subject", identity.subject))
      .first()
      .pipe(
        Effect.map(Option.getOrNull),
        Effect.flatMap((user) =>
          user === null
            ? Effect.fail(new Unauthorized())
            : Effect.succeed(user),
        ),
        // Keep the typed Unauthorized; a decode/system failure is a real defect,
        // not a spurious authorization error.
        Effect.catch((error) =>
          error instanceof Unauthorized
            ? Effect.fail(error)
            : Effect.die(error),
        ),
      );
  });

/** Require the actor to hold at least `minimumRole`, else fail `Forbidden`. */
export const requireActorRole = (
  actor: { readonly role: Role },
  minimumRole: Role,
): Effect.Effect<void, Forbidden> =>
  roleAtLeast(actor.role, minimumRole)
    ? Effect.void
    : Effect.fail(new Forbidden({ reason: "Insufficient workspace role." }));

/** Project a `workspaceMembers` row to the lifecycle ref the planners consume. */
export const toLifecycleMember = (
  member: WorkspaceMembersDoc,
): WorkspaceMemberLifecycleRef => ({
  id: member._id,
  workspaceId: member.workspaceId,
  userId: member.userId,
  role: member.role,
  status: member.status,
  acceptedAt: member.acceptedAt,
  revokedAt: member.revokedAt,
  deletedAt: member.deletedAt,
});

export const asGenericId = <TableName extends string>(
  id: string,
): GenericId<TableName> => id as GenericId<TableName>;
