import { describe, expect, it } from "vitest";
import {
  applyNotificationPreference,
  buildNotificationCenterView,
  createActionDigestService,
  createAlertService,
  createEmailService,
  createFunnelLifecycleEmailService,
  defaultNotificationPreferences,
  markNotificationRead,
  preferenceAllowsChannel,
  redactEmailPayload,
  type NotificationRecord,
} from "./index";

describe("notification provider seams", () => {
  it("delivers lifecycle email through a neutral transport without logging private content", async () => {
    const requests: unknown[] = [];
    const transport = async (payload: unknown) => {
      requests.push(payload);
    };
    const logs: unknown[] = [];
    const service = createFunnelLifecycleEmailService({
      mode: "live",
      from: "reports@example.test",
      transport,
      sink: (message) => {
        logs.push(message);
      },
    });

    await expect(
      service.send({
        kind: "verify-report-email",
        to: "founder@example.test",
        reportId: "report_1",
        destinationUrl: "https://example.test/verify-report?token=secret-token",
      }),
    ).resolves.toMatchObject({
      ok: true,
      delivery: "live-ready",
      idempotencyKey: "idea-funnel.verify-report-email.report_1",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      templateAlias: "verify-report-email",
      idempotencyKey: "idea-funnel.verify-report-email.report_1",
    });
    expect(JSON.stringify(requests)).toContain("founder@example.test");
    expect(JSON.stringify(requests)).toContain("secret-token");
    expect(JSON.stringify(logs)).not.toContain("founder@example.test");
    expect(JSON.stringify(logs)).not.toContain("secret-token");
  });

  it("returns a typed failure when the neutral provider rejects a message", async () => {
    const service = createEmailService({
      mode: "live",
      transport: async () => {
        throw new Error("rejected");
      },
    });

    await expect(
      service.send({
        to: "founder@example.test",
        from: "reports@example.test",
        subject: "Verify",
        html: "<p>Private link</p>",
        idempotencyKey: "verification.report_1",
        templateData: {},
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        _tag: "EmailProviderError",
        provider: "email",
      },
    });
  });

  it("delivers report verification links through the redacted email seam", async () => {
    const deliveries: unknown[] = [];
    const service = createFunnelLifecycleEmailService({
      mode: "fake",
      from: "reports@example.test",
      sink: (message) => {
        deliveries.push(message);
      },
    });
    await expect(
      service.send({
        kind: "verify-report-email",
        to: "founder@example.test",
        reportId: "report_1",
        destinationUrl: "https://example.test/verify/token-secret",
      }),
    ).resolves.toMatchObject({
      ok: true,
      idempotencyKey: "idea-funnel.verify-report-email.report_1",
    });
    expect(JSON.stringify(deliveries)).not.toContain("token-secret");
    expect(JSON.stringify(deliveries)).not.toContain("founder@example.test");
  });

  it("sends idempotent app-idea lifecycle messages through the redacted email seam", async () => {
    const deliveries: unknown[] = [];
    const service = createFunnelLifecycleEmailService({
      mode: "fake",
      from: "reports@example.test",
      sink: (message) => {
        deliveries.push(message);
      },
    });
    await expect(
      service.send({
        kind: "build-pack-ready",
        to: "founder@example.test",
        reportId: "idea_1",
        destinationUrl: "https://example.test/build-pack/pack_1",
      }),
    ).resolves.toMatchObject({
      ok: true,
      idempotencyKey: "idea-funnel.build-pack-ready.idea_1",
    });
    expect(JSON.stringify(deliveries)).not.toContain("founder@example.test");
  });

  it("sends provider-neutral email in fake mode with idempotency key", async () => {
    const deliveries: unknown[] = [];
    const service = createEmailService({
      mode: "fake",
      sink: (message) => {
        deliveries.push(message);
      },
    });

    await expect(
      service.send({
        to: "person@example.test",
        from: "no-reply@example.test",
        subject: "Invite",
        html: "<p>Hello</p>",
        idempotencyKey: "email-001",
        templateData: { token: "secret", workspace: "Acme" },
      }),
    ).resolves.toMatchObject({
      ok: true,
      delivery: "fake",
      idempotencyKey: "email-001",
    });
    expect(JSON.stringify(deliveries)).not.toContain("secret");
  });

  it("requires an idempotency key before sending", async () => {
    const service = createEmailService({ mode: "fake" });

    await expect(
      service.send({
        to: "person@example.test",
        from: "no-reply@example.test",
        subject: "Invite",
        html: "<p>Hello</p>",
        idempotencyKey: "",
        templateData: {},
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { _tag: "EmailValidationError" },
    });
  });

  it("rejects padded and non-URL-safe email idempotency keys before sending", async () => {
    const deliveries: unknown[] = [];
    const service = createEmailService({
      mode: "fake",
      sink: (message) => {
        deliveries.push(message);
      },
    });

    await expect(
      service.send({
        to: "person@example.test",
        from: "no-reply@example.test",
        subject: "Invite",
        html: "<p>Hello</p>",
        idempotencyKey: " email-001 ",
        templateData: {},
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        _tag: "EmailValidationError",
        field: "idempotencyKey",
        message:
          "Email idempotencyKey must not have leading or trailing whitespace.",
      },
    });
    await expect(
      service.send({
        to: "person@example.test",
        from: "no-reply@example.test",
        subject: "Invite",
        html: "<p>Hello</p>",
        idempotencyKey: "email/001",
        templateData: {},
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        _tag: "EmailValidationError",
        field: "idempotencyKey",
        message:
          "Email idempotencyKey must contain only URL-safe letters, numbers, '.', '_', '~', or '-'.",
      },
    });
    expect(deliveries).toEqual([]);
  });

  it("redacts email payload recipients and template secrets", () => {
    expect(
      redactEmailPayload({
        to: "person@example.test",
        apiKey: "secret",
        templateData: { token: "secret", safe: "value" },
      }),
    ).toEqual({
      to: "[redacted]",
      apiKey: "[redacted]",
      templateData: "[redacted]",
    });
  });

  it("emits outbound alerts through a redacted fake/test/live seam", async () => {
    const emitted: unknown[] = [];
    const alerts = createAlertService({
      mode: "fake",
      sink: (alert) => {
        emitted.push(alert);
      },
    });

    await expect(
      alerts.emit({
        severity: "critical",
        title: "Provider outage",
        body: "OpenRouter failed with token sk-live-secret",
        dedupeKey: "provider-openrouter-down",
        workspaceId: "workspace_123",
        metadata: {
          apiKey: "sk-live-secret",
          provider: "openrouter",
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      delivery: "fake",
      dedupeKey: "provider-openrouter-down",
    });
    expect(JSON.stringify(emitted)).not.toContain("sk-live-secret");
    expect(emitted).toEqual([
      expect.objectContaining({
        severity: "critical",
        title: "Provider outage",
        metadata: "[redacted]",
      }),
    ]);
  });

  it("emits transform drift alerts without leaking hashes or raw metadata", async () => {
    const emitted: unknown[] = [];
    const alerts = createAlertService({
      mode: "fake",
      sink: (alert) => {
        emitted.push(alert);
      },
    });

    await expect(
      alerts.emit({
        severity: "warning",
        title: "Transform drift detected",
        body: "Transform transform_gtm_brief drifted for run run_001.",
        dedupeKey: "transform-drift:workspace_123:transform_gtm_brief:run_001",
        workspaceId: "workspace_123",
        metadata: {
          transformId: "transform_gtm_brief",
          runId: "run_001",
          expectedOutputHash: "sha256:expected-secret",
          actualOutputHash: "sha256:actual-secret",
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      delivery: "fake",
      dedupeKey: "transform-drift:workspace_123:transform_gtm_brief:run_001",
    });

    expect(JSON.stringify(emitted)).not.toContain("sha256:expected-secret");
    expect(JSON.stringify(emitted)).not.toContain("sha256:actual-secret");
    expect(emitted).toEqual([
      expect.objectContaining({
        severity: "warning",
        title: "Transform drift detected",
        body: "[redacted]",
        metadata: "[redacted]",
      }),
    ]);
  });

  it("sends action digests through the email seam with redacted metadata", async () => {
    const deliveries: unknown[] = [];
    const digests = createActionDigestService({
      mode: "fake",
      from: "no-reply@example.test",
      sink: (message) => {
        deliveries.push(message);
      },
    });

    await expect(
      digests.send({
        to: "ops@example.test",
        workspaceId: "workspace_123",
        recipientId: "user_ops",
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-01T23:59:59.000Z",
        jobsQueued: 5,
        approvalsWaiting: 2,
        actionsPublished: 1,
        customerMetadata: { email: "buyer@example.com" },
        providerMetadata: { messageId: "provider-secret-message-id" },
      }),
    ).resolves.toMatchObject({
      ok: true,
      delivery: "fake",
      idempotencyKey:
        "action-digest.workspace_123.user_ops.2026-07-01T00-00-00.000Z.2026-07-01T23-59-59.000Z",
    });

    expect(JSON.stringify(deliveries)).not.toContain("buyer@example.com");
    expect(JSON.stringify(deliveries)).not.toContain(
      "provider-secret-message-id",
    );
    expect(deliveries).toEqual([
      expect.objectContaining({
        to: "[redacted]",
        templateData: "[redacted]",
      }),
    ]);
  });
});

describe("notification center model", () => {
  const notifications: readonly NotificationRecord[] = [
    {
      id: "notification_workflow_done",
      workspaceId: "workspace_123",
      recipientId: "user_ops",
      title: "Workflow completed",
      body: "The launch workflow finished and is ready for review.",
      category: "workflow",
      priority: "normal",
      delivery: "fake",
      createdAt: "2026-07-05T13:00:00.000Z",
      actionHref: "/runs/run_123",
    },
    {
      id: "notification_security_review",
      workspaceId: "workspace_123",
      recipientId: "user_ops",
      title: "Security review needed",
      body: "A new live provider key is waiting for approval.",
      category: "security",
      priority: "high",
      delivery: "test",
      createdAt: "2026-07-05T14:00:00.000Z",
      readAt: "2026-07-05T14:05:00.000Z",
    },
  ];
  const workflowDoneNotification = notifications[0];
  const securityReviewNotification = notifications[1];

  if (
    workflowDoneNotification === undefined ||
    securityReviewNotification === undefined
  ) {
    throw new Error("Notification center test fixtures are incomplete.");
  }

  it("builds an in-app view with unread counts and newest-first ordering", () => {
    expect(buildNotificationCenterView({ notifications })).toMatchObject({
      notifications: [
        { id: "notification_security_review" },
        { id: "notification_workflow_done" },
      ],
      summary: {
        total: 2,
        unread: 1,
        mutedCategories: [],
        liveDeliveryReady: false,
      },
    });
  });

  it("filters muted in-app categories while preserving delivery preferences", () => {
    const preferences = applyNotificationPreference(
      defaultNotificationPreferences,
      {
        category: "workflow",
        inApp: false,
        email: true,
        digest: true,
      },
    );

    const view = buildNotificationCenterView({ notifications, preferences });

    expect(view.notifications.map((notification) => notification.id)).toEqual([
      "notification_security_review",
    ]);
    expect(view.summary.mutedCategories).toEqual(["workflow"]);
    expect(
      preferenceAllowsChannel(
        view.preferences.find(
          (preference) => preference.category === "workflow",
        ) ?? {
          category: "workflow",
          inApp: false,
          email: false,
          digest: false,
        },
        "email",
      ),
    ).toBe(true);
  });

  it("marks unread notifications without rewriting an existing read receipt", () => {
    expect(
      markNotificationRead({
        notification: workflowDoneNotification,
        readAt: "2026-07-05T15:00:00.000Z",
      }),
    ).toMatchObject({ readAt: "2026-07-05T15:00:00.000Z" });
    expect(
      markNotificationRead({
        notification: securityReviewNotification,
        readAt: "2026-07-05T15:00:00.000Z",
      }),
    ).toMatchObject({ readAt: "2026-07-05T14:05:00.000Z" });
  });
});
