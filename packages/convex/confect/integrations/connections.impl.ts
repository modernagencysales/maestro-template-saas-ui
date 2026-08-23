import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { NotFound, ValidationFailed } from "../errors";
import {
  beginConnection,
  completeConnection,
  revokeConnection,
  type ProviderConnectionState,
  type ProviderKey,
} from "./connectionLifecycle";
import connections from "./connections.spec";

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const currentConnection = (
  workspaceId: GenericId<"workspaces">,
  provider: ProviderKey,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("providerConnections")
      .index("by_workspace_and_provider", (q) =>
        q.eq("workspaceId", workspaceId).eq("provider", provider),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  });

const toState = (row: {
  provider: ProviderKey;
  status: ProviderConnectionState["status"];
  generation: number;
  connectionRef?: string | undefined;
  errorCode?: string | undefined;
}): ProviderConnectionState => ({
  provider: row.provider,
  status: row.status,
  generation: row.generation,
  ...(row.connectionRef === undefined
    ? {}
    : { connectionRef: row.connectionRef }),
  ...(row.errorCode === undefined ? {} : { errorCode: row.errorCode }),
});

const transitionFailure = () =>
  new ValidationFailed({
    field: "generation",
    message: "Provider connection state changed. Refresh and try again.",
  });

const list = FunctionImpl.make(
  databaseSchema,
  connections,
  "list",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const reader = yield* DatabaseReader;
      return yield* reader
        .table("providerConnections")
        .index("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
        .pipe(Effect.orDie);
    }),
);

const begin = FunctionImpl.make(
  databaseSchema,
  connections,
  "begin",
  ({ workspaceId, provider }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "editor"));
      const existing = yield* currentConnection(workspaceId, provider);
      const state = beginConnection(
        existing === null ? undefined : toState(existing),
        provider,
      );
      const now = yield* withConfectClock(Clock.currentTimeMillis);
      const writer = yield* DatabaseWriter;
      if (existing === null) {
        const id = yield* writer
          .table("providerConnections")
          .insert({ workspaceId, ...state, createdAt: now, updatedAt: now })
          .pipe(Effect.orDie);
        const reader = yield* DatabaseReader;
        const inserted = yield* reader
          .table("providerConnections")
          .get(id)
          .pipe(Effect.orDie);
        if (inserted !== null) return inserted;
      } else {
        yield* writer
          .table("providerConnections")
          .patch(existing._id, {
            status: state.status,
            generation: state.generation,
            connectionRef: undefined,
            errorCode: undefined,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
        const reader = yield* DatabaseReader;
        const updated = yield* reader
          .table("providerConnections")
          .get(existing._id)
          .pipe(Effect.orDie);
        if (updated !== null) return updated;
      }
      return yield* new NotFound({
        resource: "providerConnections",
        id: provider,
      });
    }),
);

const complete = FunctionImpl.make(
  databaseSchema,
  connections,
  "complete",
  (args) =>
    Effect.gen(function* () {
      yield* withConfectClock(
        requireWorkspaceAccess(args.workspaceId, "editor"),
      );
      const existing = yield* currentConnection(
        args.workspaceId,
        args.provider,
      );
      if (existing === null) {
        return yield* new NotFound({
          resource: "providerConnections",
          id: args.provider,
        });
      }
      const current = toState(existing);
      const state = yield* Effect.try({
        try: () =>
          completeConnection(current, {
            generation: args.generation,
            ...args.completion,
          }),
        catch: () => transitionFailure(),
      });
      if (state === current) return existing;
      const now = yield* withConfectClock(Clock.currentTimeMillis);
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("providerConnections")
        .patch(existing._id, {
          status: state.status,
          connectionRef: state.connectionRef,
          errorCode: state.errorCode,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      const reader = yield* DatabaseReader;
      const updated = yield* reader
        .table("providerConnections")
        .get(existing._id)
        .pipe(Effect.orDie);
      return updated ?? existing;
    }),
);

const revoke = FunctionImpl.make(
  databaseSchema,
  connections,
  "revoke",
  ({ workspaceId, provider, generation }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "editor"));
      const existing = yield* currentConnection(workspaceId, provider);
      if (existing === null) {
        return yield* new NotFound({
          resource: "providerConnections",
          id: provider,
        });
      }
      const current = toState(existing);
      const state = yield* Effect.try({
        try: () => revokeConnection(current, generation),
        catch: () => transitionFailure(),
      });
      if (state === current) return existing;
      const now = yield* withConfectClock(Clock.currentTimeMillis);
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("providerConnections")
        .patch(existing._id, {
          status: "revoked",
          connectionRef: undefined,
          errorCode: undefined,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      const reader = yield* DatabaseReader;
      const updated = yield* reader
        .table("providerConnections")
        .get(existing._id)
        .pipe(Effect.orDie);
      return updated ?? existing;
    }),
);

export default GroupImpl.make(databaseSchema, connections).pipe(
  Layer.provide(list),
  Layer.provide(begin),
  Layer.provide(complete),
  Layer.provide(revoke),
  GroupImpl.finalize,
);
