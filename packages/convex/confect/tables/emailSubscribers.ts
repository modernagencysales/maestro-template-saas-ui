import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const EmailSubscriberStatus = Schema.Literals([
  "subscribed",
  "unsubscribed",
]);

export const EmailSubscriberRow = Schema.Struct({
  workspaceId: Schema.String,
  recipientId: Schema.optional(Schema.String),
  email: Schema.String,
  status: EmailSubscriberStatus,
  consentVersion: Schema.String,
  consentSource: Schema.String,
  consentedAt: Schema.Number,
  unsubscribedAt: Schema.optional(Schema.Number),
  updatedAt: Schema.Number,
});

export default Table.make(() => EmailSubscriberRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_email", ["workspaceId", "email"])
  .index("by_workspace_status", ["workspaceId", "status"])
  .index("by_recipient", ["workspaceId", "recipientId"]);
