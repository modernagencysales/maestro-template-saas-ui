import { internalQueryGeneric } from "convex/server";
import { type GenericId, v } from "convex/values";

import {
  requireWorkspaceMember,
  resolveEffectiveWorkspaceRole,
} from "./access/auth";
import type { Role } from "./access/roles";

const minimumRoleByOperation = {
  "brain.pages.createMarkdown": "editor",
  "ops.email.previewBroadcast": "admin",
  "ops.email.dispatchBroadcast": "admin",
} as const satisfies Readonly<Record<string, Role>>;

export const issuerBoundTokenIdentifier = (issuer: string, subject: string) => {
  const normalizedIssuer = issuer.trim();
  const normalizedSubject = subject.trim();
  if (normalizedIssuer === "") throw new Error("issuer is required");
  if (normalizedSubject === "") throw new Error("subject is required");
  return `${normalizedIssuer}|${normalizedSubject}`;
};

export const sessionPrincipal = internalQueryGeneric({
  args: {},
  returns: v.object({ userId: v.id("users"), subject: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("HTTP authentication failed");
    const users = await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .take(2);
    const user = users.find(
      (candidate) => candidate.tokenIdentifier === identity.tokenIdentifier,
    );
    if (user === undefined || user.status !== "active")
      throw new Error("HTTP authentication failed");
    return { userId: user._id, subject: user.subject };
  },
});

export const apiKeyByHash = internalQueryGeneric({
  args: { keyHash: v.string() },
  returns: v.any(),
  handler: async (ctx, { keyHash }) =>
    await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique(),
});

export const authorize = internalQueryGeneric({
  args: {
    operationId: v.string(),
    workspaceId: v.id("workspaces"),
    workspaceSlug: v.optional(v.string()),
    principal: v.union(
      v.object({ kind: v.literal("user"), userId: v.id("users") }),
      v.object({ kind: v.literal("apiKey"), apiKeyId: v.id("apiKeys") }),
    ),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { operationId, workspaceId, workspaceSlug, principal },
  ) => {
    const minimumRole =
      minimumRoleByOperation[
        operationId as keyof typeof minimumRoleByOperation
      ];
    if (minimumRole === undefined)
      throw new Error("HTTP operation is not authorized");

    let userId: GenericId<"users">;
    if (principal.kind === "apiKey") {
      const key = await ctx.db.get("apiKeys", principal.apiKeyId);
      if (
        key === null ||
        key.status !== "active" ||
        key.revokedAt !== null ||
        (key.expiresAt !== null && key.expiresAt <= Date.now()) ||
        key.workspaceId !== workspaceId
      )
        throw new Error("HTTP authorization failed");
      userId = key.createdByUserId as GenericId<"users">;
    } else {
      userId = principal.userId;
    }

    const user = await ctx.db.get("users", userId);
    if (user === null || user.status !== "active")
      throw new Error("HTTP authorization failed");
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (workspace === null) throw new Error("HTTP authorization failed");
    if (workspaceSlug !== undefined && workspace.slug !== workspaceSlug)
      throw new Error("HTTP authorization failed");
    const organizationId =
      workspace.organizationId as GenericId<"organizations">;
    const organization = await ctx.db.get("organizations", organizationId);
    if (organization === null) throw new Error("HTTP authorization failed");
    const [workspaceMembers, organizationMembers] = await Promise.all([
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) =>
          (q.eq("workspaceId", workspace._id) as typeof q).eq("userId", userId),
        )
        .take(2),
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) =>
          (q.eq("organizationId", organization._id) as typeof q).eq(
            "userId",
            userId,
          ),
        )
        .take(2),
    ]);
    requireWorkspaceMember(
      resolveEffectiveWorkspaceRole({
        nowMs: Date.now(),
        userId,
        workspace: {
          id: workspace._id,
          organizationId: workspace.organizationId,
          status: workspace.status,
        },
        organization: { id: organization._id, status: organization.status },
        workspaceMembers,
        organizationMembers,
        guestGrants: [],
      }),
      minimumRole,
    );
    return null;
  },
});
