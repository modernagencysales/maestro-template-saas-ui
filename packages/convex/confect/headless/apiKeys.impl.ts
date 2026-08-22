import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { env } from "../../convex/_generated/server";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import apiKeys from "./apiKeys.spec";
import { verifyApiKeyHash } from "./auth";

const scopesForContractsRole = (role: "primary" | "observer") =>
  role === "primary"
    ? (["workspace:read", "workspace:write"] as const)
    : (["workspace:read"] as const);

const seedLocalContracts = FunctionImpl.make(
  databaseSchema,
  apiKeys,
  "seedLocalContracts",
  ({ namespace, primaryKeyHash, observerKeyHash }) =>
    Effect.gen(function* () {
      if (env.MAESTRO_CONTRACT_TEST !== "1") {
        return yield* Effect.die(
          new Error("seedLocalContracts requires MAESTRO_CONTRACT_TEST=1."),
        );
      }

      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const now = yield* Clock.currentTimeMillis;

      const seedActor = (role: "primary" | "observer", keyHash: string) =>
        Effect.gen(function* () {
          const scopes = scopesForContractsRole(role);
          const slug = `${namespace}-${role}`;
          const subject = `contracts:${namespace}:${role}`;
          const keyId = `api_key_${namespace}_${role}`;
          const existingUser = yield* reader
            .table("users")
            .index("by_subject", (query) => query.eq("subject", subject))
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          const userId: GenericId<"users"> =
            existingUser?._id ??
            (yield* writer
              .table("users")
              .insert({
                subject,
                email: `${slug}@template.local`,
                displayName: `Contracts ${role}`,
                status: "active",
                createdAt: now,
                updatedAt: now,
              })
              .pipe(Effect.orDie));

          const existingOrganization = yield* reader
            .table("organizations")
            .index("by_slug", (query) => query.eq("slug", slug))
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          const organizationId: GenericId<"organizations"> =
            existingOrganization?._id ??
            (yield* writer
              .table("organizations")
              .insert({
                ownerUserId: userId,
                slug,
                name: `Contracts ${role}`,
                status: "active",
                createdAt: now,
                updatedAt: now,
              })
              .pipe(Effect.orDie));

          const existingWorkspace = yield* reader
            .table("workspaces")
            .index("by_slug", (query) => query.eq("slug", slug))
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          const workspaceId: GenericId<"workspaces"> =
            existingWorkspace?._id ??
            (yield* writer
              .table("workspaces")
              .insert({
                organizationId,
                ownerUserId: userId,
                slug,
                name: `Contracts ${role}`,
                status: "active",
                dataClassification: "internal",
                createdAt: now,
                updatedAt: now,
              })
              .pipe(Effect.orDie));

          const organizationMembership = yield* reader
            .table("organizationMembers")
            .index("by_organization_user", (query) =>
              query.eq("organizationId", organizationId).eq("userId", userId),
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          if (organizationMembership === null) {
            yield* writer
              .table("organizationMembers")
              .insert({
                organizationId,
                userId,
                role: "owner",
                status: "active",
                acceptedAt: now,
                revokedAt: null,
                createdAt: now,
                updatedAt: now,
              })
              .pipe(Effect.orDie);
          }

          const workspaceMembership = yield* reader
            .table("workspaceMembers")
            .index("by_workspace_user", (q) =>
              q.eq("workspaceId", workspaceId).eq("userId", userId),
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          if (workspaceMembership === null) {
            yield* writer
              .table("workspaceMembers")
              .insert({
                workspaceId,
                userId,
                role: "owner",
                status: "active",
                acceptedAt: now,
                revokedAt: null,
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
              })
              .pipe(Effect.orDie);
          }

          const existingKey = yield* reader
            .table("apiKeys")
            .index("by_workspace", (query) =>
              query.eq("workspaceId", workspaceId),
            )
            .take(100)
            .pipe(
              Effect.map((keys) => keys.find(({ id }) => id === keyId)),
              Effect.orDie,
            );
          if (existingKey) {
            yield* writer
              .table("apiKeys")
              .patch(existingKey._id, {
                keyHash,
                scopes,
                status: "active",
                createdByUserId: userId,
                expiresAt: null,
                revokedAt: null,
              })
              .pipe(Effect.orDie);
          } else {
            yield* writer
              .table("apiKeys")
              .insert({
                id: keyId,
                workspaceId,
                name: `Local contracts ${role}`,
                keyHash,
                displayPrefix: "contracts",
                scopes,
                status: "active",
                createdByUserId: userId,
                createdAt: now,
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
              })
              .pipe(Effect.orDie);
          }

          return { keyId, workspaceId, userId };
        });

      const primary = yield* seedActor("primary", primaryKeyHash);
      const observer = yield* seedActor("observer", observerKeyHash);
      return { primary, observer };
    }),
);

const resolve = FunctionImpl.make(
  databaseSchema,
  apiKeys,
  "resolve",
  ({ keyHash, workspaceSlug, requiredScope, nowMs }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const rows = yield* reader
        .table("apiKeys")
        .index("by_key_hash", (q) => q.eq("keyHash", keyHash))
        .take(2)
        .pipe(Effect.orDie);
      const verified = yield* Effect.promise(() =>
        verifyApiKeyHash({
          presentedHash: keyHash,
          rows,
          requiredScope,
          nowMs,
        }),
      );
      if (!verified.ok) {
        return {
          ok: false as const,
          code: verified.error.code,
          message: verified.error.message,
        };
      }

      const workspace = yield* reader
        .table("workspaces")
        .index("by_slug", (q) => q.eq("slug", workspaceSlug))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (workspace === null || workspace._id !== verified.workspaceId) {
        return {
          ok: false as const,
          code: "API_KEY_WORKSPACE_MISMATCH" as const,
          message: "API key is bound to a different workspace.",
        };
      }

      const key = rows.find(({ id }) => id === verified.keyId);
      if (!key) {
        return {
          ok: false as const,
          code: "API_KEY_NOT_FOUND" as const,
          message: "API key was not found.",
        };
      }
      return {
        ok: true as const,
        keyId: verified.keyId,
        workspaceId: workspace._id,
        userId: key.createdByUserId as GenericId<"users">,
      };
    }),
);

export default GroupImpl.make(databaseSchema, apiKeys).pipe(
  Layer.provide(seedLocalContracts),
  Layer.provide(resolve),
  GroupImpl.finalize,
);
