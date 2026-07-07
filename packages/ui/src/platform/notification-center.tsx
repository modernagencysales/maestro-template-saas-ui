import { Badge } from "../primitives";

export type NotificationDeliveryState = "fake" | "test" | "live-ready";
export type NotificationCategory =
  "workspace" | "workflow" | "billing" | "security" | "system";
export type NotificationPriority = "low" | "normal" | "high";

export type PlatformNotification = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly delivery: NotificationDeliveryState;
  readonly createdAt: string;
  readonly readAt?: string;
  readonly actionHref?: string;
};

export type PlatformNotificationPreference = {
  readonly category: NotificationCategory;
  readonly inApp: boolean;
  readonly email: boolean;
  readonly digest: boolean;
};

export type PlatformNotificationSummary = {
  readonly total: number;
  readonly unread: number;
  readonly mutedCategories: readonly NotificationCategory[];
  readonly liveDeliveryReady: boolean;
};

export function TemplateNotificationCenter({
  notifications,
  preferences = [],
  summary,
  onMarkRead,
}: {
  readonly notifications: readonly PlatformNotification[];
  readonly preferences?: readonly PlatformNotificationPreference[];
  readonly summary?: PlatformNotificationSummary;
  readonly onMarkRead?: (notificationId: string) => void;
}) {
  const unreadCount =
    summary?.unread ??
    notifications.filter((notification) => notification.readAt === undefined)
      .length;

  return (
    <section
      aria-label="Notification center"
      className="template-notifications"
    >
      <header className="template-notifications-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h2>Inbox</h2>
        </div>
        <Badge>{`${unreadCount} unread`}</Badge>
      </header>
      {notifications.length === 0 ? (
        <p className="template-platform-empty">No notifications yet</p>
      ) : (
        <div className="template-notification-list">
          {notifications.map((notification) => (
            <article
              className={
                notification.readAt === undefined
                  ? "template-notification-row unread"
                  : "template-notification-row"
              }
              key={notification.id}
            >
              <header>
                <div>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                </div>
                <div className="template-notification-meta">
                  <Badge>{notification.category}</Badge>
                  <Badge>{notification.delivery}</Badge>
                </div>
              </header>
              <footer>
                <time dateTime={notification.createdAt}>
                  {notification.createdAt}
                </time>
                {notification.actionHref ? (
                  <a href={notification.actionHref}>Open</a>
                ) : null}
                {notification.readAt === undefined && onMarkRead ? (
                  <button
                    onClick={() => onMarkRead(notification.id)}
                    type="button"
                  >
                    Mark read
                  </button>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      )}
      {preferences.length > 0 ? (
        <section
          aria-label="Notification preferences"
          className="template-notification-prefs"
        >
          {preferences.map((preference) => (
            <article key={preference.category}>
              <strong>{preference.category}</strong>
              <span>{preference.inApp ? "Inbox on" : "Inbox muted"}</span>
              <span>{preference.email ? "Email on" : "Email off"}</span>
              <span>{preference.digest ? "Digest on" : "Digest off"}</span>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
