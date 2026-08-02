import * as Schema from "effect/Schema";

import { Role } from "./roles";

export const UserStatus = Schema.Literals(["active", "suspended", "deleted"]);
export const OrganizationStatus = Schema.Literals([
  "active",
  "suspended",
  "archived",
]);
export const MembershipStatus = Schema.Literals([
  "pending",
  "active",
  "revoked",
]);
export const InvitationStatus = Schema.Literals([
  "pending",
  "accepted",
  "cancelled",
  "declined",
  "revoked",
  "expired",
]);
export const AccessAuditAction = Schema.Literals([
  "member.roleChanged",
  "member.removed",
  "member.ownershipTransferred",
  "invitation.created",
  "invitation.accepted",
  "invitation.declined",
  "invitation.cancelled",
]);
export const AccessAuditSubjectKind = Schema.Literals([
  "workspaceMember",
  "invitation",
]);

const NullableNumber = Schema.NullOr(Schema.Number);
const OptionalString = Schema.optional(Schema.String);

export const UserRow = Schema.Struct({
  subject: Schema.String,
  email: Schema.String,
  displayName: OptionalString,
  status: UserStatus,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  deletedAt: Schema.optional(NullableNumber),
});

export const OrganizationRow = Schema.Struct({
  ownerUserId: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  status: OrganizationStatus,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  archivedAt: Schema.optional(NullableNumber),
});

export const OrganizationMemberRow = Schema.Struct({
  organizationId: Schema.String,
  userId: Schema.String,
  role: Role,
  status: MembershipStatus,
  acceptedAt: NullableNumber,
  revokedAt: NullableNumber,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

export const WorkspaceMemberRow = Schema.Struct({
  workspaceId: Schema.String,
  userId: Schema.String,
  role: Role,
  status: MembershipStatus,
  acceptedAt: NullableNumber,
  revokedAt: NullableNumber,
  deletedAt: NullableNumber,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

export const InvitationRow = Schema.Struct({
  workspaceId: Schema.String,
  organizationId: Schema.String,
  email: Schema.String,
  role: Role,
  status: InvitationStatus,
  tokenHash: Schema.String,
  invitedByUserId: Schema.String,
  acceptedAt: NullableNumber,
  revokedAt: NullableNumber,
  declinedAt: Schema.optional(NullableNumber),
  expiresAt: Schema.Number,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

export const AccessAuditEventRow = Schema.Struct({
  workspaceId: Schema.String,
  action: AccessAuditAction,
  actorUserId: Schema.optional(Schema.String),
  actorEmail: Schema.optional(Schema.String),
  subjectKind: AccessAuditSubjectKind,
  subjectId: Schema.String,
  metadataJson: Schema.String,
  createdAt: Schema.Number,
});
