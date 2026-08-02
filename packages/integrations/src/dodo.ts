import DodoPayments from "dodopayments";
import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";

export class DodoWebhookConfigError extends Schema.TaggedError<DodoWebhookConfigError>()(
  "DodoWebhookConfigError",
  {
    missing: Schema.Array(Schema.String),
  },
) {}

export class DodoCheckoutProviderError extends Schema.TaggedError<DodoCheckoutProviderError>()(
  "DodoCheckoutProviderError",
  {
    operation: Schema.String,
    status: Schema.optional(Schema.Number),
    retryable: Schema.Boolean,
  },
) {}

export class DodoWebhookReplayError extends Schema.TaggedError<DodoWebhookReplayError>()(
  "DodoWebhookReplayError",
  {
    eventId: Schema.String,
  },
) {}

export class DodoWebhookSignatureError extends Schema.TaggedError<DodoWebhookSignatureError>()(
  "DodoWebhookSignatureError",
  {
    reason: Schema.String,
  },
) {}

export class DodoWebhookEventIdError extends Schema.TaggedError<DodoWebhookEventIdError>()(
  "DodoWebhookEventIdError",
  { field: Schema.String },
) {}

export class DodoWebhookPayloadError extends Schema.TaggedError<DodoWebhookPayloadError>()(
  "DodoWebhookPayloadError",
  { reason: Schema.String },
) {}

export type DodoWebhookVerification =
  | {
      readonly ok: true;
      readonly mode: ProviderMode;
      readonly eventId: string;
    }
  | DodoWebhookConfigError
  | DodoWebhookEventIdError
  | DodoWebhookPayloadError
  | DodoWebhookReplayError
  | DodoWebhookSignatureError;

export type DodoCheckoutResult = {
  readonly provider: "dodo";
  readonly mode: ProviderMode;
  readonly checkoutSessionId: string;
  readonly checkoutUrl: string;
  readonly reportId: string;
};

export type DodoCheckoutTransportRequest = {
  readonly apiKey: string;
  readonly productCart: readonly {
    readonly productId: string;
    readonly quantity: number;
  }[];
  readonly customer: { readonly email: string };
  readonly metadata: { readonly reportId: string };
  readonly returnUrl: string;
  readonly idempotencyKey: string;
};

export type DodoCheckoutTransport = (
  request: DodoCheckoutTransportRequest,
) => Promise<{
  readonly checkoutSessionId: string;
  readonly checkoutUrl: string;
}>;

export type DodoSdkEnvironment = "live_mode" | "test_mode";

type DodoSdkCheckoutInput = {
  readonly product_cart: readonly {
    readonly product_id: string;
    readonly quantity: number;
  }[];
  readonly customer: { readonly email: string };
  readonly metadata: Readonly<Record<string, string>>;
  readonly return_url: string;
};

type DodoSdkCheckoutClient = {
  readonly checkoutSessions: {
    readonly create: (
      input: DodoSdkCheckoutInput,
      options?: { readonly idempotencyKey?: string },
    ) => Promise<{
      readonly session_id: string;
      readonly checkout_url?: string | null;
    }>;
  };
};

type DodoSdkClientFactory = (options: {
  readonly bearerToken: string;
  readonly environment: DodoSdkEnvironment;
}) => DodoSdkCheckoutClient;

const defaultDodoSdkClientFactory: DodoSdkClientFactory = (options) => {
  const client = new DodoPayments(options);
  return {
    checkoutSessions: {
      create: async (input, requestOptions) =>
        await client.checkoutSessions.create(
          {
            product_cart: input.product_cart.map((item) => ({ ...item })),
            customer: input.customer,
            metadata: { ...input.metadata },
            return_url: input.return_url,
          },
          requestOptions,
        ),
    },
  };
};

export const createDodoSdkCheckoutTransport = (options: {
  readonly environment: DodoSdkEnvironment;
  readonly clientFactory?: DodoSdkClientFactory;
}): DodoCheckoutTransport => {
  const clientFactory = options.clientFactory ?? defaultDodoSdkClientFactory;

  return async (request) => {
    const client = clientFactory({
      bearerToken: request.apiKey,
      environment: options.environment,
    });
    const session = await client.checkoutSessions.create(
      {
        product_cart: request.productCart.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        customer: request.customer,
        metadata: request.metadata,
        return_url: request.returnUrl,
      },
      { idempotencyKey: request.idempotencyKey },
    );
    if (!session.checkout_url) {
      throw Object.assign(new Error("Dodo did not return a checkout URL."), {
        status: 502,
      });
    }
    return {
      checkoutSessionId: session.session_id,
      checkoutUrl: session.checkout_url,
    };
  };
};

const providerStatus = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? typeof error.status === "number"
      ? error.status
      : undefined
    : undefined;

const checkoutPart = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);

export const createDodoCheckout = async (input: {
  readonly mode: ProviderMode;
  readonly apiKey: string | undefined;
  readonly productId: string;
  readonly reportId: string;
  readonly customerEmail: string;
  readonly returnUrl: string;
  readonly idempotencyKey: string;
  readonly transport?: DodoCheckoutTransport;
}): Promise<
  DodoCheckoutResult | DodoWebhookConfigError | DodoCheckoutProviderError
