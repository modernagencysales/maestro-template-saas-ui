import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { Auth, DatabaseReader, DatabaseWriter } from "../_generated/services";
import { Unauthorized } from "../errors";
import { asGenericId } from "./handlerContext";
import provisioning from "./provisioning.spec";
import {
  buildProvisioningPlan,
  extractIdentityProfile,
  requireInsertValue,
  selectLiveOwnedOrganization,
  selectLiveOwnedWorkspace,
  type UserProvisioningRow,
} from "./provisioning";

const ensureProvisioned = FunctionImpl.make(
  databaseSchema,
  provisioning,
  "ensureProvisioned",
  () =>
    Effect.gen(function* () {
      const auth = yield* Auth;
      const identity = yield* extractIdentityProfile(
        yield* auth.getUserIdentity.pipe(
          Effect.mapError(() => new Unauthorized()),
        ),
      );
      const now = yield* Clock.currentTimeMillis;

      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;

      const existingUser = yield* reader
        .table("users")
        .index("by_subject", (q) => q.eq("subject", identity.subject))
        .first()
        .pipe(
          Effect.map(Option.getOrNull),
          Effect.map((user) =>
            user === null ? null : toProvisioningUser(user),
          ),
          Effect.orDie,
        );

      const userPlan = (yield* Effect.fromResult(
        buildProvisioningPlan({
          identity,
          state: {
            user: existingUser,
            liveOrganization: null,
            liveWorkspace: null,
            organizationMembership: null,
            workspaceMembership: null,
          },
          now,
        }),
      )).user;

      const userId: GenericId<"users"> =
        existingUser === null
          ? yield* writer
              .table("users")
              .insert(requireInsertValue(userPlan, "user"))
              .pipe(Effect.orDie)
          : asGenericId<"users">(existingUser._id);

      if (existingUser !== null && userPlan.action === "patch") {
        yield* writer
          .table("users")
          .patch(asGenericId<"users">(existingUser._id), userPlan.value)
          .pipe(Effect.orDie);
      }

      const organizations = yield* reader
        .table("organizations")
        .index("by_owner", (q) => q.eq("ownerUserId", userId))
        .take(100)
        .pipe(Effect.orDie);
      const existingOrganization = yield* Effect.fromResult(
        selectLiveOwnedOrganization(organizations, userId),
      );

      const workspaces =
        existingOrganization === null
          ? []
          : yield* reader
              .table("workspaces")
              .index("by_organization", (q) =>
                q.eq("organizationId", existingOrganization._id),
              )
              .take(100)
              .pipe(Effect.orDie);
      const existingWorkspace = yield* Effect.fromResult(
        selectLiveOwnedWorkspace(workspaces, userId),
      );

      const organizationMembership =
        existingOrganization === null
          ? null
          : yield* reader
              .table("organizationMembers")
              .index("by_organization_user", (q) =>
                q
                  .eq("organizationId", existingOrganization._id)
                  .eq("userId", userId),
              )
              .first()
              .pipe(Effect.map(Option.getOrNull), Effect.orDie);

      const workspaceMembership =
        existingWorkspace === null
          ? null
          : yield* reader
              .table("workspaceMembers")
              .index("by_workspace_user", (q) =>
                q.eq("workspaceId", existingWorkspace._id).eq("userId", userId),
              )
              .first()
              .pipe(Effect.map(Option.getOrNull), Effect.orDie);

      const plan = yield* Effect.fromResult(
        buildProvisioningPlan({
          identity,
          state: {
            user: existingUser,
            liveOrganization: existingOrganization,
            liveWorkspace: existingWorkspace,
            organizationMembership,
            workspaceMembership,
          },
          now,
        }),
      );

      const organizationId: GenericId<"organizations"> =
        existingOrganization === null
          ? yield* writer
              .table("organizations")
              .insert({
                ...requireInsertValue(plan.organization, "organization"),
                ownerUserId: userId,
              })
              .pipe(Effect.orDie)
          : asGenericId<"organizations">(existingOrganization._id);

      const workspaceId: GenericId<"workspaces"> =
        existingWorkspace === null
          ? yield* writer
              .table("workspaces")
              .insert({
                ...requireInsertValue(plan.workspace, "workspace"),
                organizationId,
                ownerUserId: userId,
              })
              .pipe(Effect.orDie)
          : asGenericId<"workspaces">(existingWorkspace._id);

      // The two membership upserts below are deliberately kept inline rather than
      // factored into a shared `upsertMembership<T extends TableNames>` helper.
      // confect's writer types `.insert` against a *concrete* table literal
      // (`WithoutSystemFields<DocumentByName<…, T>>`); inside a helper generic
      // over `T`, TypeScript cannot prove the value matches that mapping, so the
      // helper only compiles with an `as` assertion — which discards the concrete
      // insert-shape check these literal call sites get for free (our first line
      // of defense against schema drift between the provisioning rows and the
      // Convex schema). The parallel structure is the price of that check, and
      // it is worth more than removing the duplication. Never reach for `any`
      // here. See docs/template/coding-standards.md ("Multi-table Convex writes").
      if (organizationMembership === null) {
        yield* writer
          .table("organizationMembers")
          .insert({
            ...requireInsertValue(
              plan.organizationMembership,
              "organizationMembership",
            ),
            organizationId,
            userId,
          })
          .pipe(Effect.orDie);
      } else if (plan.organizationMembership.action === "patch") {
        yield* writer
          .table("organizationMembers")
          .patch(organizationMembership._id, plan.organizationMembership.value)
          .pipe(Effect.orDie);
      }

      if (workspaceMembership === null) {
        yield* writer
          .table("workspaceMembers")
          .insert({
            ...requireInsertValue(
              plan.workspaceMembership,
              "workspaceMembership",
            ),
            workspaceId,
            userId,
          })
          .pipe(Effect.orDie);
      } else if (plan.workspaceMembership.action === "patch") {
        yield* writer
          .table("workspaceMembers")
          .patch(workspaceMembership._id, plan.workspaceMembership.value)
          .pipe(Effect.orDie);
      }

      return { workspaceId };
    }),
);

const toProvisioningUser = (user: {
  readonly _id: GenericId<"users">;
  readonly subject: string;
  readonly email: string;
  readonly displayName?: string | undefined;
  readonly status: "active" | "suspended" | "deleted";
  readonly createdAt: number;
  readonly updatedAt: number;
}): UserProvisioningRow => ({
  _id: user._id,
  subject: user.subject,
  email: user.email,
  ...(user.displayName === undefined ? {} : { displayName: user.displayName }),
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export default GroupImpl.make(databaseSchema, provisioning).pipe(
  Layer.provide(ensureProvisioned),
  GroupImpl.finalize,
);
