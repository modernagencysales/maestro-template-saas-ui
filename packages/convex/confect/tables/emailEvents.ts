import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const EmailEventKind = Schema.Literals([
  "delivery",
  "hard_bounce",
  "soft_bounce",
  "spam_complaint",
  "subscription_change",
  "open",
  "click",
]);

export const EmailEventRow = Schema.Struct({
  fingerprint: Schema.String,
  kind: EmailEventKind,
  recipientHash: Schema.String,
  providerMessageId: Schema.optional(Schema.String),
  receivedAt: Schema.Number,
});

export default Table.make(() => EmailEventRow)
  .index("by_fingerprint", ["fingerprint"])
  .index("by_recipient_kind", ["recipientHash", "kind"]);
