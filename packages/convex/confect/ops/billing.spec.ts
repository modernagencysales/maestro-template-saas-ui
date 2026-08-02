import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

import { Id } from "../_generated/id";
import {
  MemberNotInWorkspace,
  Unauthorized,
  WorkspaceNotFound,
} from "../errors";

const NonEmptyString = S.String.pipe(S.minLength(1));
const NonNegativeNumber = S.Number.pipe(S.greaterThanOrEqualTo(0));
const Provider = S.Literal("openrouter", "dodo", "email", "storage");
const EntitlementSource = S.Literal("fake", "dodo", "manual");
const EntitlementStatus = S.Literal("active", "paused", "revoked");
const WebhookStatus = S.Literal("processed", "duplicate", "failed");

export const RecordUsageArgs = S.Struct({
  workspaceId: Id("workspaces"),
  idempotencyKey: NonEmptyString,
  provider: Provider,
  units: NonNegativeNumber,
  costCredits: NonNegativeNumber,
  entitlementKey: NonEmptyString,
});

export const ApplyWebhookArgs = S.Struct({
  workspaceId: NonEmptyString,
  provider: S.Literal("dodo"),
  eventId: NonEmptyString,
  eventType: NonEmptyString,
  signatureTimestamp: NonEmptyString,
  dedupeKey: NonEmptyString,
});

export const GrantEntitlementArgs = S.Struct({
  workspaceId: NonEmptyString,
  entitlementKey: NonEmptyString,
  featureKey: NonEmptyString,
  limit: NonNegativeNumber,
  source: EntitlementSource,
});

export const CheckSeatArgs = S.Struct({
  workspaceId: NonEmptyString,
  currentSeats: NonNegativeNumber,
  requestedSeats: NonNegativeNumber,
  seatLimit: NonNegativeNumber,
});

export const UsageRecordReturn = S.Struct({
  workspaceId: S.String,
  usageEventId: S.String,
  ledgerEntryId: S.String,
  idempotencyKey: S.String,
  provider: Provider,
  units: S.Number,
  costCredits: S.Number,
  entitlementKey: S.String,
  appendOnly: S.Literal(true),
  createdAt: S.Number,
});

export const BillingWebhookReturn = S.Struct({
  workspaceId: S.String,
  provider: S.Literal("dodo"),
  eventId: S.String,
  eventType: S.String,
  signatureTimestamp: S.String,
  dedupeKey: S.String,
  status: WebhookStatus,
  createdAt: S.Number,
});

export const EntitlementReturn = S.Struct({
  workspaceId: S.String,
  entitlementKey: S.String,
  featureKey: S.String,
  limit: S.Number,
  used: S.Number,
  source: EntitlementSource,
  status: EntitlementStatus,
  createdAt: S.Number,
});

export const SeatCheckReturn = S.Struct({
  workspaceId: S.String,
  allowed: S.Boolean,
  currentSeats: S.Number,
  requestedSeats: S.Number,
  seatLimit: S.Number,
});

export namespace BillingError {
  export class DuplicateWebhook extends S.TaggedError<DuplicateWebhook>()(
    "DuplicateWebhook",
    {
      dedupeKey: S.String,
    },
  ) {}

  export class InsufficientCredits extends S.TaggedError<InsufficientCredits>()(
    "InsufficientCredits",
    {
      availableCredits: S.Number,
      requestedCredits: S.Number,
    },
  ) {}

  export class SeatLimitExceeded extends S.TaggedError<SeatLimitExceeded>()(
    "SeatLimitExceeded",
    {
      currentSeats: S.Number,
      requestedSeats: S.Number,
      seatLimit: S.Number,
    },
  ) {}

  export class ValidationFailed extends S.TaggedError<ValidationFailed>()(
    "ValidationFailed",
    {
      field: S.String,
      message: S.String,
    },
  ) {}

  export const Schema = S.Union(
    DuplicateWebhook,
    InsufficientCredits,
    MemberNotInWorkspace,
    SeatLimitExceeded,
    Unauthorized,
    ValidationFailed,
    WorkspaceNotFound,
  );
}

const recordUsage = FunctionSpec.publicMutation({
  name: "recordUsage",
  args: () => RecordUsageArgs,
  returns: () => UsageRecordReturn,
  error: () => BillingError.Schema,
});

const applyWebhook = FunctionSpec.internalMutation({
  name: "applyWebhook",
  args: () => ApplyWebhookArgs,
  returns: () => BillingWebhookReturn,
  error: () => BillingError.Schema,
});

const grantEntitlement = FunctionSpec.publicMutation({
  name: "grantEntitlement",
  args: () => GrantEntitlementArgs,
  returns: () => EntitlementReturn,
  error: () => BillingError.Schema,
});

const checkSeat = FunctionSpec.publicQuery({
  name: "checkSeat",
  args: () => CheckSeatArgs,
  returns: () => SeatCheckReturn,
  error: () => BillingError.Schema,
});

export default GroupSpec.make()
  .addFunction(recordUsage)
  .addFunction(applyWebhook)
  .addFunction(grantEntitlement)
  .addFunction(checkSeat);
