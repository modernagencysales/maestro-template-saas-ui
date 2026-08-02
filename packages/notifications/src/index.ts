export type EmailMode = "fake" | "test" | "live";

export type EmailPayload = {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly html: string;
  readonly idempotencyKey: string;
  readonly templateData: Readonly<Record<string, unknown>>;
  readonly templateAlias?: string;
};

export type EmailDelivery = {
  readonly ok: true;
  readonly delivery: "fake" | "test" | "live-ready";
  readonly idempotencyKey: string;
};

export class EmailValidationError extends Error {
  readonly _tag = "EmailValidationError";

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "EmailValidationError";
  }
}

export class EmailProviderError extends Error {
  readonly _tag = "EmailProviderError";
  readonly provider = "email";

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}

export type EmailFailure = {
  readonly ok: false;
  readonly error: EmailValidationError | EmailProviderError;
};

export type EmailResult = EmailDelivery | EmailFailure;

const idempotencyKeyPattern = /^[A-Za-z0-9._~-]+$/;
const maxIdempotencyKeyLength = 128;

export type EmailTransport = (payload: EmailPayload) => Promise<void>;

const validateEmailIdempotencyKey = (
  idempotencyKey: string,
): EmailValidationError | undefined => {
  const trimmed = idempotencyKey.trim();

  if (!trimmed) {
    return new EmailValidationError(
      "idempotencyKey",
      "Email idempotencyKey is required.",
    );
  }

  if (trimmed !== idempotencyKey) {
    return new EmailValidationError(
      "idempotencyKey",
      "Email idempotencyKey must not have leading or trailing whitespace.",
    );
  }

  if (idempotencyKey.length > maxIdempotencyKeyLength) {
    return new EmailValidationError(
      "idempotencyKey",
      `Email idempotencyKey must be ${String(maxIdempotencyKeyLength)} characters or fewer.`,
    );
  }

  if (!idempotencyKeyPattern.test(idempotencyKey)) {
    return new EmailValidationError(
      "idempotencyKey",
      "Email idempotencyKey must contain only URL-safe letters, numbers, '.', '_', '~', or '-'.",
    );
  }

  return undefined;
};

export type AlertSeverity = "info" | "warning" | "critical";

export type NotificationCenterDeliveryState = "fake" | "test" | "live-ready";

export type NotificationChannel = "inApp" | "email" | "digest";

export type NotificationCategory =
  "workspace" | "workflow" | "billing" | "security" | "system";

export type NotificationPriority = "low" | "normal" | "high";

export type NotificationRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly recipientId: string;
  readonly title: string;
  readonly body: string;
  readonly category: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly delivery: NotificationCenterDeliveryState;
  readonly createdAt: string;
  readonly readAt?: string;
  readonly actionHref?: string;
};

export type NotificationPreference = {
  readonly category: NotificationCategory;
  readonly inApp: boolean;
  readonly email: boolean;
  readonly digest: boolean;
};

export type NotificationCenterSummary = {
  readonly total: number;
  readonly unread: number;
  readonly mutedCategories: readonly NotificationCategory[];
  readonly liveDeliveryReady: boolean;
};

export type NotificationCenterView = {
  readonly notifications: readonly NotificationRecord[];
  readonly preferences: readonly NotificationPreference[];
  readonly summary: NotificationCenterSummary;
};

const notificationCategories = [
  "workspace",
  "workflow",
  "billing",
  "security",
  "system",
] as const satisfies readonly NotificationCategory[];

export const defaultNotificationPreferences =
  notificationCategories.map<NotificationPreference>((category) => ({
    category,
    inApp: true,
    email: category === "security" || category === "system",
    digest: category !== "security",
  }));

const defaultPreferenceFor = (
  category: NotificationCategory,
): NotificationPreference =>
  defaultNotificationPreferences.find(
    (preference) => preference.category === category,
  ) ?? {
    category,
    inApp: true,
    email: false,
    digest: true,
  };

export const preferenceAllowsChannel = (
  preference: NotificationPreference,
  channel: NotificationChannel,
): boolean => preference[channel];

export const applyNotificationPreference = (
  preferences: readonly NotificationPreference[],
  preference: NotificationPreference,
): readonly NotificationPreference[] => {
  const withoutCategory = preferences.filter(
    (existing) => existing.category !== preference.category,
  );

  return [...withoutCategory, preference].sort(
    (a, b) =>
      notificationCategories.indexOf(a.category) -
      notificationCategories.indexOf(b.category),
  );
};

export const markNotificationRead = ({
  notification,
  readAt,
}: {
  readonly notification: NotificationRecord;
  readonly readAt: string;
}): NotificationRecord => ({
  ...notification,
  readAt: notification.readAt ?? readAt,
});

