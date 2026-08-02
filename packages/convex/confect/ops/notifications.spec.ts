import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  Forbidden,
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import {
  NotificationCategory,
  NotificationDeliveryState,
  NotificationPriority,
} from "../tables/notificationRecords";

const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));
const NotificationError = Schema.Union([
  Unauthorized,
  Forbidden,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
]);

export const ListNotificationsArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0)),
    ),
  ),
});

export const RecordNotificationArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  recipientId: Id("users"),
  idempotencyKey: NonEmptyString,
  title: NonEmptyString,
  body: NonEmptyString,
  category: NotificationCategory,
  priority: NotificationPriority,
  delivery: NotificationDeliveryState,
  actionHref: Schema.optional(NonEmptyString),
});

export const MarkNotificationReadArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  notificationId: Id("notificationRecords"),
});

export const UpdateNotificationPreferenceArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  category: NotificationCategory,
  inApp: Schema.Boolean,
  email: Schema.Boolean,
  digest: Schema.Boolean,
});

export const NotificationRecordReturn = Schema.Struct({
  notificationId: Id("notificationRecords"),
  workspaceId: Id("workspaces"),
  recipientId: Id("users"),
  idempotencyKey: Schema.String,
  title: Schema.String,
  body: Schema.String,
  category: NotificationCategory,
  priority: NotificationPriority,
  delivery: NotificationDeliveryState,
  createdAt: Schema.Number,
  readAt: Schema.optional(Schema.Number),
  actionHref: Schema.optional(Schema.String),
});

export const NotificationPreferenceReturn = Schema.Struct({
  preferenceId: Id("notificationPreferences"),
  workspaceId: Id("workspaces"),
  recipientId: Id("users"),
  category: NotificationCategory,
  inApp: Schema.Boolean,
  email: Schema.Boolean,
  digest: Schema.Boolean,
  updatedAt: Schema.Number,
});

export const NotificationPreferenceView = Schema.Struct({
  preferenceId: Schema.optional(Id("notificationPreferences")),
  workspaceId: Id("workspaces"),
  recipientId: Id("users"),
  category: NotificationCategory,
  inApp: Schema.Boolean,
  email: Schema.Boolean,
  digest: Schema.Boolean,
  updatedAt: Schema.optional(Schema.Number),
});

export const NotificationCenterSummaryReturn = Schema.Struct({
  total: Schema.Number,
  unread: Schema.Number,
  mutedCategories: Schema.Array(NotificationCategory),
  liveDeliveryReady: Schema.Boolean,
});

export const NotificationCenterReturn = Schema.Struct({
  notifications: Schema.Array(NotificationRecordReturn),
  preferences: Schema.Array(NotificationPreferenceView),
  summary: NotificationCenterSummaryReturn,
});

const list = FunctionSpec.publicQuery({
  name: "list",
  args: () => ListNotificationsArgs,
  returns: () => NotificationCenterReturn,
  error: () => NotificationError,
});

const recordInternal = FunctionSpec.internalMutation({
  name: "recordInternal",
  args: () => RecordNotificationArgs,
  returns: () => NotificationRecordReturn,
  error: () => Schema.Union([ValidationFailed]),
});

const markRead = FunctionSpec.publicMutation({
  name: "markRead",
  args: () => MarkNotificationReadArgs,
  returns: () => NotificationRecordReturn,
  error: () => NotificationError,
});

const updatePreference = FunctionSpec.publicMutation({
  name: "updatePreference",
  args: () => UpdateNotificationPreferenceArgs,
  returns: () => NotificationPreferenceReturn,
  error: () => NotificationError,
});

export default GroupSpec.make()
  .addFunction(list)
  .addFunction(recordInternal)
  .addFunction(markRead)
  .addFunction(updatePreference);
