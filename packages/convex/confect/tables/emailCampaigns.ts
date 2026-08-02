import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const EmailCampaignStatus = Schema.Literals([
  "preparing",
  "sending",
  "sent",
  "partial",
  "failed",
]);

export const EmailCampaignRow = Schema.Struct({
  workspaceId: Schema.String,
  createdByUserId: Schema.String,
  idempotencyKey: Schema.String,
  templateAlias: Schema.String,
  subject: Schema.String,
  preheader: Schema.String,
  textBody: Schema.String,
  htmlBody: Schema.String,
  status: EmailCampaignStatus,
  recipientCount: Schema.Number,
  acceptedCount: Schema.Number,
  failedCount: Schema.Number,
  createdAt: Schema.Number,
  createdAtDescending: Schema.Number,
  updatedAt: Schema.Number,
});

export default Table.make(() => EmailCampaignRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_created", ["workspaceId", "createdAtDescending"])
  .index("by_idempotency", ["workspaceId", "idempotencyKey"]);
