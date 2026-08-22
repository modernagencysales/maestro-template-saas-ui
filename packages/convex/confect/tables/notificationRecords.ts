import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const NotificationCategory = Schema.Literals([
  "workspace",
  "workflow",
  "billing",
  "security",
  "system",
]);

export const NotificationPriority = Schema.Literals(["low", "normal", "high"]);

export const NotificationDeliveryState = Schema.Literals([
  "fake",
  "test",
  "live-ready",
]);

export const NotificationRecordRow = Schema.Struct({
  workspaceId: Schema.String,
  recipientId: Schema.String,
  idempotencyKey: Schema.String,
  title: Schema.String,
  body: Schema.String,
  category: NotificationCategory,
  priority: NotificationPriority,
  delivery: NotificationDeliveryState,
  createdAt: Schema.Number,
  createdAtDescending: Schema.Number,
  readAt: Schema.optional(Schema.Number),
  actionHref: Schema.optional(Schema.String),
});

export default Table.make(() => NotificationRecordRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_recipient_created", [
    "workspaceId",
    "recipientId",
    "createdAtDescending",
  ])
  .index("by_recipient_read", ["workspaceId", "recipientId", "readAt"])
  .index("by_idempotency", ["workspaceId", "recipientId", "idempotencyKey"])
  .index("by_category", ["workspaceId", "category"]);
