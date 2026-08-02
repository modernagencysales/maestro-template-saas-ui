import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDodoCheckout,
  createDodoSdkCheckoutTransport,
  DodoWebhookConfigError,
  DodoWebhookReplayError,
  DodoWebhookSignatureError,
  normalizeDodoWebhook,
  verifyDodoWebhook,
} from "./dodo";

describe("Dodo payment seam", () => {
  it("creates a fake hosted checkout without exposing customer details", async () => {
    const result = await createDodoCheckout({
      mode: "fake",
      apiKey: undefined,
      productId: "prod_build_pack",
      reportId: "idea_1",
      customerEmail: "buyer@example.com",
      returnUrl: "https://example.test/checkout/return",
      idempotencyKey: "checkout-idea-1",
    });

    expect(result).toMatchObject({
      provider: "dodo",
      mode: "fake",
      checkoutSessionId: expect.stringContaining("checkout_"),
      checkoutUrl: expect.stringContaining("/checkout/return"),
      reportId: "idea_1",
    });
    expect(JSON.stringify(result)).not.toContain("buyer@example.com");
  });

  it("requires server credentials before creating a live checkout", async () => {
    await expect(
      createDodoCheckout({
        mode: "live",
        apiKey: undefined,
        productId: "prod_build_pack",
        reportId: "idea_1",
        customerEmail: "buyer@example.com",
        returnUrl: "https://example.test/checkout/return",
        idempotencyKey: "checkout-idea-1",
      }),
    ).resolves.toBeInstanceOf(DodoWebhookConfigError);
  });

  it("creates a live hosted session through the server transport", async () => {
    const result = await createDodoCheckout({
      mode: "live",
      apiKey: "server-key",
      productId: "prod_build_pack",
      reportId: "idea_1",
      customerEmail: "buyer@example.com",
      returnUrl: "https://example.test/checkout/return",
      idempotencyKey: "checkout-idea-1",
      transport: async (request) => {
        expect(request).toMatchObject({
          apiKey: "server-key",
          productCart: [{ productId: "prod_build_pack", quantity: 1 }],
          customer: { email: "buyer@example.com" },
          metadata: { reportId: "idea_1" },
        });
        return {
          checkoutSessionId: "checkout_live_1",
          checkoutUrl: "https://checkout.dodopayments.com/session/live_1",
        };
      },
    });
    expect(result).toMatchObject({
      mode: "live",
      checkoutSessionId: "checkout_live_1",
      checkoutUrl: "https://checkout.dodopayments.com/session/live_1",
      reportId: "idea_1",
    });
    expect(JSON.stringify(result)).not.toContain("buyer@example.com");
    expect(JSON.stringify(result)).not.toContain("server-key");
  });

  it("maps checkout creation through the official Dodo SDK client", async () => {
    const calls: unknown[] = [];
    const transport = createDodoSdkCheckoutTransport({
      environment: "test_mode",
      clientFactory: (options) => {
        calls.push({ options });
        return {
          checkoutSessions: {
            create: async (input, requestOptions) => {
              calls.push({ input, requestOptions });
              return {
                session_id: "checkout_sdk_1",
                checkout_url: "https://checkout.dodopayments.com/session/sdk_1",
              };
            },
          },
        };
      },
    });

    await expect(
      transport({
        apiKey: "server-key",
        productCart: [{ productId: "prod_build_pack", quantity: 1 }],
        customer: { email: "founder@example.test" },
        metadata: { reportId: "report_1" },
        returnUrl: "https://example.test/checkout/return",
        idempotencyKey: "checkout.report_1",
      }),
    ).resolves.toEqual({
      checkoutSessionId: "checkout_sdk_1",
      checkoutUrl: "https://checkout.dodopayments.com/session/sdk_1",
    });
    expect(calls).toEqual([
      {
        options: {
          bearerToken: "server-key",
          environment: "test_mode",
        },
      },
      {
        input: {
          product_cart: [{ product_id: "prod_build_pack", quantity: 1 }],
          customer: { email: "founder@example.test" },
          metadata: { reportId: "report_1" },
          return_url: "https://example.test/checkout/return",
        },
        requestOptions: { idempotencyKey: "checkout.report_1" },
      },
    ]);
  });

  it("returns a typed retryable provider failure without exposing the transport error", async () => {
    await expect(
      createDodoCheckout({
        mode: "live",
        apiKey: "server-key",
        productId: "prod_build_pack",
        reportId: "idea_1",
        customerEmail: "buyer@example.com",
        returnUrl: "https://example.test/checkout/return",
        idempotencyKey: "checkout-idea-1",
        transport: async () => {
          throw Object.assign(
            new Error("Dodo upstream request id req_secret"),
            {
              status: 503,
            },
          );
        },
      }),
    ).resolves.toMatchObject({
      _tag: "DodoCheckoutProviderError",
      operation: "checkout.create",
      status: 503,
      retryable: true,
    });
  });

  it("accepts fake-mode webhooks without live secrets", async () => {
    await expect(
      verifyDodoWebhook({
        mode: "fake",
        payload: '{"event":"payment.succeeded"}',
        signature: undefined,
        webhookSecret: undefined,
        nowMs: 1_000,
        seenEventIds: [],
      }),
    ).resolves.toEqual({
      ok: true,
      mode: "fake",
      eventId: "fake-dodo-event",
    });
  });

  it("requires a secret and signature in live-ready mode", async () => {
    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload: '{"id":"evt_123"}',
        signature: undefined,
        webhookSecret: "secret",
        nowMs: 1_000,
        seenEventIds: [],
      }),
    ).resolves.toBeInstanceOf(DodoWebhookConfigError);
  });

  it("requires the provider webhook id instead of trusting an event id in the body", async () => {
    const payload = '{"id":"body-controlled-event","type":"payment.succeeded"}';
    const timestamp = "1700000000";
    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: "v1,irrelevant-without-webhook-id",
        signatureTimestamp: timestamp,
        webhookSecret: "server-secret",
        nowMs: 1_700_000_100_000,
        seenEventIds: [],
      }),
    ).resolves.toMatchObject({ _tag: "DodoWebhookEventIdError" });
  });

  it("uses the signed-request webhook id as the replay identity", async () => {
    const payload = '{"id":"body-controlled-event","type":"payment.succeeded"}';
    const timestamp = "1700000000";
    const webhookId = "evt_header_123";
    const signature = createHmac("sha256", "server-secret")
      .update(`${webhookId}.${timestamp}.${payload}`)
      .digest("base64");

    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: `v1,${signature}`,
        signatureTimestamp: timestamp,
        webhookSecret: "server-secret",
        webhookId,
        nowMs: 1_700_000_100_000,
        seenEventIds: [],
      }),
    ).resolves.toEqual({
      ok: true,
      mode: "live",
      eventId: "evt_header_123",
    });
  });

  it("rejects the legacy two-part signature even when the webhook id is present", async () => {
    const payload = '{"id":"evt_123","type":"payment.succeeded"}';
    const timestamp = "1700000000";
    const signature = createHmac("sha256", "server-secret")
      .update(`${timestamp}.${payload}`)
      .digest("base64");

    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: `v1,${signature}`,
        signatureTimestamp: timestamp,
        webhookId: "evt_123",
        webhookSecret: "server-secret",
        nowMs: 1_700_000_100_000,
        seenEventIds: [],
      }),
    ).resolves.toBeInstanceOf(DodoWebhookSignatureError);
  });

  it("rejects an invalid live webhook signature", async () => {
    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload: '{"id":"evt_123","type":"payment.succeeded"}',
        signature: "v1,invalid",
        signatureTimestamp: "1700000000",
        webhookId: "evt_123",
        webhookSecret: "server-secret",
        nowMs: 1_700_000_000_000,
        seenEventIds: [],
      }),
    ).resolves.toBeInstanceOf(DodoWebhookSignatureError);
  });

  it("authenticates a raw body before reporting a typed malformed-payload failure", async () => {
    const payload = "not json";
    const timestamp = "1700000000";
    const webhookId = "evt_malformed_1";
    const signature = createHmac("sha256", "server-secret")
      .update(`${webhookId}.${timestamp}.${payload}`)
      .digest("base64");

    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: `v1,${signature}`,
        signatureTimestamp: timestamp,
        webhookId,
        webhookSecret: "server-secret",
        nowMs: 1_700_000_100_000,
        seenEventIds: [],
      }),
    ).resolves.toMatchObject({ _tag: "DodoWebhookPayloadError" });
  });

  it("accepts a fresh cryptographically verified webhook", async () => {
    const payload = '{"id":"evt_123","type":"payment.succeeded"}';
    const timestamp = "1700000000";
    const webhookId = "evt_123";
    const signature = createHmac("sha256", "server-secret")
      .update(`${webhookId}.${timestamp}.${payload}`)
      .digest("base64");
    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: `v1,${signature}`,
        signatureTimestamp: timestamp,
        webhookId,
        webhookSecret: "server-secret",
        nowMs: 1_700_000_100_000,
        seenEventIds: [],
      }),
    ).resolves.toEqual({ ok: true, mode: "live", eventId: "evt_123" });
  });

  it("rejects a correctly signed webhook outside the freshness window", async () => {
    const payload = '{"id":"evt_123","type":"payment.succeeded"}';
    const timestamp = "1700000000";
    const webhookId = "evt_123";
    const signature = createHmac("sha256", "server-secret")
      .update(`${webhookId}.${timestamp}.${payload}`)
      .digest("base64");
    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: `v1,${signature}`,
        signatureTimestamp: timestamp,
        webhookId,
        webhookSecret: "server-secret",
        nowMs: 1_700_000_301_000,
        seenEventIds: [],
      }),
    ).resolves.toBeInstanceOf(DodoWebhookSignatureError);
  });

  it("denies duplicate webhook event ids", async () => {
    const payload = '{"id":"evt_123"}';
    const timestamp = "1700000000";
    const webhookId = "evt_123";
    const signature = createHmac("sha256", "secret")
      .update(`${webhookId}.${timestamp}.${payload}`)
      .digest("base64");

    await expect(
      verifyDodoWebhook({
        mode: "live",
        payload,
        signature: `v1,${signature}`,
        signatureTimestamp: timestamp,
        webhookId,
        webhookSecret: "secret",
        nowMs: 1_700_000_100_000,
        seenEventIds: ["evt_123"],
      }),
    ).resolves.toBeInstanceOf(DodoWebhookReplayError);
  });

  it("normalizes Dodo webhook identity by provider, event id, and signature timestamp", () => {
    const normalized = normalizeDodoWebhook({
      payload: JSON.stringify({
        id: "evt_123",
        type: "payment.succeeded",
        data: {
          customer: {
            email: "buyer@example.com",
          },
        },
      }),
      signatureTimestamp: "1700000000",
    });

    expect(normalized).toEqual({
      provider: "dodo",
      eventId: "evt_123",
      eventType: "payment.succeeded",
      signatureTimestamp: "1700000000",
      dedupeKey: "dodo.evt_123.1700000000",
      redactedPayload: {
        id: "evt_123",
        type: "payment.succeeded",
        data: "[redacted]",
      },
    });
    expect(JSON.stringify(normalized)).not.toContain("buyer@example.com");
  });

  it("detects duplicate Dodo webhooks by provider, event id, and signature timestamp", async () => {
    await expect(
      verifyDodoWebhook({
        mode: "fake",
        payload: '{"id":"evt_123","type":"payment.succeeded"}',
        signature: undefined,
        signatureTimestamp: "1700000000",
        webhookSecret: "secret",
        nowMs: 1_000,
        seenWebhookKeys: ["dodo.evt_123.1700000000"],
        seenEventIds: [],
      }),
    ).resolves.toBeInstanceOf(DodoWebhookReplayError);
  });
});
