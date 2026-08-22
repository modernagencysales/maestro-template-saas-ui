import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import notificationsImpl from "../confect/ops/notifications.impl";
import notifications, {
  ListNotificationsArgs,
  MarkNotificationReadArgs,
  NotificationCenterReturn,
  NotificationPreferenceReturn,
  NotificationRecordReturn,
  RecordNotificationArgs,
  UpdateNotificationPreferenceArgs,
} from "../confect/ops/notifications.spec";
import { ValidationFailed } from "../confect/errors";
import notificationPreferences from "../confect/tables/notificationPreferences";
import notificationRecords, {
  NotificationRecordRow,
} from "../confect/tables/notificationRecords";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

describe("notification Confect contracts", () => {
  it("declares durable notification record and preference indexes", () => {
    expect(notificationRecords.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_recipient_created: [
        "workspaceId",
        "recipientId",
        "createdAtDescending",
      ],
      by_recipient_read: ["workspaceId", "recipientId", "readAt"],
      by_idempotency: ["workspaceId", "recipientId", "idempotencyKey"],
      by_category: ["workspaceId", "category"],
    });
    expect(notificationPreferences.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_recipient: ["workspaceId", "recipientId"],
      by_recipient_category: ["workspaceId", "recipientId", "category"],
      by_category: ["workspaceId", "category"],
    });
  });

  it("validates notification args, rows, returns, and preferences with Effect schemas", () => {
    expect(
      Schema.decodeUnknownSync(RecordNotificationArgs)({
        workspaceId: "workspaces_123",
        recipientId: "users_123",
        idempotencyKey: "notification.workflow.done",
        title: "Workflow done",
        body: "The launch workflow is ready for review.",
        category: "workflow",
        priority: "normal",
        delivery: "fake",
        actionHref: "/runs/run_123",
      }),
    ).toMatchObject({ category: "workflow" });

    expect(
      Schema.decodeUnknownSync(ListNotificationsArgs)({
        workspaceId: "workspaces_123",
        limit: 20,
      }),
    ).toMatchObject({ limit: 20 });
    expect(() =>
      Schema.decodeUnknownSync(ListNotificationsArgs)({
        workspaceId: "workspaces_123",
        limit: 0.5,
      }),
    ).toThrow();

    expect(
      Schema.decodeUnknownSync(MarkNotificationReadArgs)({
        workspaceId: "workspaces_123",
        notificationId: "notificationRecords_123",
      }),
    ).toMatchObject({ notificationId: "notificationRecords_123" });

    expect(
      Schema.decodeUnknownSync(UpdateNotificationPreferenceArgs)({
        workspaceId: "workspaces_123",
        category: "security",
        inApp: true,
        email: true,
        digest: false,
      }),
    ).toMatchObject({ category: "security", digest: false });

    expect(
      Schema.decodeUnknownSync(NotificationRecordRow)({
        workspaceId: "workspaces_123",
        recipientId: "users_123",
        idempotencyKey: "notification.workflow.done",
        title: "Workflow done",
        body: "The launch workflow is ready for review.",
        category: "workflow",
        priority: "normal",
        delivery: "fake",
        createdAt: 1,
        createdAtDescending: -1,
      }),
    ).toMatchObject({ priority: "normal" });

    expect(
      Schema.decodeUnknownSync(NotificationRecordReturn)({
        notificationId: "notificationRecords_123",
        workspaceId: "workspaces_123",
        recipientId: "users_123",
        idempotencyKey: "notification.workflow.done",
        title: "Workflow done",
        body: "The launch workflow is ready for review.",
        category: "workflow",
        priority: "normal",
        delivery: "fake",
        createdAt: 1,
        readAt: 2,
      }),
    ).toMatchObject({ readAt: 2 });

    expect(
      Schema.decodeUnknownSync(NotificationCenterReturn)({
        notifications: [],
        preferences: [
          {
            workspaceId: "workspaces_123",
            recipientId: "users_123",
            category: "security",
            inApp: true,
            email: true,
            digest: false,
          },
        ],
        summary: {
          total: 0,
          unread: 0,
          mutedCategories: ["workflow"],
          liveDeliveryReady: false,
        },
      }),
    ).toMatchObject({ summary: { unread: 0 } });

    expect(
      Schema.decodeUnknownSync(NotificationPreferenceReturn)({
        preferenceId: "notificationPreferences_123",
        workspaceId: "workspaces_123",
        recipientId: "users_123",
        category: "security",
        inApp: true,
        email: true,
        digest: false,
        updatedAt: 1,
      }),
    ).toMatchObject({ email: true });
  });

  it("registers notification functions and exports a finalized implementation", () => {
    expect(JSON.stringify(notifications)).toContain("recordInternal");
    expect(JSON.stringify(notifications)).toContain("markRead");
    expect(JSON.stringify(notifications)).toContain("updatePreference");
    expect(Layer.isLayer(notificationsImpl)).toBe(true);
  });

  it("rejects padded notification idempotency keys before insert", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );

      return yield* confect
        .mutation(refs.internal.ops.notifications.recordInternal, {
          workspaceId: seeded.workspaceId,
          recipientId: seeded.memberUserId,
          idempotencyKey: " notification.workflow.done ",
          title: "Workflow done",
          body: "The launch workflow is ready for review.",
          category: "workflow",
          priority: "normal",
          delivery: "fake",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });

  it("persists notification records, read receipts, and preferences by workspace recipient", async () => {
    const now = 1_782_924_800_000;
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const notification = yield* confect.mutation(
        refs.internal.ops.notifications.recordInternal,
        {
          workspaceId: seeded.workspaceId,
          recipientId: seeded.memberUserId,
          idempotencyKey: "notification.workflow.done",
          title: "Workflow done",
          body: "The launch workflow is ready for review.",
          category: "workflow",
          priority: "normal",
          delivery: "live-ready",
          actionHref: "/runs/run_123",
        },
      );
      const duplicateNotification = yield* confect.mutation(
        refs.internal.ops.notifications.recordInternal,
        {
          workspaceId: seeded.workspaceId,
          recipientId: seeded.memberUserId,
          idempotencyKey: "notification.workflow.done",
          title: "Different title ignored",
          body: "Different body ignored because the key is already recorded.",
          category: "workflow",
          priority: "high",
          delivery: "fake",
        },
      );
      const outsiderNotification = yield* confect.mutation(
        refs.internal.ops.notifications.recordInternal,
        {
          workspaceId: seeded.workspaceId,
          recipientId: seeded.outsiderUserId,
          idempotencyKey: "notification.workflow.done",
          title: "Workflow done for outsider",
          body: "The launch workflow is ready for a different recipient.",
          category: "workflow",
          priority: "normal",
          delivery: "fake",
        },
      );
      const initialCenter = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .query(refs.public.ops.notifications.list, {
          workspaceId: seeded.workspaceId,
        });
      const readNotification = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.ops.notifications.markRead, {
          workspaceId: seeded.workspaceId,
          notificationId: notification.notificationId,
        });
      const preference = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.ops.notifications.updatePreference, {
          workspaceId: seeded.workspaceId,
          category: "workflow",
          inApp: false,
          email: true,
          digest: true,
        });
      const mutedCenter = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .query(refs.public.ops.notifications.list, {
          workspaceId: seeded.workspaceId,
        });

      return {
        notification,
        duplicateNotification,
        outsiderNotification,
        initialCenter,
        readNotification,
        preference,
        mutedCenter,
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.notification.notificationId).toEqual(
      expect.stringContaining("notificationRecords"),
    );
    expect(result.duplicateNotification).toMatchObject({
      notificationId: result.notification.notificationId,
      title: "Workflow done",
      delivery: "live-ready",
    });
    expect(result.outsiderNotification).toMatchObject({
      recipientId: expect.stringContaining("users"),
      title: "Workflow done for outsider",
    });
    expect(result.outsiderNotification.notificationId).not.toBe(
      result.notification.notificationId,
    );
    expect(result.initialCenter).toMatchObject({
      notifications: [
        {
          notificationId: result.notification.notificationId,
          category: "workflow",
        },
      ],
      summary: {
        total: 1,
        unread: 1,
        mutedCategories: [],
        liveDeliveryReady: true,
      },
    });
    expect(result.readNotification).toMatchObject({
      notificationId: result.notification.notificationId,
      readAt: expect.any(Number),
    });
    expect(result.preference).toMatchObject({
      category: "workflow",
      inApp: false,
      email: true,
      digest: true,
    });
    expect(result.mutedCenter).toMatchObject({
      notifications: [],
      summary: {
        total: 0,
        unread: 0,
        mutedCategories: ["workflow"],
        liveDeliveryReady: false,
      },
    });
  });
});
