import { useMemo, useState } from "react";
import { Card, Stack, Text } from "@saas-ui/react";
import {
  templateConfectRefs,
  type TemplateConfectRefs,
} from "@maestro-template/convex/refs";
import {
  buildNotificationCenterView,
  defaultNotificationPreferences,
  markNotificationRead,
  type NotificationRecord,
} from "@maestro-template/notifications";
import type { Ref } from "@confect/core";
import {
  classifyConfectMutationResult,
  normalizeMutationError,
  notifyTemplateMutation,
  type TemplateDataState,
  useTemplateMutation,
  useTemplateQuery,
} from "../../adapters/confect-state";
import { describeTypedFailure } from "../../adapters/failure-message";
import { isConvexConfigured } from "../../env";
import { useWorkspace } from "../../providers/workspace";

type ListNotificationsRef =
  TemplateConfectRefs["public"]["ops"]["notifications"]["list"];
type MarkReadRef =
  TemplateConfectRefs["public"]["ops"]["notifications"]["markRead"];
type NotificationCenterData = Ref.Returns<ListNotificationsRef>;
type NotificationCenterError = Ref.Error<ListNotificationsRef>;
type NotificationRecordData = NotificationCenterData["notifications"][number];
type NotificationPreferenceData = NotificationCenterData["preferences"][number];
type WorkspaceId = Ref.Args<ListNotificationsRef>["workspaceId"];
type NotificationId = Ref.Args<MarkReadRef>["notificationId"];

type PlatformNotification = Readonly<{
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  delivery: string;
  createdAt: string;
  readAt?: string;
  actionHref?: string;
}>;
type PlatformNotificationPreference = Readonly<{
  category: string;
  inApp: boolean;
  email: boolean;
  digest: boolean;
}>;
type TemplateToastApi = Readonly<{
  notify(input: {
    title: string;
    description?: string;
    tone?: string;
    announcement?:
      string | { message: string; priority?: "assertive" | "polite" };
  }): string;
}>;
const useTemplateToast = (): TemplateToastApi => ({
  notify: () => "golden-toast",
});

function TemplateNotificationCenter({
  notifications,
  onMarkRead,
  summary,
}: {
  notifications: readonly PlatformNotification[];
  onMarkRead: (id: string) => void;
  preferences: readonly PlatformNotificationPreference[];
  summary: { readonly unread: number };
}) {
  return (
    <Stack gap="3" aria-label="Notifications">
      {notifications.map((notification) => (
        <Card.Root key={notification.id} variant="subtle">
          <Card.Body>
            <Stack gap="2">
              <Text fontWeight="semibold">{notification.title}</Text>
              <Text color="fg.muted">{notification.body}</Text>
              {!notification.readAt ? (
                <Button
                  size="sm"
                  width="fit-content"
                  onClick={() => onMarkRead(notification.id)}
                >
                  Mark read
                </Button>
              ) : null}
            </Stack>
          </Card.Body>
        </Card.Root>
      ))}
      <Text color="fg.muted">Unread: {summary.unread}</Text>
    </Stack>
  );
}

type NotificationCenterViewModel = {
  readonly notifications: readonly PlatformNotification[];
  readonly preferences: readonly PlatformNotificationPreference[];
  readonly summary: NotificationCenterData["summary"];
  readonly live: boolean;
  readonly status:
    | "unconfigured"
    | "waiting_for_workspace"
    | "loading"
    | "ready"
    | "empty"
    | "unavailable";
  readonly detail?: string;
};

const fakeNotifications: readonly NotificationRecord[] = [
  {
    id: "notification_workflow_ready",
    workspaceId: "workspace_template",
    recipientId: "user_template_admin",
    title: "Workflow run ready",
    body: "The sample GTM workflow finished in fake mode and is ready for review.",
    category: "workflow",
    priority: "normal",
    delivery: "fake",
    createdAt: "2026-07-05T14:00:00.000Z",
    actionHref: "/runs",
  },
  {
    id: "notification_provider_review",
    workspaceId: "workspace_template",
    recipientId: "user_template_admin",
    title: "Provider review needed",
    body: "Email delivery is still recorded-only until domain and sender posture are approved.",
    category: "system",
    priority: "high",
    delivery: "test",
    createdAt: "2026-07-05T13:30:00.000Z",
  },
  {
    id: "notification_billing_fake",
    workspaceId: "workspace_template",
    recipientId: "user_template_admin",
    title: "Billing remains fake-safe",
    body: "Dodo checkout is disabled until a fork completes the live billing checklist.",
    category: "billing",
    priority: "low",
    delivery: "fake",
    createdAt: "2026-07-05T12:00:00.000Z",
    readAt: "2026-07-05T12:10:00.000Z",
    actionHref: "/billing",
  },
];

const toPlatformNotification = (
  notification: NotificationRecord,
): PlatformNotification => ({
  id: notification.id,
  title: notification.title,
  body: notification.body,
  category: notification.category,
  priority: notification.priority,
  delivery: notification.delivery,
  createdAt: notification.createdAt,
  ...(notification.readAt === undefined ? {} : { readAt: notification.readAt }),
  ...(notification.actionHref === undefined
    ? {}
    : { actionHref: notification.actionHref }),
});

const toPlatformConfectNotification = (
  notification: NotificationRecordData,
): PlatformNotification => ({
  id: notification.notificationId,
  title: notification.title,
  body: notification.body,
  category: notification.category,
  priority: notification.priority,
  delivery: notification.delivery,
  createdAt: new Date(notification.createdAt).toISOString(),
  ...(notification.readAt === undefined
    ? {}
    : { readAt: new Date(notification.readAt).toISOString() }),
  ...(notification.actionHref === undefined
    ? {}
    : { actionHref: notification.actionHref }),
});

