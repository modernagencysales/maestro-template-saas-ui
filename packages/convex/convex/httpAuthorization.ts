import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

import {
  requireWorkspaceMember,
  resolveEffectiveWorkspaceRole,
} from "../confect/access/auth";
import type { Role } from "../confect/access/roles";

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

export const backfillTokenIdentifiers = internalMutation({
  args: {
    identities: v.array(
      v.object({
        userId: v.id("users"),
        issuer: v.string(),
        subject: v.string(),
      }),
    ),
  },
  handler: async (ctx, { identities }) => {
    if (identities.length > 100)
      throw new Error("backfill batch exceeds 100 users");
    for (const identity of identities) {
      const user = await ctx.db.get("users", identity.userId);
      if (user === null || user.subject !== identity.subject)
        throw new Error(`trusted subject mismatch for ${identity.userId}`);
      const tokenIdentifier = issuerBoundTokenIdentifier(
        identity.issuer,
        identity.subject,
      );
      const current = (user as { readonly tokenIdentifier?: string })
        .tokenIdentifier;
      if (current !== undefined && current !== tokenIdentifier)
        throw new Error(`token identifier mismatch for ${identity.userId}`);
      await ctx.db.patch("users", identity.userId, { tokenIdentifier });
    }
    return { updated: identities.length };
  },
});

export const sessionPrincipal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("HTTP authentication failed");
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user === null || user.status !== "active")
      throw new Error("HTTP authentication failed");
    return { userId: user._id, subject: user.subject };
  },
});

export const apiKeyByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) =>
    await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique(),
});

export const authorize = internalQuery({
  args: { operationId: v.string(), workspaceId: v.string() },
  handler: async (ctx, { operationId, workspaceId }) => {
    const minimumRole =
      minimumRoleByOperation[
        operationId as keyof typeof minimumRoleByOperation
      ];
    if (minimumRole === undefined)
      throw new Error("HTTP operation is not authorized");
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("HTTP authentication failed");
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user === null || user.status !== "active")
      throw new Error("HTTP authorization failed");
    const workspace = await ctx.db.get(workspaceId as Id<"workspaces">);
    if (workspace === null) throw new Error("HTTP authorization failed");
    const organization = await ctx.db.get(
      workspace.organizationId as Id<"organizations">,
    );
    if (organization === null) throw new Error("HTTP authorization failed");
    const [workspaceMembers, organizationMembers] = await Promise.all([
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", workspace._id).eq("userId", user._id),
        )
        .collect(),
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) =>
          q.eq("organizationId", organization._id).eq("userId", user._id),
        )
        .collect(),
    ]);
    requireWorkspaceMember(
      resolveEffectiveWorkspaceRole({
        nowMs: Date.now(),
        userId: user._id,
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