export const buildNotificationCenterView = ({
  notifications,
  preferences = defaultNotificationPreferences,
}: {
  readonly notifications: readonly NotificationRecord[];
  readonly preferences?: readonly NotificationPreference[];
}): NotificationCenterView => {
  const preferenceByCategory = new Map(
    preferences.map((preference) => [preference.category, preference]),
  );
  const visibleNotifications = notifications
    .filter((notification) =>
      preferenceAllowsChannel(
        preferenceByCategory.get(notification.category) ??
          defaultPreferenceFor(notification.category),
        "inApp",
      ),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const effectivePreferences = notificationCategories.map(
    (category) =>
      preferenceByCategory.get(category) ?? defaultPreferenceFor(category),
  );

  return {
    notifications: visibleNotifications,
    preferences: effectivePreferences,
    summary: {
      total: visibleNotifications.length,
      unread: visibleNotifications.filter(
        (notification) => notification.readAt === undefined,
      ).length,
      mutedCategories: effectivePreferences
        .filter((preference) => !preference.inApp)
        .map((preference) => preference.category),
      liveDeliveryReady: visibleNotifications.some(
        (notification) => notification.delivery === "live-ready",
      ),
    },
  };
};

export type AlertPayload = {
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly body: string;
  readonly dedupeKey: string;
  readonly workspaceId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type AlertDelivery = {
  readonly ok: true;
  readonly delivery: "fake" | "test" | "live-ready";
  readonly dedupeKey: string;
};

export type AlertFailure = {
  readonly ok: false;
  readonly error: EmailValidationError;
};

export type AlertResult = AlertDelivery | AlertFailure;

export type ActionDigestPayload = {
  readonly to: string;
  readonly workspaceId: string;
  readonly recipientId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly jobsQueued: number;
  readonly approvalsWaiting: number;
  readonly actionsPublished: number;
  readonly customerMetadata: Readonly<Record<string, unknown>>;
  readonly providerMetadata: Readonly<Record<string, unknown>>;
};

export const redactEmailPayload = (
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    redacted[key] =
      key === "to" ||
      key === "recipient" ||
      key === "apiKey" ||
      key === "templateData" ||
      key === "html"
        ? "[redacted]"
        : value;
  }

  return redacted;
};

const deliveryForMode = (mode: EmailMode): EmailDelivery["delivery"] =>
  mode === "fake" ? "fake" : mode === "test" ? "test" : "live-ready";

export const createEmailService = (options: {
  readonly mode: EmailMode;
  readonly transport?: EmailTransport;
  readonly sink?: (
    payload: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
}) => ({
  send: async (payload: EmailPayload): Promise<EmailResult> => {
    const idempotencyKeyError = validateEmailIdempotencyKey(
      payload.idempotencyKey,
    );

    if (idempotencyKeyError) {
      return {
        ok: false,
        error: idempotencyKeyError,
      };
    }

    try {
      await options.transport?.(payload);
      await options.sink?.(
        redactEmailPayload({
          ...payload,
          apiKey: "provider-owned",
        }),
      );
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof EmailProviderError
            ? error
            : new EmailProviderError("Email delivery failed."),
      };
    }

    return {
      ok: true,
      delivery: deliveryForMode(options.mode),
      idempotencyKey: payload.idempotencyKey,
    };
  },
});

export type FunnelLifecycleEmailIntent = {
  readonly kind: "build-pack-ready" | "verify-report-email";
  readonly to: string;
  readonly reportId: string;
  readonly destinationUrl: string;
};

export const createFunnelLifecycleEmailService = (options: {
  readonly mode: EmailMode;
  readonly from: string;
  readonly transport?: EmailTransport;
  readonly sink?: (
    payload: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
}) => {
  const email = createEmailService(options);

  return {
    send: async (intent: FunnelLifecycleEmailIntent): Promise<EmailResult> => {
      const verification = intent.kind === "verify-report-email";
      return await email.send({
        to: intent.to,
        from: options.from,
        subject: verification
          ? "Verify your email to save your app idea"
          : "Your Complete Build Pack is ready",
        html: verification
          ? `<p>Verify your email to save your report. <a href="${intent.destinationUrl}">Verify email</a>.</p>`
          : `<p>Your Complete Build Pack is ready. <a href="${intent.destinationUrl}">Open your Build Pack</a>.</p>`,
        idempotencyKey: `idea-funnel.${intent.kind}.${actionDigestKeyPart(intent.reportId)}`,
        templateAlias: intent.kind,
        templateData: {
          reportId: intent.reportId,
          destinationUrl: intent.destinationUrl,
        },
      });
    },
  };
};

const actionDigestKeyPart = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9._~-]/g, "-");

export const createAlertService = (options: {
  readonly mode: EmailMode;
  readonly sink?: (
    payload: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
}) => ({
  emit: async (payload: AlertPayload): Promise<AlertResult> => {
    if (!payload.dedupeKey.trim()) {
      return {
        ok: false,
        error: new EmailValidationError(
          "dedupeKey",
          "Alert dedupeKey is required.",
        ),
      };
    }

    await options.sink?.(
      redactEmailPayload({
        ...payload,
        body: "[redacted]",
        metadata: "[redacted]",
      }),
    );

    return {
      ok: true,
      delivery: deliveryForMode(options.mode),
      dedupeKey: payload.dedupeKey,
    };
  },
});

export const createActionDigestService = (options: {
  readonly mode: EmailMode;
  readonly from: string;
  readonly sink?: (
    payload: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
}) => {
  const email = createEmailService(options);

  return {
    send: async (payload: ActionDigestPayload): Promise<EmailResult> => {
      const idempotencyKey = [
        "action-digest",
        payload.workspaceId,
        payload.recipientId,
        payload.periodStart,
        payload.periodEnd,
      ]
        .map(actionDigestKeyPart)
        .join(".");

      return await email.send({
        to: payload.to,
        from: options.from,
        subject: `Action digest: ${payload.jobsQueued} queued, ${payload.approvalsWaiting} waiting, ${payload.actionsPublished} published`,
        html: `<p>Your audited action queue has ${payload.jobsQueued} queued jobs, ${payload.approvalsWaiting} approvals waiting, and ${payload.actionsPublished} published action.</p>`,
        idempotencyKey,
        templateAlias: "notification-digest",
        templateData: {
          workspaceId: payload.workspaceId,
          recipientId: payload.recipientId,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          jobsQueued: payload.jobsQueued,
          approvalsWaiting: payload.approvalsWaiting,
          actionsPublished: payload.actionsPublished,
          customerMetadata: "[redacted]",
          providerMetadata: "[redacted]",
        },
      });
    },
  };
};