const toPlatformPreference = (
  preference: (typeof defaultNotificationPreferences)[number],
): PlatformNotificationPreference => ({
  category: preference.category,
  inApp: preference.inApp,
  email: preference.email,
  digest: preference.digest,
});

const toPlatformConfectPreference = (
  preference: NotificationPreferenceData,
): PlatformNotificationPreference => ({
  category: preference.category,
  inApp: preference.inApp,
  email: preference.email,
  digest: preference.digest,
});

export const fakeNotificationCenterView = (): NotificationCenterViewModel => {
  const view = buildNotificationCenterView({
    notifications: fakeNotifications,
    preferences: defaultNotificationPreferences,
  });

  return {
    notifications: view.notifications.map(toPlatformNotification),
    preferences: view.preferences.map(toPlatformPreference),
    summary: view.summary,
    live: false,
    status: "unconfigured",
  };
};

export const presentNotificationCenter = (
  state: TemplateDataState<NotificationCenterData, NotificationCenterError>,
): NotificationCenterViewModel => {
  if (state.status === "skipped") {
    return fakeNotificationCenterView();
  }

  if (state.status === "loading") {
    return {
      ...fakeNotificationCenterView(),
      status: "loading",
    };
  }

  if (state.status === "empty") {
    return {
      notifications: [],
      preferences: state.data.preferences.map(toPlatformConfectPreference),
      summary: state.data.summary,
      live: true,
      status: "empty",
    };
  }

  if (state.status === "ready") {
    return {
      notifications: state.data.notifications.map(
        toPlatformConfectNotification,
      ),
      preferences: state.data.preferences.map(toPlatformConfectPreference),
      summary: state.data.summary,
      live: true,
      status: "ready",
    };
  }

  return {
    ...fakeNotificationCenterView(),
    status: "unavailable",
    detail:
      state.status === "typed_failure"
        ? notificationFailureMessage(state.error)
        : state.message,
  };
};

export function NotificationCenterSurface() {
  const workspace = useWorkspace();
  const toast = useTemplateToast();
  const [notifications, setNotifications] =
    useState<readonly NotificationRecord[]>(fakeNotifications);
  const workspaceId =
    workspace.status === "ready"
      ? (workspace.activeWorkspaceId as WorkspaceId)
      : null;
  const liveQueryEnabled = isConvexConfigured() && workspaceId !== null;
  const markRead = useTemplateMutation(
    templateConfectRefs.public.ops.notifications.markRead,
  );
  const liveState = useTemplateQuery(
    templateConfectRefs.public.ops.notifications.list,
    liveQueryEnabled && workspaceId !== null
      ? { workspaceId, limit: 50 }
      : "skip",
    {
      isEmpty: (data) => data.notifications.length === 0,
    },
  );
  const fakeView = useMemo(() => {
    const view = buildNotificationCenterView({
      notifications,
      preferences: defaultNotificationPreferences,
    });

    return {
      notifications: view.notifications.map(toPlatformNotification),
      preferences: view.preferences.map(toPlatformPreference),
      summary: view.summary,
      live: false,
      status:
        workspace.status === "ready" ? "unconfigured" : "waiting_for_workspace",
    } satisfies NotificationCenterViewModel;
  }, [notifications, workspace.status]);
  const view = liveQueryEnabled
    ? presentNotificationCenter(liveState)
    : fakeView;

  return (
    <>
      {view.status === "loading" ? (
        <p className="template-platform-empty">
          Connecting to notifications...
        </p>
      ) : null}
      {view.status === "waiting_for_workspace" ? (
        <p className="template-platform-empty">Preparing workspace inbox...</p>
      ) : null}
      {view.status === "unavailable" && view.detail ? (
        <p className="template-platform-empty">
          Notification backend unavailable: {view.detail}
        </p>
      ) : null}
      <TemplateNotificationCenter
        notifications={view.notifications}
        onMarkRead={(notificationId) => {
          if (view.live && workspaceId !== null) {
            void markRead({
              workspaceId,
              notificationId: notificationId as NotificationId,
            })
              .then((result) => {
                const state = classifyConfectMutationResult(result);
                notifyTemplateMutation({
                  copy: notificationMarkReadToastCopy,
                  state,
                  toast,
                });
              })
              .catch((error: unknown) => {
                notifyTemplateMutation({
                  copy: notificationMarkReadToastCopy,
                  state: normalizeMutationError(error),
                  toast,
                });
              });
            return;
          }
          setNotifications((current) =>
            current.map((notification) =>
              notification.id === notificationId
                ? markNotificationRead({
                    notification,
                    readAt: new Date().toISOString(),
                  })
                : notification,
            ),
          );
          toast.notify({
            title: "Notification marked read",
            description:
              "The fake-safe starter inbox updated its local read state.",
            tone: "success",
            announcement: "Notification marked read.",
          });
        }}
        preferences={view.preferences}
        summary={view.summary}
      />
    </>
  );
}

const notificationMarkReadToastCopy = {
  successTitle: "Notification marked read",
  successDescription: (notification: NotificationRecordData) =>
    `Marked "${notification.title}" as read.`,
  failureTitle: "Notification update failed",
  failureDescription: (failure: {
    readonly status: string;
    readonly error?: unknown;
    readonly message?: string;
  }) =>
    failure.status === "typed_failure"
      ? notificationFailureMessage(failure.error)
      : (failure.message ?? "Notification update failed."),
};

function notificationFailureMessage(error: unknown): string {
  return describeTypedFailure(error, "Notification update failed.");
}
