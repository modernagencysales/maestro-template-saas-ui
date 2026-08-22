import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader } from "../_generated/services";
import { MemberNotInWorkspace } from "../errors";
import { isLiveWorkspaceMembership } from "../access/lifecycle";
import {
  asGenericId,
  loadCurrentUser,
  toLifecycleMember,
  type Reader,
} from "../access/handlerContext";
import workspaces from "./workspaces.spec";

const MEMBER_SCAN_CAP = 200;

const liveMemberships = (reader: Reader, userId: GenericId<"users">) =>
  reader
    .table("workspaceMembers")
    .index("by_user", (q) => q.eq("userId", userId))
    .take(MEMBER_SCAN_CAP)
    .pipe(
      Effect.map((rows) =>
        rows.map(toLifecycleMember).filter(isLiveWorkspaceMembership),
      ),
      Effect.orDie,
    );

const frontendWorkspace = (row: {
  readonly _id: GenericId<"workspaces">;
  readonly slug: string;
  readonly name: string;
}) => ({
  id: row._id,
  slug: row.slug,
  name: row.name,
});

const me = FunctionImpl.make(databaseSchema, workspaces, "me", () =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const user = yield* loadCurrentUser(reader);
    const memberships = yield* liveMemberships(reader, user._id);
    const rows = yield* Effect.forEach(memberships, (membership) =>
      reader
        .table("workspaces")
        .get(asGenericId<"workspaces">(membership.workspaceId))
        .pipe(Effect.orDie),
    );
    return {
      id: user._id,
      email: user.email,
      name: user.displayName ?? user.email,
      image: null,
      workspaces: rows
        .filter(
          (row): row is NonNullable<typeof row> =>
            row !== null && row.status === "active",
        )
        .map(frontendWorkspace),
    };
  }),
);

const bySlug = FunctionImpl.make(
  databaseSchema,
  workspaces,
  "bySlug",
  ({ slug }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const user = yield* loadCurrentUser(reader);
      const workspace = yield* reader
        .table("workspaces")
        .index("by_slug", (q) => q.eq("slug", slug))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (workspace === null || workspace.status !== "active") return null;
      const membership = yield* reader
        .table("workspaceMembers")
        .index("by_workspace_user", (q) =>
          q.eq("workspaceId", workspace._id).eq("userId", user._id),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        membership === null ||
        !isLiveWorkspaceMembership(toLifecycleMember(membership))
      ) {
        return yield* Effect.fail(
          new MemberNotInWorkspace({ membershipId: "workspace" }),
        );
      }
      return frontendWorkspace(workspace);
    }),
);

const list = FunctionImpl.make(databaseSchema, workspaces, "list", () =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const user = yield* loadCurrentUser(reader);
    const memberships = yield* liveMemberships(reader, user._id);
    const rows = yield* Effect.forEach(memberships, (membership) =>
      reader
        .table("workspaces")
        .get(asGenericId<"workspaces">(membership.workspaceId))
        .pipe(Effect.orDie),
    );
    return rows.filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.status === "active",
    );
  }),
);

export default GroupImpl.make(databaseSchema, workspaces).pipe(
  Layer.provide(me),
  Layer.provide(bySlug),
  Layer.provide(list),
  GroupImpl.finalize,
);
