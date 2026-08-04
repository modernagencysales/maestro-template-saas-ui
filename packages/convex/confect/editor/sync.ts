import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import {
  resolveEffectiveWorkspaceRole,
  type OrganizationMemberRef,
  type OrganizationRef,
  type WorkspaceMemberRef,
  type WorkspaceRef,
} from "../access/auth";
import { roleAtLeast } from "../access/roles";
import type { DataModel } from "../../convex/_generated/dataModel";
import { parseEditorTarget } from "./documentTargets";
import { editorSyncAccessDenied } from "./errors";

export type EditorRole = "viewer" | "editor";

type EditorAuthCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

const editorSyncAccessTimeMs = 0;
const editorAccessDeniedMessageByRole = {
  viewer: "Editor sync requires workspace membership.",
  editor: "Editor sync requires editor access.",
} satisfies Record<EditorRole, string>;

export const resolveEditorWorkspaceId = async (
  ctx: EditorAuthCtx,
  documentId: string,
): Promise<string | null> => {
  const target = parseEditorTarget(documentId);
  if (target.kind !== "brainPage") return null;
  const pageId = ctx.db.normalizeId("brainPages", target.id);
  if (pageId === null) return null;
  const page = await ctx.db.get(pageId);
  return page?.workspaceId ?? null;
};

export const requireEditorDocumentAccess = async (
  ctx: EditorAuthCtx,
  documentId: string,
  role: EditorRole,
): Promise<void> => {
  const workspaceId = await requireReadableEditorWorkspaceId(ctx, documentId);
  const user = await loadActiveEditorUser(ctx);
  const workspaceRow = await loadEditorWorkspace(ctx, workspaceId);
  const organization = await loadEditorOrganization(
    ctx,
    workspaceRow.organizationId,
  );
  const memberships = await loadEditorMemberships(ctx, {
    workspaceId,
    organizationId: workspaceRow.organizationId,
    userId: user._id,
  });

  requireResolvedEditorAccess(
    resolveEditorAccessRole({
      userId: user._id,
      workspaceRow,
      organization,
      ...memberships,
    }),
    role,
  );
};

const requireReadableEditorWorkspaceId = async (
  ctx: EditorAuthCtx,
  documentId: string,
): Promise<string> =>
  requirePresent(
    await resolveEditorWorkspaceId(ctx, documentId),
    "Editor document target is not readable.",
    "document-readable",
  );

const loadActiveEditorUser = async (ctx: EditorAuthCtx) => {
  const identity = requirePresent(
    await ctx.auth.getUserIdentity(),
    "Editor sync requires authentication.",
    "authentication",
  );
  const user = requirePresent(
    await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .take(2)
      .then(
        (users) =>
          users.find(
            (user) => user.tokenIdentifier === identity.tokenIdentifier,
          ) ?? null,
      ),
    "Editor sync requires a provisioned user.",
    "provisioned-user",
  );

  return requireActiveEditorUser(user);
};

const requireActiveEditorUser = <User extends { readonly status: string }>(
  user: User,
): User => {
  if (user.status !== "active") {
    throw editorSyncAccessDenied(
      "active-user",
      "Editor sync requires an active user.",
    );
  }
  return user;
};

const loadEditorWorkspace = async (ctx: EditorAuthCtx, workspaceId: string) => {
  const workspace = requirePresent(
    ctx.db.normalizeId("workspaces", workspaceId),
    "Editor sync requires an active workspace.",
    "workspace-membership",
  );

  return requirePresent(
    await ctx.db.get(workspace),
    "Editor sync requires an active workspace.",
    "workspace-membership",
  );
};

const loadEditorOrganization = async (
  ctx: EditorAuthCtx,
  organizationId: string,
) => {
  const organization = requirePresent(
    ctx.db.normalizeId("organizations", organizationId),
    "Editor sync requires an active organization.",
    "workspace-membership",
  );

  return requirePresent(
    await ctx.db.get(organization),
    "Editor sync requires an active organization.",
    "workspace-membership",
  );
};

const loadEditorMemberships = async (
  ctx: EditorAuthCtx,
  input: {
    readonly workspaceId: string;
    readonly organizationId: string;
    readonly userId: string;
  },
) => {
  const workspaceMembers = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", input.workspaceId).eq("userId", input.userId),
    )
    .collect();
  const organizationMembers = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_user", (q) =>
      q.eq("organizationId", input.organizationId).eq("userId", input.userId),
    )
    .collect();

  return { workspaceMembers, organizationMembers };
};

const resolveEditorAccessRole = (input: {
  readonly userId: string;
  readonly workspaceRow: Omit<WorkspaceRef, "id"> & {
    readonly _id: string;
  };
  readonly organization: Omit<OrganizationRef, "id"> & {
    readonly _id: string;
  };
  readonly workspaceMembers: readonly WorkspaceMemberRef[];
  readonly organizationMembers: readonly OrganizationMemberRef[];
}) =>
  resolveEffectiveWorkspaceRole({
    nowMs: editorSyncAccessTimeMs,
    userId: input.userId,
    workspace: {
      id: input.workspaceRow._id,
      organizationId: input.workspaceRow.organizationId,
      status: input.workspaceRow.status,
    } satisfies WorkspaceRef,
    organization: {
      id: input.organization._id,
      status: input.organization.status,
    } satisfies OrganizationRef,
    workspaceMembers: input.workspaceMembers,
    organizationMembers: input.organizationMembers,
    guestGrants: [],
  });

const requireResolvedEditorAccess = (
  resolution: ReturnType<typeof resolveEffectiveWorkspaceRole>,
  role: EditorRole,
): void => {
  if (!resolution.ok) {
    throw editorSyncAccessDenied(
      "workspace-membership",
      "Editor sync requires workspace membership.",
    );
  }

  if (!roleAtLeast(resolution.role, role)) {
    throw editorSyncAccessDenied(
      role === "editor" ? "editor-access" : "workspace-membership",
      editorAccessDeniedMessageByRole[role],
    );
  }
};

const requirePresent = <Value>(
  value: Value | null,
  message: string,
  reason: Parameters<typeof editorSyncAccessDenied>[0],
): Value => {
  if (value === null) {
    throw editorSyncAccessDenied(reason, message);
  }
  return value;
};
