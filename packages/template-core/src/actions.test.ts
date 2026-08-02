import { describe, expect, it } from "vitest";
import {
  ActionValidationError,
  buildActionDigestPayload,
  configureActionTrigger,
  createActionJob,
  createReviewLinkToken,
} from "./actions";

const createdAt = "2026-07-01T21:00:00.000Z";
const expiresAt = "2026-07-02T21:00:00.000Z";

describe("action domain", () => {
  it("creates publish jobs only when approval policy or safe-mode exemption is present", () => {
    const job = createActionJob({
      jobId: "action_job_001",
      workspaceId: "workspace_123",
      workflowRunId: "run_001",
      capabilityId: "cap_publish_email",
      targetKind: "email",
      targetRef: "campaign_follow_up",
      payloadHash: "sha256:payload",
      approvalPolicyId: "policy_approval_required",
      safeModeExemptionReason: undefined,
      createdAt,
    });

    expect(job).toMatchObject({
      jobId: "action_job_001",
      status: "waiting_for_approval",
      approvalPolicyId: "policy_approval_required",
      safeModeExemptionReason: undefined,
    });

    const safeModeJob = createActionJob({
      jobId: "action_job_002",
      workspaceId: "workspace_123",
      workflowRunId: "run_001",
      capabilityId: "cap_sync_preview",
      targetKind: "crm",
      targetRef: "sandbox_contact",
      payloadHash: "sha256:payload",
      approvalPolicyId: undefined,
      safeModeExemptionReason: "Writes only to local fake CRM adapter.",
      createdAt,
    });

    expect(safeModeJob.status).toBe("queued");
    expect(safeModeJob.safeModeExemptionReason).toBe(
      "Writes only to local fake CRM adapter.",
    );

    expect(() =>
      createActionJob({
        jobId: "action_job_003",
        workspaceId: "workspace_123",
        workflowRunId: "run_001",
        capabilityId: "cap_publish_email",
        targetKind: "email",
        targetRef: "campaign_follow_up",
        payloadHash: "sha256:payload",
        approvalPolicyId: undefined,
        safeModeExemptionReason: undefined,
        createdAt,
      }),
    ).toThrow(ActionValidationError);
  });

  it("generates scoped expiring review link token hashes without retaining raw tokens", () => {
    const token = createReviewLinkToken({
      approvalId: "approval_001",
      workspaceId: "workspace_123",
      reviewerId: "user_reviewer",
      rawToken: "secret-review-token",
      scope: "action:approve",
      expiresAt,
      createdAt,
    });

    expect(token).toMatchObject({
      approvalId: "approval_001",
      workspaceId: "workspace_123",
      reviewerId: "user_reviewer",
      scope: "action:approve",
      expiresAt,
      createdAt,
    });
    expect(token.tokenHash).toMatch(/^sha256:/);
    expect(JSON.stringify(token)).not.toContain("secret-review-token");
  });

  it("configures refresh triggers with deterministic idempotency keys", () => {
    const trigger = configureActionTrigger({
      triggerId: "trigger_daily_refresh",
      workspaceId: "workspace_123",
      actionKind: "refresh",
      schedule: "0 9 * * 1-5",
      capabilityId: "cap_refresh_context",
      configHash: "sha256:trigger-config",
      enabled: true,
      createdAt,
    });

    expect(trigger).toEqual({
      triggerId: "trigger_daily_refresh",
      workspaceId: "workspace_123",
      actionKind: "refresh",
      schedule: "0 9 * * 1-5",
      capabilityId: "cap_refresh_context",
      configHash: "sha256:trigger-config",
      enabled: true,
      idempotencyKey:
        "action-trigger.workspace_123.trigger_daily_refresh.sha256~3a~trigger-config",
      createdAt,
    });
    expect(trigger.idempotencyKey).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it("builds notification digest payloads with customer and provider metadata redacted", () => {
    const digest = buildActionDigestPayload({
      digestId: "digest_001",
      workspaceId: "workspace_123",
      recipientId: "user_ops",
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-07-01T23:59:59.000Z",
      jobsQueued: 5,
      approvalsWaiting: 2,
      actionsPublished: 1,
      providerMetadata: {
        provider: "email",
        messageId: "provider-secret-message-id",
      },
      customerMetadata: {
        email: "buyer@example.com",
        companyDomain: "example.com",
      },
      createdAt,
    });

    expect(digest).toEqual({
      digestId: "digest_001",
      workspaceId: "workspace_123",
      recipientId: "user_ops",
      subject: "Action digest: 5 queued, 2 waiting, 1 published",
      body: "Your audited action queue has 5 queued jobs, 2 approvals waiting, and 1 published action.",
      dedupeKey:
        "action-digest.workspace_123.user_ops.2026-07-01T00~3a~00~3a~00.000Z.2026-07-01T23~3a~59~3a~59.000Z",
      metadata: {
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-01T23:59:59.000Z",
        jobsQueued: 5,
        approvalsWaiting: 2,
        actionsPublished: 1,
        providerMetadata: "[redacted]",
        customerMetadata: "[redacted]",
      },
      createdAt,
    });
    expect(digest.dedupeKey).toMatch(/^[A-Za-z0-9._~-]+$/);
  });
});
