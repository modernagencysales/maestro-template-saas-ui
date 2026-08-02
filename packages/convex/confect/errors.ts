import * as Schema from "effect/Schema";

// Schema.Never is the runtime "no recoverable errors" schema; Confect accepts
// codec thunks, so keep the variance bridge in one named place.
export const NoRecoverableError = Schema.Never as unknown as Schema.Codec<
  never,
  never
>;

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {},
) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  "Forbidden",
  {
    reason: Schema.String,
  },
) {}

export class MemberNotInWorkspace extends Schema.TaggedErrorClass<MemberNotInWorkspace>()(
  "MemberNotInWorkspace",
  {
    membershipId: Schema.String,
  },
) {}

/**
 * The membership row belongs to the workspace but is not live (pending, revoked,
 * or soft-deleted). Distinct from MemberNotInWorkspace — "exists here but can't
 * act" is a different client-facing case than "not a member of this workspace".
 */
export class MembershipNotLive extends Schema.TaggedErrorClass<MembershipNotLive>()(
  "MembershipNotLive",
  {
    membershipId: Schema.String,
  },
) {}

export class LastOwnerProtected extends Schema.TaggedErrorClass<LastOwnerProtected>()(
  "LastOwnerProtected",
  {
    workspaceId: Schema.String,
  },
) {}

export class InvitationNotAccessible extends Schema.TaggedErrorClass<InvitationNotAccessible>()(
  "InvitationNotAccessible",
  {},
) {}

export class InvitationNotPending extends Schema.TaggedErrorClass<InvitationNotPending>()(
  "InvitationNotPending",
  {
    invitationId: Schema.String,
  },
) {}

export class InvitationExpired extends Schema.TaggedErrorClass<InvitationExpired>()(
  "InvitationExpired",
  {
    invitationId: Schema.String,
  },
) {}

export class WorkspaceNotFound extends Schema.TaggedErrorClass<WorkspaceNotFound>()(
  "WorkspaceNotFound",
  {
    workspaceId: Schema.String,
  },
) {}

export class ValidationFailed extends Schema.TaggedErrorClass<ValidationFailed>()(
  "ValidationFailed",
  {
    field: Schema.String,
    message: Schema.String,
  },
) {}

export class ProvisioningConflict extends Schema.TaggedErrorClass<ProvisioningConflict>()(
  "ProvisioningConflict",
  {
    resource: Schema.String,
    message: Schema.String,
  },
) {}

export class NotFound extends Schema.TaggedErrorClass<NotFound>()("NotFound", {
  resource: Schema.String,
  id: Schema.String,
}) {}

export class FeatureDisabled extends Schema.TaggedErrorClass<FeatureDisabled>()(
  "FeatureDisabled",
  {
    feature: Schema.String,
  },
) {}

export class ConfigInvalid extends Schema.TaggedErrorClass<ConfigInvalid>()(
  "ConfigInvalid",
  {
    provider: Schema.String,
    message: Schema.String,
  },
) {}
