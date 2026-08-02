import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import {
  ProvisioningConflict,
  Unauthorized,
  ValidationFailed,
} from "../errors";
import { normalizeEmail } from "./email";
import type { Role } from "./roles";

export type IdentityClaims = {
  readonly subject?: string | null;
  readonly tokenIdentifier?: string | null;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly emailVerified?: boolean | null;
};

export type IdentityProfile = {
  readonly subject: string;
  readonly displayName: string;
  readonly email: string;
};

type UserStatus = "active" | "suspended" | "deleted";
type OrganizationStatus = "active" | "suspended" | "archived";
type MembershipStatus = "pending" | "active" | "revoked";
type WorkspaceStatus = "active" | "archived";
type DataClassification = "public" | "internal" | "confidential";

export type UserProvisioningRow = {
  readonly _id: string;
  readonly subject: string;
  readonly email: string;
  readonly displayName?: string | undefined;
  readonly status: UserStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type OrganizationProvisioningRow = {
  readonly _id: string;
  readonly ownerUserId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type WorkspaceProvisioningRow = {
  readonly _id: string;
  readonly organizationId: string;
  readonly ownerUserId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: WorkspaceStatus;
  readonly dataClassification: DataClassification;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type OrganizationMembershipProvisioningRow = {
  readonly _id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: Role;
  readonly status: MembershipStatus;
  readonly acceptedAt: number | null;
  readonly revokedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type WorkspaceMembershipProvisioningRow = {
  readonly _id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: Role;
  readonly status: MembershipStatus;
  readonly acceptedAt: number | null;
  readonly revokedAt: number | null;
  readonly deletedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type ProvisioningState = {
  readonly user: UserProvisioningRow | null;
  readonly liveOrganization: OrganizationProvisioningRow | null;
  readonly liveWorkspace: WorkspaceProvisioningRow | null;
  readonly organizationMembership: OrganizationMembershipProvisioningRow | null;
  readonly workspaceMembership: WorkspaceMembershipProvisioningRow | null;
};

type InsertPlan<Value> = {
  readonly action: "insert";
  readonly value: Value;
};

type PatchPlan<Value> = {
  readonly action: "patch";
  readonly id: string;
  readonly value: Partial<Value>;
};

type NonePlan = {
  readonly action: "none";
};

export type RowPlan<Value> = InsertPlan<Value> | PatchPlan<Value> | NonePlan;

export type ProvisioningPlan = {
  readonly user: RowPlan<Omit<UserProvisioningRow, "_id">>;
  readonly organization: RowPlan<Omit<OrganizationProvisioningRow, "_id">>;
  readonly workspace: RowPlan<Omit<WorkspaceProvisioningRow, "_id">>;
  readonly organizationMembership: RowPlan<
    Omit<OrganizationMembershipProvisioningRow, "_id">
  >;
  readonly workspaceMembership: RowPlan<
    Omit<WorkspaceMembershipProvisioningRow, "_id">
  >;
};

export const extractIdentityProfile = (
  claims: IdentityClaims | null,
): Effect.Effect<IdentityProfile, Unauthorized | ValidationFailed> =>
  Effect.gen(function* () {
    const subject = claims?.subject ?? claims?.tokenIdentifier ?? null;
    if (subject === null || subject.trim().length === 0) {
      return yield* new Unauthorized();
    }

    const emailResult = normalizeEmail(claims?.email);
    if (emailResult.kind !== "verified" || claims?.emailVerified !== true) {
      return yield* new ValidationFailed({
        field: "email",
        message: "A verified provider email is required for provisioning.",
      });
    }

    const displayName = claims?.name?.trim();
    return {
      subject: subject.trim(),
      displayName:
        displayName !== undefined && displayName.length > 0
          ? displayName
          : emailResult.email,
      email: emailResult.email,
    };
  });

export const buildProvisioningPlan = (input: {
  readonly identity: IdentityProfile;
  readonly state: ProvisioningState;
  readonly now: number;
}): Result.Result<ProvisioningPlan, Unauthorized> => {
  const user = input.state.user;
  if (user?.status === "suspended" || user?.status === "deleted") {
    return Result.fail(new Unauthorized());
  }

  const seed = provisioningSeed(input.identity);
  const userId = user?._id ?? "{userId}";
  const organizationId =
    input.state.liveOrganization?._id ?? "{organizationId}";
  const workspaceId = input.state.liveWorkspace?._id ?? "{workspaceId}";

  return Result.succeed({
    user: planUser(input.identity, user, input.now),
    organization: planOrganization(
      input.state.liveOrganization,
      userId,
      seed,
      input.now,
    ),
    workspace: planWorkspace({
      existing: input.state.liveWorkspace,
      organizationId,
      ownerUserId: userId,
      seed,
      now: input.now,
    }),
    organizationMembership: planOrganizationMembership({
      existing: input.state.organizationMembership,
      organizationId,
      userId,
      now: input.now,
    }),
    workspaceMembership: planWorkspaceMembership({
      existing: input.state.workspaceMembership,
      workspaceId,
      userId,
      now: input.now,
    }),
  });
};

/**
 * Assert that a computed {@link RowPlan} is an insert and return its value.
 * A non-insert plan here is an internal invariant violation (the caller already
 * proved the row is absent), so a plain `throw` is correct: it becomes a
 * genuine defect, never a client-facing typed error. Lives in this pure planner
 * module — not the `.impl.ts` handler — so the `no-throw-in-effect-handler`
 * gate stays satisfied and the throw is unit-testable in isolation.
 */
export const requireInsertValue = <Value>(
  plan:
    | { readonly action: "insert"; readonly value: Value }
    | { readonly action: "patch" }
    | { readonly action: "none" },
  label: string,
): Value => {
  if (plan.action !== "insert") {
    throw new Error(`Expected ${label} provisioning insert plan.`);
  }
  return plan.value;
};

/**
 * Select the single live workspace/organization owned by a user. More than one
 * is a data-integrity conflict (identity provisioning guarantees at most one),
 * so it fails `ProvisioningConflict`. Generic over the row so the org and
 * workspace selectors share one definition instead of a copied filter+guard.
 */
const selectSingleLiveOwned = <
  Row extends { readonly ownerUserId: string; readonly status: string },
>(
  rows: ReadonlyArray<Row>,
  userId: string,
  resource: string,
): Result.Result<Row | null, ProvisioningConflict> => {
  const live = rows.filter(
    (row) => row.ownerUserId === userId && row.status === "active",
  );
  if (live.length > 1) {
    return Result.fail(
      new ProvisioningConflict({
        resource,
        message: `Multiple live owned ${resource} found for identity.`,
      }),
    );
  }
  return Result.succeed(live.at(0) ?? null);
};

export const selectLiveOwnedOrganization = (
  organizations: ReadonlyArray<OrganizationProvisioningRow>,
  userId: string,
): Result.Result<OrganizationProvisioningRow | null, ProvisioningConflict> =>
  selectSingleLiveOwned(organizations, userId, "organizations");

export const selectLiveOwnedWorkspace = (
  workspaces: ReadonlyArray<WorkspaceProvisioningRow>,
  userId: string,
): Result.Result<WorkspaceProvisioningRow | null, ProvisioningConflict> =>
  selectSingleLiveOwned(workspaces, userId, "workspaces");

const planUser = (
  identity: IdentityProfile,
  existing: UserProvisioningRow | null,
  now: number,
): RowPlan<Omit<UserProvisioningRow, "_id">> => {
  if (existing === null) {
    return {
      action: "insert",
      value: {
        subject: identity.subject,
        email: identity.email,
        displayName: identity.displayName,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  const value: {
    email?: string;
    displayName?: string;
    updatedAt?: number;
  } = {};
  if (existing.email !== identity.email) value.email = identity.email;
  if (existing.displayName !== identity.displayName) {
    value.displayName = identity.displayName;
  }
  if (Object.keys(value).length === 0) return { action: "none" };
  return {
    action: "patch",
    id: existing._id,
    value: { ...value, updatedAt: now },
  };
};

const planOrganization = (
  existing: OrganizationProvisioningRow | null,
  ownerUserId: string,
  seed: ProvisioningSeed,
  now: number,
): RowPlan<Omit<OrganizationProvisioningRow, "_id">> =>
  existing === null
    ? {
        action: "insert",
        value: {
          ownerUserId,
          slug: seed.slug,
          name: seed.organizationName,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      }
    : { action: "none" };

const planWorkspace = (input: {
  readonly existing: WorkspaceProvisioningRow | null;
  readonly organizationId: string;
  readonly ownerUserId: string;
  readonly seed: ProvisioningSeed;
  readonly now: number;
}): RowPlan<Omit<WorkspaceProvisioningRow, "_id">> =>
  input.existing === null
    ? {
        action: "insert",
        value: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          slug: input.seed.slug,
          name: input.seed.workspaceName,
          status: "active",
          dataClassification: "internal",
          createdAt: input.now,
          updatedAt: input.now,
        },
      }
    : { action: "none" };

const planOrganizationMembership = (input: {
  readonly existing: OrganizationMembershipProvisioningRow | null;
  readonly organizationId: string;
  readonly userId: string;
  readonly now: number;
}): RowPlan<Omit<OrganizationMembershipProvisioningRow, "_id">> => {
  const activeOwner = {
    organizationId: input.organizationId,
    userId: input.userId,
    role: "owner" as const,
    status: "active" as const,
    acceptedAt: input.now,
    revokedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };

  if (input.existing === null) {
    return { action: "insert", value: activeOwner };
  }
  if (input.existing.role === "owner" && input.existing.status === "active") {
    return { action: "none" };
  }
  return {
    action: "patch",
    id: input.existing._id,
    value: {
      role: "owner",
      status: "active",
      acceptedAt: input.now,
      revokedAt: null,
      updatedAt: input.now,
    },
  };
};

const planWorkspaceMembership = (input: {
  readonly existing: WorkspaceMembershipProvisioningRow | null;
  readonly workspaceId: string;
  readonly userId: string;
  readonly now: number;
}): RowPlan<Omit<WorkspaceMembershipProvisioningRow, "_id">> => {
  const activeOwner = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: "owner" as const,
    status: "active" as const,
    acceptedAt: input.now,
    revokedAt: null,
    deletedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };

  if (input.existing === null) {
    return { action: "insert", value: activeOwner };
  }
  if (
    input.existing.role === "owner" &&
    input.existing.status === "active" &&
    input.existing.deletedAt === null
  ) {
    return { action: "none" };
  }
  return {
    action: "patch",
    id: input.existing._id,
    value: {
      role: "owner",
      status: "active",
      acceptedAt: input.now,
      revokedAt: null,
      deletedAt: null,
      updatedAt: input.now,
    },
  };
};

type ProvisioningSeed = {
  readonly slug: string;
  readonly organizationName: string;
  readonly workspaceName: string;
};

const provisioningSeed = (identity: IdentityProfile): ProvisioningSeed => {
  const suffix = identity.subject.slice(-8).replace(/[^a-zA-Z0-9]/g, "");
  const base = identity.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const fallbackBase = identity.email.split("@")[0] ?? "workspace";
  const slugBase = base.length > 0 ? base : fallbackBase;
  return {
    slug: `${slugBase}-${suffix.length > 0 ? suffix : "starter"}`,
    organizationName: identity.displayName,
    workspaceName: `${identity.displayName} Workspace`,
  };
};
