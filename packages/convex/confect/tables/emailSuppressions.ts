import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const EmailSuppressionReason = Schema.Literals([
  "unsubscribe",
  "hard_bounce",
  "soft_bounce_limit",
  "spam_complaint",
  "subscription_change",
  "operator",
]);

export const EmailSuppressionRow = Schema.Struct({
  email: Schema.String,
  reason: EmailSuppressionReason,
  source: Schema.String,
  active: Schema.Boolean,
  suppressedAt: Schema.Number,
  updatedAt: Schema.Number,
});

export default Table.make(() => EmailSuppressionRow)
  .index("by_email", ["email"])
  .index("by_email_active", ["email", "active"]);