> => {
  if (input.mode === "live" && !input.apiKey?.trim()) {
    return new DodoWebhookConfigError({ missing: ["DODO_API_KEY"] });
  }

  if (input.mode !== "fake") {
    if (!input.transport) {
      return new DodoWebhookConfigError({
        missing: ["DODO_CHECKOUT_TRANSPORT"],
      });
    }
    let hosted: Awaited<ReturnType<DodoCheckoutTransport>>;
    try {
      hosted = await input.transport({
        apiKey: input.apiKey ?? "",
        productCart: [{ productId: input.productId, quantity: 1 }],
        customer: { email: input.customerEmail },
        metadata: { reportId: input.reportId },
        returnUrl: input.returnUrl,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      const status = providerStatus(error);
      return new DodoCheckoutProviderError({
        operation: "checkout.create",
        ...(status === undefined ? {} : { status }),
        retryable: status === undefined || status === 429 || status >= 500,
      });
    }
    return {
      provider: "dodo",
      mode: input.mode,
      ...hosted,
      reportId: input.reportId,
    };
  }

  const checkoutSessionId = `checkout_${checkoutPart(input.idempotencyKey)}`;
  const checkoutUrl = new URL(input.returnUrl);
  checkoutUrl.searchParams.set("session_id", checkoutSessionId);

  return {
    provider: "dodo",
    mode: input.mode,
    checkoutSessionId,
    checkoutUrl: checkoutUrl.toString(),
    reportId: input.reportId,
  };
};

export type NormalizedDodoWebhook = {
  readonly provider: "dodo";
  readonly eventId: string;
  readonly eventType: string;
  readonly signatureTimestamp: string;
  readonly dedupeKey: string;
  readonly redactedPayload: Readonly<Record<string, unknown>>;
};

const parsePayload = (payload: string): Record<string, unknown> =>
  JSON.parse(payload) as Record<string, unknown>;

const webhookDedupePart = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9._~-]/g, "-");

const base64Alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += base64Alphabet[(combined >> 18) & 63] ?? "";
    encoded += base64Alphabet[(combined >> 12) & 63] ?? "";
    encoded +=
      second === undefined ? "=" : (base64Alphabet[(combined >> 6) & 63] ?? "");
    encoded +=
      third === undefined ? "=" : (base64Alphabet[combined & 63] ?? "");
  }
  return encoded;
};

const hmacSha256Base64 = async (
  secret: string,
  value: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return bytesToBase64(new Uint8Array(signature));
};

const constantTimeStringEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

export const normalizeDodoWebhook = (input: {
  readonly payload: string;
  readonly signatureTimestamp: string | undefined;
  readonly webhookId?: string | undefined;
}): NormalizedDodoWebhook => {
  const parsed = parsePayload(input.payload);
  const eventId =
    input.webhookId?.trim() ||
    (typeof parsed.id === "string" ? parsed.id : "fake-dodo-event");
  const eventType =
    typeof parsed.type === "string"
      ? parsed.type
      : typeof parsed.event === "string"
        ? parsed.event
        : "unknown";
  const signatureTimestamp = input.signatureTimestamp?.trim() || "fake";
  const redactedPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed)) {
    redactedPayload[key] = key === "data" ? "[redacted]" : value;
  }

  return {
    provider: "dodo",
    eventId,
    eventType,
    signatureTimestamp,
    dedupeKey: ["dodo", eventId, signatureTimestamp]
      .map(webhookDedupePart)
      .join("."),
    redactedPayload,
  };
};

export const verifyDodoWebhook = async (input: {
  readonly mode: ProviderMode;
  readonly payload: string;
  readonly signature: string | undefined;
  readonly signatureTimestamp?: string | undefined;
  readonly webhookId?: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly nowMs: number;
  readonly seenEventIds: readonly string[];
  readonly seenWebhookKeys?: readonly string[];
}): Promise<DodoWebhookVerification> => {
  if (input.mode === "fake") {
    let normalized: NormalizedDodoWebhook;
    try {
      normalized = normalizeDodoWebhook({
        payload: input.payload,
        signatureTimestamp: input.signatureTimestamp,
        webhookId: input.webhookId,
      });
    } catch {
      return new DodoWebhookPayloadError({ reason: "invalid-json" });
    }

    if (
      input.seenEventIds.includes(normalized.eventId) ||
      input.seenWebhookKeys?.includes(normalized.dedupeKey)
    ) {
      return new DodoWebhookReplayError({ eventId: normalized.eventId });
    }

    return {
      ok: true,
      mode: "fake",
      eventId: normalized.eventId,
    };
  }

  const missing = [
    ...(input.webhookSecret?.trim() ? [] : ["DODO_WEBHOOK_SECRET"]),
    ...(input.signature?.trim() ? [] : ["dodo-signature"]),
  ];

  if (missing.length > 0) {
    return new DodoWebhookConfigError({ missing });
  }

  const webhookId = input.webhookId?.trim();
  if (!webhookId) {
    return new DodoWebhookEventIdError({ field: "webhook-id" });
  }

  const timestamp = input.signatureTimestamp ?? "";
  const timestampMs = Number(timestamp) * 1_000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(input.nowMs - timestampMs) > 300_000
  ) {
    return new DodoWebhookSignatureError({
      reason: "timestamp-outside-window",
    });
  }

  const provided = input.signature?.split(",")[1] ?? "";
  const expected = await hmacSha256Base64(
    input.webhookSecret ?? "",
    `${webhookId}.${timestamp}.${input.payload}`,
  );
  if (!constantTimeStringEqual(provided, expected)) {
    return new DodoWebhookSignatureError({ reason: "invalid-signature" });
  }

  let normalized: NormalizedDodoWebhook;
  try {
    normalized = normalizeDodoWebhook({
      payload: input.payload,
      signatureTimestamp: input.signatureTimestamp,
      webhookId: input.webhookId,
    });
  } catch {
    return new DodoWebhookPayloadError({ reason: "invalid-json" });
  }

  if (
    input.seenEventIds.includes(normalized.eventId) ||
    input.seenWebhookKeys?.includes(normalized.dedupeKey)
  ) {
    return new DodoWebhookReplayError({ eventId: normalized.eventId });
  }

  return {
    ok: true,
    mode: input.mode,
    eventId: normalized.eventId,
  };
};
