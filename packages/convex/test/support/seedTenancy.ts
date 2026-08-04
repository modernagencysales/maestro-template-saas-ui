import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { Id } from "../../confect/_generated/id";
import { DatabaseWriter } from "../../confect/_generated/services";

export const SeededTenancy = Schema.Struct({
  organizationId: Id("organizations"),
  workspaceId: Id("workspaces"),
  memberUserId: Id("users"),
  outsiderUserId: Id("users"),
});

export type SeededTenancy = Schema.Schema.Type<typeof SeededTenancy>;

export const seedTenancy = (
  now: number,
): Effect.Effect<SeededTenancy, never, DatabaseWriter> =>
  Effect.gen(function* () {
    const writer = yield* DatabaseWriter;
    const memberUserId = yield* writer
      .table("users")
      .insert({
        subject: "member-subject",
        tokenIdentifier: "https://issuer.example|member-subject",
        email: "member@example.com",
        displayName: "Member",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const outsiderUserId = yield* writer
      .table("users")
      .insert({
        subject: "outsider-subject",
        tokenIdentifier: "https://issuer.example|outsider-subject",
        email: "outsider@example.com",
        displayName: "Outsider",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const organizationId = yield* writer
      .table("organizations")
      .insert({
        ownerUserId: memberUserId,
        name: "Acme",
        slug: "acme",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const workspaceId = yield* writer
      .table("workspaces")
      .insert({
        organizationId,
        ownerUserId: memberUserId,
        name: "Acme Workspace",
        slug: "acme-demo",
        status: "active",
        dataClassification: "internal",
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("workspaceMembers")
      .insert({
        workspaceId,
        userId: memberUserId,
        role: "editor",
        status: "active",
        acceptedAt: now,
        revokedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);

    return { organizationId, workspaceId, memberUserId, outsiderUserId };
  });
