import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const EmailDeliveryStatus = Schema.Literals([
  "pending",
  "accepted",
  "transient_failure",
  "permanent_failure",
]);

export const EmailDeliveryKind = Schema.Literals([
  "transactional",
  "broadcast",
]);

export const EmailDeliveryRow = Schema.Struct({
  workspaceId: Schema.String,
  campaignId: Schema.optional(Schema.String),
  subscriberId: Schema.optional(Schema.String),
  recipientId: Schema.optional(Schema.String),
  recipientHash: Schema.String,
  kind: EmailDeliveryKind,
  idempotencyKey: Schema.String,
  templateAlias: Schema.String,
  status: EmailDeliveryStatus,
  providerMessageId: Schema.optional(Schema.String),
  errorCode: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(Schema.String),
  attemptedAt: Schema.Number,
  updatedAt: Schema.Number,
});

export default Table.make(() => EmailDeliveryRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_idempotency", ["workspaceId", "idempotencyKey"])
  .index("by_campaign_status", ["campaignId", "status"])
  .index("by_campaign_subscriber", ["campaignId", "subscriberId"])
  .index("by_recipient_kind", ["recipientHash", "kind"]);
