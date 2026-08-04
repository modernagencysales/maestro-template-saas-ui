import { internalQuery } from "./_generated/server";
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
